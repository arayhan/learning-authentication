package trace

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	maxBody = 4096
	suffix  = "…[truncated]"
)

func isRedacted(k string) bool { return k == "password" || k == "client_secret" }

func redactJSON(v any) any {
	switch t := v.(type) {
	case map[string]any:
		for k, x := range t {
			if isRedacted(k) {
				t[k] = "[redacted]"
			} else {
				t[k] = redactJSON(x)
			}
		}
	case []any:
		for i, x := range t {
			t[i] = redactJSON(x)
		}
	}
	return v
}

// redactBody redacts secrets, then truncates to maxBody bytes. "" means omit.
func redactBody(raw []byte, contentType string) string {
	if len(raw) == 0 {
		return ""
	}
	out := string(raw)
	ct := strings.ToLower(contentType)
	switch {
	case strings.Contains(ct, "application/json"):
		dec := json.NewDecoder(bytes.NewReader(raw))
		dec.UseNumber()
		var v any
		if dec.Decode(&v) == nil && !dec.More() { // maps marshal with sorted keys
			var buf bytes.Buffer
			enc := json.NewEncoder(&buf)
			enc.SetEscapeHTML(false)
			if enc.Encode(redactJSON(v)) == nil {
				out = strings.TrimSuffix(buf.String(), "\n")
			}
		}
	case strings.Contains(ct, "application/x-www-form-urlencoded"):
		if q, err := url.ParseQuery(out); err == nil {
			for k := range q {
				if isRedacted(k) {
					for i := range q[k] {
						q[k][i] = "[redacted]"
					}
				}
			}
			out = q.Encode() // sorted by key
		}
	}
	if len(out) <= maxBody {
		return out
	}
	n := maxBody
	for n > 0 && !utf8.RuneStart(out[n]) { // don't split a UTF-8 rune
		n--
	}
	return out[:n] + suffix
}

type recorder struct {
	http.ResponseWriter
	status  int
	headers map[string]any
	body    bytes.Buffer
}

func (r *recorder) snapshot() {
	if r.headers != nil {
		return
	}
	r.headers = map[string]any{}
	for k, v := range r.Header() {
		k = strings.ToLower(k)
		if k == "set-cookie" {
			r.headers[k] = append([]string(nil), v...)
		} else {
			r.headers[k] = strings.Join(v, ", ")
		}
	}
}

func (r *recorder) WriteHeader(code int) {
	if r.status == 0 {
		r.status = code
		r.snapshot()
	}
	r.ResponseWriter.WriteHeader(code)
}

func (r *recorder) Write(b []byte) (int, error) {
	if r.status == 0 {
		r.WriteHeader(http.StatusOK)
	}
	r.body.Write(b)
	return r.ResponseWriter.Write(b)
}

func (r *recorder) Flush() {
	if f, ok := r.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func (r *recorder) Unwrap() http.ResponseWriter { return r.ResponseWriter }

func newID() string {
	b := make([]byte, 16)
	rand.Read(b)
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

// Middleware records every request except OPTIONS and /__trace.
func Middleware(h *Hub, lab, impl, role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodOptions || r.URL.Path == "/__trace" {
				next.ServeHTTP(w, r)
				return
			}
			start := time.Now()
			reqBody, _ := io.ReadAll(r.Body)
			r.Body = io.NopCloser(bytes.NewReader(reqBody))
			rec := &recorder{ResponseWriter: w}
			next.ServeHTTP(rec, r)
			if rec.status == 0 {
				rec.status = http.StatusOK
			}
			rec.snapshot()
			resCT, _ := rec.headers["content-type"].(string)

			reqHeaders := map[string]string{}
			for k, v := range r.Header {
				reqHeaders[strings.ToLower(k)] = strings.Join(v, ", ")
			}
			h.Publish(Event{
				ID: newID(), Ts: time.Now().UTC().Format("2006-01-02T15:04:05.000Z"),
				Lab: lab, Impl: impl, Role: role,
				Req: Req{
					Method: r.Method, Path: r.URL.Path, Query: r.URL.RawQuery, Headers: reqHeaders,
					Body: redactBody(reqBody, r.Header.Get("Content-Type")),
				},
				Res: Res{
					Status: rec.status, Headers: rec.headers,
					Body: redactBody(rec.body.Bytes(), resCT),
				},
				DurationMs: time.Since(start).Milliseconds(),
			})
		})
	}
}

func writeEvent(w io.Writer, f http.Flusher, evs ...Event) bool {
	for _, e := range evs {
		b, err := json.Marshal(e)
		if err != nil {
			continue
		}
		if _, err := fmt.Fprintf(w, "data: %s\n\n", b); err != nil {
			return false
		}
	}
	f.Flush()
	return true
}
