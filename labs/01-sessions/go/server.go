package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log"
	"math"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	"authacademy/trace"
)

const (
	allowedOrigin = "http://localhost:3000"
	maxBody       = 1 << 20
)

// Session ids we accept from clients (plant-sid, and fixation in vulnerable mode).
var sidRe = regexp.MustCompile(`^[A-Za-z0-9_.~-]{1,256}$`)

type Server struct {
	store   *Store
	ui      []byte
	handler http.Handler // full stack (CORS + trace + routes); /__attack/as replays through it in-process
}

func newServer(store *Store, ui []byte, hub *trace.Hub) *Server {
	s := &Server{store: store, ui: ui}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", s.index)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, map[string]bool{"ok": true}) })
	mux.HandleFunc("GET /__trace", hub.SSE())
	mux.HandleFunc("POST /register", noStore(s.register))
	mux.HandleFunc("POST /login", noStore(s.login))
	mux.HandleFunc("GET /me", noStore(s.me))
	mux.HandleFunc("POST /logout", s.logout)
	mux.HandleFunc("POST /transfer", s.transfer)
	mux.HandleFunc("POST /__attack/plant-sid", s.plantSid)
	mux.HandleFunc("POST /__attack/as", s.attackAs)
	mux.HandleFunc("/", notFound)
	s.handler = cors(limitBody(trace.Middleware(hub, "01", "go", "app")(mux)))
	return s
}

// cors: one allowed origin (echoed only on exact match) with credentials. Identical in the TS lab.
func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Add("Vary", "Origin")
		if r.Header.Get("Origin") == allowedOrigin {
			h.Set("Access-Control-Allow-Origin", allowedOrigin)
			h.Set("Access-Control-Allow-Credentials", "true")
			h.Set("Access-Control-Expose-Headers", "Retry-After, WWW-Authenticate, Location")
			if r.Method == http.MethodOptions {
				h.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
				h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token, X-Lab-Mode")
			}
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// noStore: responses that carry credentials or identity must never sit in a shared or browser cache.
func noStore(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		h(w, r)
	}
}

// limitBody buffers at most maxBody bytes BEFORE the trace middleware (which reads whole bodies), else 413.
func limitBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, err := io.ReadAll(io.LimitReader(r.Body, maxBody+1))
		if err != nil || len(b) > maxBody {
			writeError(w, 413, "body too large")
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(b))
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	b, _ := json.Marshal(v) // json.Marshal (not Encoder): no trailing newline, so bodies match the TS lab byte for byte
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write(b)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func serverError(w http.ResponseWriter, err error) {
	log.Printf("internal error: %v", err)
	writeError(w, 500, "internal error")
}

func notFound(w http.ResponseWriter, r *http.Request) { writeError(w, 404, "not found") }

// vulnerable: per-request opt-in to the deliberately weak behaviour used by the attack demos.
func vulnerable(r *http.Request) bool { return r.Header.Get("X-Lab-Mode") == "vulnerable" }

// readJSON accepts only a JSON object sent as application/json.
func readJSON(w http.ResponseWriter, r *http.Request) (map[string]any, bool) {
	var m map[string]any
	dec := json.NewDecoder(r.Body)
	ct := strings.ToLower(strings.TrimSpace(strings.SplitN(r.Header.Get("Content-Type"), ";", 2)[0]))
	if ct != "application/json" || dec.Decode(&m) != nil || m == nil || dec.Decode(&struct{}{}) != io.EOF { // second decode: trailing garbage is an error
		writeError(w, 400, "invalid json")
		return nil, false
	}
	return m, true
}

func str(m map[string]any, k string) (string, bool) { s, ok := m[k].(string); return s, ok }

// credentials validates and normalizes the shared {email,password} body. lenient skips the 8-128 length rule (login).
func credentials(w http.ResponseWriter, m map[string]any, lenient bool) (email, password string, ok bool) {
	e, _ := str(m, "email")
	email = strings.ToLower(strings.TrimSpace(e))
	if !strings.Contains(email, "@") || utf8.RuneCountInString(email) > 254 {
		writeError(w, 400, "invalid email")
		return
	}
	password, isStr := str(m, "password")
	if n := utf8.RuneCountInString(password); !isStr || (!lenient && (n < 8 || n > 128)) {
		writeError(w, 400, "invalid password")
		return
	}
	return email, password, true
}

func (s *Server) index(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write(s.ui)
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	m, ok := readJSON(w, r)
	if !ok {
		return
	}
	email, password, ok := credentials(w, m, false)
	if !ok {
		return
	}
	phc, err := hashPassword(password)
	if err != nil {
		serverError(w, err)
		return
	}
	id, err := s.store.CreateUser(r.Context(), email, phc)
	switch {
	case errors.Is(err, errDuplicate):
		writeError(w, 409, "email already registered")
	case err != nil:
		serverError(w, err)
	default:
		writeJSON(w, 201, struct {
			ID    string `json:"id"`
			Email string `json:"email"`
		}{id, email})
	}
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	m, ok := readJSON(w, r)
	if !ok {
		return
	}
	email, password, ok := credentials(w, m, true)
	if !ok {
		return
	}
	ctx := r.Context()
	userID, outcome, retryAfter, err := s.store.Authenticate(ctx, email, func(phc string, found bool) bool {
		if !found {
			dummyVerify(password) // same cost as a real verify: unknown email must not be timing-distinguishable
			return false
		}
		return verifyPassword(phc, password)
	})
	switch {
	case err != nil:
		serverError(w, err)
		return
	case outcome == LoginBlocked:
		w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
		writeError(w, 429, "too many attempts")
		return
	case outcome == LoginRejected:
		writeError(w, 401, "invalid credentials") // identical for unknown email and wrong password
		return
	}

	incoming := ""
	if c, err := r.Cookie("sid"); err == nil {
		incoming = c.Value
	}
	token := newToken()
	if vulnerable(r) && sidRe.MatchString(incoming) {
		token = incoming // VULNERABLE: session fixation. The attacker-chosen id becomes the authenticated session.
	} else if incoming != "" {
		if err := s.store.DeleteSession(ctx, incoming); err != nil { // secure: rotate, and kill whatever session the client presented
			serverError(w, err)
			return
		}
	}
	csrf, err := s.store.CreateSession(ctx, token, userID)
	if err != nil {
		serverError(w, err)
		return
	}
	http.SetCookie(w, sessionCookie(token))
	writeJSON(w, 200, map[string]string{"csrfToken": csrf})
}

// auth returns the live session for the sid cookie, or writes 401.
func (s *Server) auth(w http.ResponseWriter, r *http.Request) *Session {
	c, err := r.Cookie("sid")
	if err == nil && c.Value != "" {
		sess, err := s.store.FindSession(r.Context(), c.Value)
		if err != nil {
			serverError(w, err)
			return nil
		}
		if sess != nil {
			return sess
		}
	}
	writeError(w, 401, "unauthorized")
	return nil
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	if sess := s.auth(w, r); sess != nil {
		writeJSON(w, 200, map[string]string{"email": sess.Email})
	}
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	sess := s.auth(w, r)
	if sess == nil {
		return
	}
	if !csrfEqual(r.Header.Get("X-CSRF-Token"), sess.CSRF) {
		writeError(w, 403, "csrf")
		return
	}
	c, _ := r.Cookie("sid")
	if err := s.store.DeleteSession(r.Context(), c.Value); err != nil {
		serverError(w, err)
		return
	}
	http.SetCookie(w, clearCookie())
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) transfer(w http.ResponseWriter, r *http.Request) {
	sess := s.auth(w, r)
	if sess == nil {
		return
	}
	if !vulnerable(r) && !csrfEqual(r.Header.Get("X-CSRF-Token"), sess.CSRF) { // VULNERABLE mode skips this check
		writeError(w, 403, "csrf")
		return
	}
	m, ok := readJSON(w, r)
	if !ok {
		return
	}
	to, _ := str(m, "to")
	amount, isNum := m["amount"].(float64)
	if to == "" || !isNum || amount <= 0 || math.IsInf(amount, 0) {
		writeError(w, 400, "invalid transfer")
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true}) // demo only: no balances are kept
}

// attackOnly 404s unless the request opted into vulnerable mode, so the helpers are invisible by default.
func attackOnly(w http.ResponseWriter, r *http.Request) (map[string]any, bool) {
	if !vulnerable(r) {
		notFound(w, r)
		return nil, false
	}
	return readJSON(w, r)
}

// plantSid simulates cookie injection: browsers forbid scripts setting Cookie headers, so the lab does it.
func (s *Server) plantSid(w http.ResponseWriter, r *http.Request) {
	m, ok := attackOnly(w, r)
	if !ok {
		return
	}
	sid, _ := str(m, "sid")
	if !sidRe.MatchString(sid) {
		writeError(w, 400, "invalid sid")
		return
	}
	http.SetCookie(w, sessionCookie(sid))
	writeJSON(w, 200, map[string]bool{"ok": true})
}

// attackAs replays a GET carrying the given sid, in-process through the full handler (no network loopback).
// The replay is traced like any request, so the Inspector shows it as its own event.
func (s *Server) attackAs(w http.ResponseWriter, r *http.Request) {
	m, ok := attackOnly(w, r)
	if !ok {
		return
	}
	sid, _ := str(m, "sid")
	path, _ := str(m, "path")
	if !sidRe.MatchString(sid) || !strings.HasPrefix(path, "/") || strings.HasPrefix(path, "/__") {
		writeError(w, 400, "invalid sid or path")
		return
	}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, "http://lab.local"+path, http.NoBody) // trace middleware reads r.Body: never nil
	if err != nil {
		writeError(w, 400, "invalid sid or path")
		return
	}
	req.Header.Set("Cookie", "sid="+sid)
	rec := httptest.NewRecorder()
	s.handler.ServeHTTP(rec, req)
	writeJSON(w, 200, struct {
		Status int    `json:"status"`
		Body   string `json:"body"`
	}{rec.Code, rec.Body.String()})
}
