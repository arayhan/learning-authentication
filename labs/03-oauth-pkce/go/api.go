package main

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	jwksTTL      = 5 * time.Minute  // how long a fetched key set is trusted
	jwksCooldown = 30 * time.Second // an unknown kid triggers a refetch, but not more often than this
	leeway       = 30 * time.Second
	scopePhotos  = "photos.read"
)

// jwksCache is how the resource API learns the AS's public key: it fetches the JWKS from the AS listener
// (the API never touches lab03.keys) and keeps it for 5 minutes.
type jwksCache struct {
	url     string
	mu      sync.Mutex
	keys    map[string]*rsa.PublicKey
	fetched time.Time
}

var errUnknownKey = errors.New("no such key")

func (c *jwksCache) key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	age := time.Since(c.fetched)
	if k := c.keys[kid]; k != nil && age < jwksTTL {
		return k, nil
	}
	if c.keys != nil && age < jwksCooldown { // fresh enough: this kid really is unknown
		return nil, errUnknownKey
	}
	keys, err := fetchJWKS(ctx, c.url)
	if err != nil {
		return nil, err
	}
	c.keys, c.fetched = keys, time.Now()
	if k := keys[kid]; k != nil {
		return k, nil
	}
	return nil, errUnknownKey
}

func fetchJWKS(ctx context.Context, url string) (map[string]*rsa.PublicKey, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return nil, fmt.Errorf("jwks: status %d", res.StatusCode)
	}
	var set jwks
	if err := json.NewDecoder(res.Body).Decode(&set); err != nil {
		return nil, err
	}
	out := map[string]*rsa.PublicKey{}
	for _, k := range set.Keys {
		n, err1 := base64.RawURLEncoding.DecodeString(k.N)
		e, err2 := base64.RawURLEncoding.DecodeString(k.E)
		if k.Kty != "RSA" || err1 != nil || err2 != nil {
			continue
		}
		out[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: int(new(big.Int).SetBytes(e).Int64())}
	}
	return out, nil
}

// API is the resource server. It shares the DB only to see revocations; keys come from the AS over HTTP.
type API struct {
	store *Store
	jwks  *jwksCache
}

func newAPI(store *Store, asBase string) *API {
	return &API{store: store, jwks: &jwksCache{url: asBase + "/.well-known/jwks.json"}}
}

// verify pins RS256 (the token's own alg is never trusted), takes the key by kid from the AS JWKS, and requires
// exp plus the expected iss and aud.
func (a *API) verify(ctx context.Context, token string) (jwt.MapClaims, error) {
	claims := jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		kid, _ := t.Header["kid"].(string)
		return a.jwks.key(ctx, kid)
	},
		jwt.WithValidMethods([]string{"RS256"}),
		jwt.WithExpirationRequired(),
		jwt.WithIssuer(issuer),
		jwt.WithAudience(audience),
		jwt.WithLeeway(leeway),
	)
	return claims, err
}

// RFC 6750: no credentials at all → bare `Bearer`; a bad token → error="invalid_token".
func bearerUnauthorized(w http.ResponseWriter, hadToken bool) {
	if hadToken {
		w.Header().Set("WWW-Authenticate", `Bearer error="invalid_token"`)
		writeError(w, 401, "invalid_token")
		return
	}
	w.Header().Set("WWW-Authenticate", "Bearer")
	writeError(w, 401, "unauthorized")
}

type photo struct {
	ID    int    `json:"id"`
	Title string `json:"title"`
}

func (a *API) photos(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	scheme, token, _ := strings.Cut(r.Header.Get("Authorization"), " ")
	token = strings.TrimSpace(token)
	if !strings.EqualFold(scheme, "Bearer") || token == "" {
		bearerUnauthorized(w, false)
		return
	}
	claims, err := a.verify(r.Context(), token)
	if err != nil {
		// shortcut: an unreachable AS also lands here as 401; a real API would answer 503 and alert
		bearerUnauthorized(w, true)
		return
	}
	if jti, _ := claims["jti"].(string); jti != "" {
		revoked, err := a.store.Revoked(r.Context(), jti)
		if err != nil {
			serverError(w, err)
			return
		}
		if revoked { // code reuse revoked this token at the AS
			bearerUnauthorized(w, true)
			return
		}
	}
	scope, _ := claims["scope"].(string)
	if !slices.Contains(strings.Fields(scope), scopePhotos) {
		w.Header().Set("WWW-Authenticate", `Bearer error="insufficient_scope", scope="photos.read"`)
		writeError(w, 403, "insufficient_scope")
		return
	}
	writeJSON(w, 200, map[string][]photo{"photos": {{1, "Sunrise over the bay"}, {2, "Harbour at dusk"}, {3, "Mountain ridge"}}})
}
