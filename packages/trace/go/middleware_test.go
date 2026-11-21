package trace

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"
)

func newApp(h *Hub) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/__trace", h.SSE())
	mux.HandleFunc("/login", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Set-Cookie", "sid=abc; HttpOnly; SameSite=Lax; Path=/")
		w.Header().Add("Set-Cookie", "theme=dark; Path=/")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(200)
		w.Write([]byte(`{"ok":true}`))
	})
	mux.HandleFunc("/ping", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("pong")) })
	return Middleware(h, "01", "go", "app")(mux)
}

func do(app http.Handler, method, target, ctype, body string) {
	r := httptest.NewRequest(method, target, strings.NewReader(body))
	if ctype != "" {
		r.Header.Set("Content-Type", ctype)
	}
	app.ServeHTTP(httptest.NewRecorder(), r)
}

func toMap(t *testing.T, v any) map[string]any {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatal(err)
	}
	return m
}

func keep(h any, keys ...string) map[string]any {
	out := map[string]any{}
	for k, v := range h.(map[string]any) {
		for _, w := range keys {
			if k == w {
				out[k] = v
			}
		}
	}
	return out
}

func TestGolden(t *testing.T) {
	h := NewHub(200)
	do(newApp(h), "POST", "/login", "application/json", `{"password":"x","email":"a@b.c"}`)
	ev := h.Recent()
	if len(ev) != 1 {
		t.Fatalf("want 1 event, got %d", len(ev))
	}
	got := toMap(t, ev[0])
	got["id"], got["ts"], got["durationMs"], got["impl"] = "", "", float64(0), "x"
	req, res := got["req"].(map[string]any), got["res"].(map[string]any)
	req["headers"] = keep(req["headers"], "content-type", "cookie", "authorization")
	res["headers"] = keep(res["headers"], "content-type", "set-cookie")

	raw, err := os.ReadFile("../fixtures/event.golden.json")
	if err != nil {
		t.Fatal(err)
	}
	var want map[string]any
	if err := json.Unmarshal(raw, &want); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("golden mismatch\n got: %v\nwant: %v", got, want)
	}
}

func TestRedactFormAndNested(t *testing.T) {
	h := NewHub(200)
	app := newApp(h)
	do(app, "POST", "/ping", "application/json", `{"a":{"client_secret":"s"},"password":"p"}`)
	do(app, "POST", "/ping", "application/x-www-form-urlencoded", "z=1&password=p&client_secret=s&a=2")
	ev := h.Recent()
	if b := ev[0].Req.Body; b != `{"a":{"client_secret":"[redacted]"},"password":"[redacted]"}` {
		t.Errorf("json body: %s", b)
	}
	if b := ev[1].Req.Body; b != "a=2&client_secret=%5Bredacted%5D&password=%5Bredacted%5D&z=1" {
		t.Errorf("form body: %s", b)
	}
}

func TestTruncateAndQuery(t *testing.T) {
	h := NewHub(200)
	do(newApp(h), "POST", "/ping?x=1&y=2", "", strings.Repeat("a", 5000))
	e := h.Recent()[0]
	if e.Req.Query != "x=1&y=2" {
		t.Errorf("query %q", e.Req.Query)
	}
	if e.Req.Body != strings.Repeat("a", 4096)+"…[truncated]" {
		t.Errorf("body len %d", len(e.Req.Body))
	}
}

func TestSkipOptionsAndTrace(t *testing.T) {
	h := NewHub(200)
	app := newApp(h)
	do(app, "OPTIONS", "/ping", "", "")
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	r := httptest.NewRequest("GET", "/__trace", nil).WithContext(ctx)
	app.ServeHTTP(httptest.NewRecorder(), r)
	if n := len(h.Recent()); n != 0 {
		t.Fatalf("want 0 events, got %d", n)
	}
}

func TestHubRingAndSlowSubscriber(t *testing.T) {
	h := NewHub(2)
	_, slow, cancelSlow := h.Subscribe() // never drained
	defer cancelSlow()
	done := make(chan struct{})
	go func() {
		for i := 0; i < 500; i++ {
			h.Publish(Event{ID: string(rune('a' + i%26))})
		}
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Publish blocked on slow subscriber")
	}
	if len(h.Recent()) != 2 || len(slow) == 0 {
		t.Fatalf("recent=%d slowbuf=%d", len(h.Recent()), len(slow))
	}
}

func TestSSEReplaysThenStreams(t *testing.T) {
	h := NewHub(200)
	app := newApp(h)
	do(app, "POST", "/login", "application/json", `{"email":"a@b.c"}`)
	srv := httptest.NewServer(app)
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, "GET", srv.URL+"/__trace", nil)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if ct := res.Header.Get("Content-Type"); ct != "text/event-stream" {
		t.Fatalf("content-type %q", ct)
	}
	sc := bufio.NewScanner(res.Body)
	next := func() Event {
		for sc.Scan() {
			if line, ok := strings.CutPrefix(sc.Text(), "data: "); ok {
				var e Event
				if err := json.Unmarshal([]byte(line), &e); err != nil {
					t.Fatal(err)
				}
				return e
			}
		}
		t.Fatal("stream ended")
		return Event{}
	}
	if e := next(); e.Req.Path != "/login" {
		t.Fatalf("replay path %q", e.Req.Path)
	}
	go do(app, "GET", "/ping", "", "")
	if e := next(); e.Req.Path != "/ping" {
		t.Fatalf("live path %q", e.Req.Path)
	}
	cancel()
}
