package main

import (
	"bytes"
	"crypto/subtle"
	"encoding/json"
	"io"
	"log"
	"mime"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	issuer    = "http://localhost:4103" // the same string in the TS lab, whatever port that one listens on
	audience  = "lab03-api"
	accessTTL = 300 // seconds
	maxBody   = 1 << 20

	sessionTTL = 8 * time.Hour
	pendingTTL = 10 * time.Minute
)

// corsOrigins: exact matches only, identical in the TS lab.
var corsOrigins = map[string]bool{
	"http://localhost:3000": true, // the academy
	"http://localhost:4113": true, // the SPA served by the Go lab
	"http://localhost:4213": true, // the SPA served by the TS lab
}

// session is a logged-in user at the authorization server (not at the client app).
type session struct {
	userID string
	csrf   string // bound to this session; the consent form must echo it
	exp    time.Time
}

// pending is an authorization request that passed validation and is waiting for login and consent. It lives
// on the server, keyed by a random id: the browser only ever carries that id, never the parameters, so the
// forms cannot be edited to change the client, redirect_uri, scope or challenge.
type pending struct {
	clientID, redirectURI, scope, state string
	challenge                           *string
	session                             string // "" until the user logs in
	exp                                 time.Time
}

type Server struct {
	store *Store

	// shortcut: in-memory AS sessions, fine for a single-process lab
	mu       sync.Mutex
	sessions map[string]*session
	pend     map[string]*pending
}

func (s *Server) newSession(userID string) (string, *session) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for k, v := range s.sessions {
		if now.After(v.exp) {
			delete(s.sessions, k)
		}
	}
	sid, sess := newToken(), &session{userID: userID, csrf: newToken(), exp: now.Add(sessionTTL)}
	s.sessions[sid] = sess
	return sid, sess
}

func (s *Server) session(sid string) *session {
	s.mu.Lock()
	defer s.mu.Unlock()
	if v := s.sessions[sid]; v != nil && time.Now().Before(v.exp) {
		return v
	}
	return nil
}

func (s *Server) sessionFrom(r *http.Request) (string, *session) {
	c, err := r.Cookie("as_sid")
	if err != nil || c.Value == "" {
		return "", nil
	}
	return c.Value, s.session(c.Value)
}

func (s *Server) newPending(p *pending) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for k, v := range s.pend {
		if now.After(v.exp) {
			delete(s.pend, k)
		}
	}
	rid := newToken()
	p.exp = now.Add(pendingTTL)
	s.pend[rid] = p
	return rid
}

// livePending must be called with s.mu held.
func (s *Server) livePending(rid string) *pending {
	if p := s.pend[rid]; p != nil && time.Now().Before(p.exp) {
		return p
	}
	return nil
}

// bindPending ties a still-unowned request to the session that just logged in.
func (s *Server) bindPending(rid, sid string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	p := s.livePending(rid)
	if p == nil || p.session != "" {
		return false
	}
	p.session = sid
	return true
}

// consumePending removes and returns the request, but only for the session it is bound to: single use.
func (s *Server) consumePending(rid, sid string) *pending {
	s.mu.Lock()
	defer s.mu.Unlock()
	p := s.livePending(rid)
	if p == nil || p.session == "" || p.session != sid {
		return nil
	}
	delete(s.pend, rid)
	return p
}

// peekPending returns the request without consuming it (used to render the login page again).
func (s *Server) peekPending(rid string) *pending {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.livePending(rid)
}

// ---- generic HTTP helpers (same shapes as lab02) ----

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Add("Vary", "Origin")
		if o := r.Header.Get("Origin"); corsOrigins[o] {
			h.Set("Access-Control-Allow-Origin", o)
			h.Set("Access-Control-Allow-Credentials", "true")
			h.Set("Access-Control-Expose-Headers", "WWW-Authenticate, Location")
			if r.Method == http.MethodOptions {
				h.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
				h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Lab-Mode")
			}
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
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
func readJSON(r *http.Request) (map[string]any, bool) {
	var m map[string]any
	dec := json.NewDecoder(r.Body)
	ct, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if ct != "application/json" || dec.Decode(&m) != nil || m == nil || dec.Decode(&struct{}{}) != io.EOF { // second decode: trailing garbage is an error
		return nil, false
	}
	return m, true
}

func (s *Server) jwks(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, s.store.keys.JWKS()) }

// ---- /authorize, /login, /consent ----

// redirectTo sends the browser back to the (already validated) redirect_uri with extra query parameters.
func redirectTo(w http.ResponseWriter, redirectURI, state string, params map[string]string) {
	u, err := url.Parse(redirectURI)
	if err != nil {
		errorPage(w, 400, "Invalid request", "The redirect URI cannot be used.")
		return
	}
	q := u.Query()
	for k, v := range params {
		q.Set(k, v)
	}
	if state != "" {
		q.Set("state", state)
	}
	u.RawQuery = q.Encode()
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Location", u.String())
	w.WriteHeader(http.StatusFound)
}

// authorize validates the request in the order of RFC 6749 §4.1.2.1: first the two things that make a redirect
// unsafe (client_id, redirect_uri), which get an error PAGE and no redirect; only then errors that are reported
// to the client by redirecting back with ?error=…&state=….
func (s *Server) authorize(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	// lab_mode in the QUERY: a browser navigation cannot add the X-Lab-Mode header.
	vuln := q.Get("lab_mode") == "vulnerable"
	c, redirectURI := clients[q.Get("client_id")], q.Get("redirect_uri")
	if c == nil || !c.allows("authorization_code") || !c.redirectOK(redirectURI, vuln) {
		errorPage(w, 400, "Invalid request", "The client or the redirect URI is not registered.")
		return
	}
	state := q.Get("state")
	fail := func(code string) { redirectTo(w, redirectURI, state, map[string]string{"error": code}) }

	if q.Get("response_type") != "code" {
		fail("unsupported_response_type")
		return
	}
	// PKCE is required, S256 only. The vulnerable mode lets a request with no PKCE parameters through.
	var challenge *string
	if cc, method := q.Get("code_challenge"), q.Get("code_challenge_method"); !vuln || cc != "" || method != "" {
		if method != "S256" || !challengeRe.MatchString(cc) {
			fail("invalid_request")
			return
		}
		challenge = &cc
	}
	scopes, ok := parseScope(q.Get("scope"))
	if !ok || !subset(scopes, c.Scopes) {
		fail("invalid_scope")
		return
	}

	rid := s.newPending(&pending{clientID: c.ID, redirectURI: redirectURI, scope: strings.Join(scopes, " "), state: state, challenge: challenge})
	if sid, sess := s.sessionFrom(r); sess != nil {
		s.bindPending(rid, sid)
		htmlPage(w, 200, "consent", pageData{Client: c.Label(), Rid: rid, CSRF: sess.csrf, Scopes: scopeViews(scopes)})
		return
	}
	htmlPage(w, 200, "login", pageData{Client: c.Label(), Rid: rid})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	rid := r.PostFormValue("rid")
	p := s.peekPending(rid)
	if p == nil || p.session != "" {
		errorPage(w, 400, "Invalid request", "This sign-in request has expired. Start again from the app.")
		return
	}
	client := clients[p.clientID]
	email := strings.ToLower(strings.TrimSpace(r.PostFormValue("email")))
	password := r.PostFormValue("password")
	userID, phc, found, err := s.store.FindUser(r.Context(), email)
	if err != nil {
		serverError(w, err)
		return
	}
	if !found {
		dummyVerify(password) // same cost as a real verify: unknown email must not be timing-distinguishable
	}
	if !found || !verifyPassword(phc, password) {
		htmlPage(w, 401, "login", pageData{Client: client.Label(), Rid: rid, Error: "Invalid email or password."}) // identical for unknown email and wrong password
		return
	}
	sid, sess := s.newSession(userID)
	if !s.bindPending(rid, sid) {
		errorPage(w, 400, "Invalid request", "This sign-in request has expired. Start again from the app.")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "as_sid", Value: sid, Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode})
	scopes, _ := parseScope(p.scope)
	htmlPage(w, 200, "consent", pageData{Client: client.Label(), Rid: rid, CSRF: sess.csrf, Scopes: scopeViews(scopes)})
}

func (s *Server) consent(w http.ResponseWriter, r *http.Request) {
	// 1. Who is asking, and did the consent page they came from belong to them? (CSRF)
	sid, sess := s.sessionFrom(r)
	if sess == nil || subtle.ConstantTimeCompare([]byte(r.PostFormValue("csrf")), []byte(sess.csrf)) != 1 {
		errorPage(w, 403, "Forbidden", "Missing or invalid form token.")
		return
	}
	decision := r.PostFormValue("decision")
	if decision != "approve" && decision != "deny" {
		errorPage(w, 400, "Invalid request", "Unknown decision.")
		return
	}
	// 2. The pending request is taken exactly once, and only by the session it was created for.
	p := s.consumePending(r.PostFormValue("rid"), sid)
	if p == nil {
		errorPage(w, 400, "Invalid request", "This authorization request has expired or was already answered.")
		return
	}
	if decision == "deny" {
		redirectTo(w, p.redirectURI, p.state, map[string]string{"error": "access_denied"})
		return
	}
	code := newToken()
	err := s.store.SaveCode(r.Context(), code, CodeGrant{ClientID: p.clientID, RedirectURI: p.redirectURI, Scope: p.scope, UserID: sess.userID, Challenge: p.challenge})
	if err != nil {
		serverError(w, err)
		return
	}
	redirectTo(w, p.redirectURI, p.state, map[string]string{"code": code})
}

// ---- /token ----

type tokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
	Scope       string `json:"scope"`
}

// tokenJSON: RFC 6749 §5.1 requires these two headers on every token response, success or error.
func tokenJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")
	writeJSON(w, status, v)
}

func tokenError(w http.ResponseWriter, status int, code string) {
	if code == "invalid_client" {
		w.Header().Set("WWW-Authenticate", `Basic realm="lab03"`)
	}
	tokenJSON(w, status, map[string]string{"error": code})
}

// issueAccess signs an RS256 access token. The kid header tells verifiers which JWKS key to use.
func issueAccess(k *Keys, sub, clientID, scope, jti string) (string, error) {
	now := time.Now().Unix()
	t := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"iss": issuer, "aud": audience, "sub": sub, "client_id": clientID, "scope": scope,
		"iat": now, "exp": now + accessTTL, "jti": jti,
	})
	t.Header["kid"] = k.KID
	return t.SignedString(k.Private)
}

func (s *Server) token(w http.ResponseWriter, r *http.Request) {
	// The X-Lab-Mode header changes nothing here on purpose: the token rules (PKCE verifier for a code that has a
	// challenge, exact redirect_uri, single use) are the same in every mode. The weakness is created at /authorize.
	if ct, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type")); ct != "application/x-www-form-urlencoded" || r.ParseForm() != nil {
		tokenError(w, 400, "invalid_request")
		return
	}
	f := r.PostForm
	switch f.Get("grant_type") {
	case "":
		tokenError(w, 400, "invalid_request")
	case "authorization_code":
		s.codeGrant(w, r, f)
	case "client_credentials":
		s.clientCredentials(w, r, f)
	default:
		tokenError(w, 400, "unsupported_grant_type")
	}
}

func (s *Server) codeGrant(w http.ResponseWriter, r *http.Request, f url.Values) {
	clientID := f.Get("client_id")
	if clientID == "" {
		tokenError(w, 400, "invalid_request")
		return
	}
	c := clients[clientID]
	if c == nil {
		tokenError(w, 401, "invalid_client")
		return
	}
	if !c.allows("authorization_code") {
		tokenError(w, 400, "unauthorized_client")
		return
	}
	code, redirectURI := f.Get("code"), f.Get("redirect_uri")
	if code == "" || redirectURI == "" {
		tokenError(w, 400, "invalid_request")
		return
	}
	s.exchange(w, r, c.ID, code, redirectURI, f.Get("code_verifier"))
}

// exchange redeems a code and answers with the token response. Shared with the attack helper.
func (s *Server) exchange(w http.ResponseWriter, r *http.Request, clientID, code, redirectURI, verifier string) {
	jti := newToken()
	scope, userID, oerr, err := s.store.Redeem(r.Context(), code, clientID, redirectURI, verifier, jti)
	if err != nil {
		serverError(w, err)
		return
	}
	if oerr != "" {
		tokenError(w, 400, oerr)
		return
	}
	access, err := issueAccess(s.store.keys, userID, clientID, scope, jti)
	if err != nil {
		serverError(w, err)
		return
	}
	tokenJSON(w, 200, tokenResponse{access, "Bearer", accessTTL, scope})
}

func (s *Server) clientCredentials(w http.ResponseWriter, r *http.Request, f url.Values) {
	id, secret, ok := r.BasicAuth()
	c := clients[id]
	if !ok || c == nil || !c.allows("client_credentials") || !c.secretOK(secret) {
		tokenError(w, 401, "invalid_client")
		return
	}
	scope := c.Scopes
	if raw := f.Get("scope"); raw != "" {
		req, ok := parseScope(raw)
		if !ok || !subset(req, c.Scopes) {
			tokenError(w, 400, "invalid_scope")
			return
		}
		scope = req
	}
	jti, granted := newToken(), strings.Join(scope, " ")
	access, err := issueAccess(s.store.keys, c.ID, c.ID, granted, jti) // sub is the client itself: there is no user
	if err == nil {
		err = s.store.RecordClientToken(r.Context(), jti)
	}
	if err != nil {
		serverError(w, err)
		return
	}
	tokenJSON(w, 200, tokenResponse{access, "Bearer", accessTTL, granted})
}

// attackIntercept plays the malicious app that stole an authorization code from the redirect URL. It knows the
// code and the redirect_uri it saw there, but not the PKCE verifier. 404 unless the request opted into vulnerable mode.
func (s *Server) attackIntercept(w http.ResponseWriter, r *http.Request) {
	if !vulnerable(r) {
		notFound(w, r)
		return
	}
	m, ok := readJSON(r)
	code, isStr := m["code"].(string)
	if !ok || !isStr || code == "" {
		tokenError(w, 400, "invalid_request")
		return
	}
	redirectURI, err := s.store.CodeRedirectURI(r.Context(), code)
	if err != nil {
		serverError(w, err)
		return
	}
	s.exchange(w, r, "demo-spa", code, redirectURI, "") // no verifier
}
