package main

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"unicode/utf8"

	"authacademy/trace"
)

const (
	allowedOrigin = "http://localhost:3000"
	maxBody       = 1 << 20
)

type Server struct {
	store   *Store
	handler http.Handler // full stack: CORS + body cap + trace + routes
}

func newServer(store *Store, hub *trace.Hub) *Server {
	s := &Server{store: store}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, map[string]bool{"ok": true}) })
	mux.HandleFunc("GET /__trace", hub.SSE())
	mux.HandleFunc("GET /.well-known/jwks.json", s.jwks)
	mux.HandleFunc("POST /login", noStore(s.login))
	mux.HandleFunc("GET /api/profile", noStore(s.profile))
	mux.HandleFunc("POST /refresh", noStore(s.refresh))
	mux.HandleFunc("POST /refresh/logout", s.logout) // under /refresh because the rt cookie is only sent to Path=/refresh
	mux.HandleFunc("POST /__attack/sign", s.attackSign)
	mux.HandleFunc("/", notFound)
	s.handler = cors(limitBody(trace.Middleware(hub, "02", "go", "app")(mux)))
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

// noStore: responses that carry tokens or identity must never sit in a shared or browser cache.
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

func (s *Server) jwks(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, s.store.keys.JWKS()) }

type tokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	m, ok := readJSON(w, r)
	if !ok {
		return
	}
	e, _ := str(m, "email")
	email := strings.ToLower(strings.TrimSpace(e))
	if !strings.Contains(email, "@") || utf8.RuneCountInString(email) > 254 {
		writeError(w, 400, "invalid email")
		return
	}
	password, isStr := str(m, "password")
	if !isStr {
		writeError(w, 400, "invalid password")
		return
	}
	userID, phc, found, err := s.store.FindUser(r.Context(), email)
	if err != nil {
		serverError(w, err)
		return
	}
	if !found {
		dummyVerify(password) // same cost as a real verify: unknown email must not be timing-distinguishable
	}
	if !found || !verifyPassword(phc, password) {
		writeError(w, 401, "invalid credentials") // identical for unknown email and wrong password
		return
	}
	access, err := issueAccess(s.store.keys, userID, email)
	if err != nil {
		serverError(w, err)
		return
	}
	rt, err := s.store.NewFamily(r.Context(), userID)
	if err != nil {
		serverError(w, err)
		return
	}
	http.SetCookie(w, refreshCookie(rt))
	writeJSON(w, 200, tokenResponse{access, "Bearer", accessTTL})
}

// bearerUnauthorized: RFC 6750. No credentials at all → bare `Bearer`; a bad token → error="invalid_token".
func bearerUnauthorized(w http.ResponseWriter, hadToken bool) {
	if hadToken {
		w.Header().Set("WWW-Authenticate", `Bearer error="invalid_token"`)
		writeError(w, 401, "invalid token")
		return
	}
	w.Header().Set("WWW-Authenticate", "Bearer")
	writeError(w, 401, "unauthorized")
}

func (s *Server) profile(w http.ResponseWriter, r *http.Request) {
	scheme, token, _ := strings.Cut(r.Header.Get("Authorization"), " ")
	token = strings.TrimSpace(token)
	if !strings.EqualFold(scheme, "Bearer") || token == "" {
		bearerUnauthorized(w, false)
		return
	}
	var claims map[string]any
	var err error
	if vulnerable(r) {
		claims, err = naiveVerify(token, s.store.keys) // VULNERABLE: trusts the token's own alg, ignores exp/aud/iss (see naive.go)
	} else {
		claims, err = verifyAccess(s.store.keys, token)
	}
	if err != nil {
		bearerUnauthorized(w, true)
		return
	}
	sub, _ := claims["sub"].(string)
	email, _ := claims["email"].(string)
	writeJSON(w, 200, map[string]string{"sub": sub, "email": email})
}

func (s *Server) refresh(w http.ResponseWriter, r *http.Request) {
	c, err := r.Cookie("rt")
	if err != nil || c.Value == "" {
		writeError(w, 401, "invalid refresh token")
		return
	}
	userID, email, next, ok, err := s.store.Rotate(r.Context(), c.Value)
	if err != nil {
		serverError(w, err)
		return
	}
	if !ok {
		writeError(w, 401, "invalid refresh token")
		return
	}
	access, err := issueAccess(s.store.keys, userID, email)
	if err != nil {
		serverError(w, err)
		return
	}
	http.SetCookie(w, refreshCookie(next))
	writeJSON(w, 200, tokenResponse{access, "Bearer", accessTTL})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie("rt"); err == nil && c.Value != "" {
		if err := s.store.RevokeFamily(r.Context(), c.Value); err != nil {
			serverError(w, err)
			return
		}
	}
	http.SetCookie(w, clearRefreshCookie())
	w.WriteHeader(http.StatusNoContent)
}

// attackSign forges a token for the demos. It 404s unless the request opted into vulnerable mode.
func (s *Server) attackSign(w http.ResponseWriter, r *http.Request) {
	if !vulnerable(r) {
		notFound(w, r)
		return
	}
	m, ok := readJSON(w, r)
	if !ok {
		return
	}
	mode, _ := str(m, "mode")
	header, hOK := optObject(m, "header")
	payload, pOK := optObject(m, "payload")
	if !hOK || !pOK {
		writeError(w, 400, "header and payload must be objects")
		return
	}
	token, err := forge(s.store.keys, mode, header, payload)
	if err != nil {
		writeError(w, 400, "mode must be none, hs256-with-public-key or expired")
		return
	}
	writeJSON(w, 200, map[string]string{"token": token})
}

// optObject: a missing key is fine (nil map); a present non-object is not.
func optObject(m map[string]any, k string) (map[string]any, bool) {
	v, present := m[k]
	if !present || v == nil {
		return nil, true
	}
	o, ok := v.(map[string]any)
	return o, ok
}
