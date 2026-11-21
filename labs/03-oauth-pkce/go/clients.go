package main

import (
	"crypto/sha256"
	"crypto/subtle"
	"slices"
	"strings"
)

// Client is static configuration: this lab has no client registration endpoint.
type Client struct {
	ID           string
	Name         string
	Secret       string // empty for a public client
	RedirectURIs []string
	Scopes       []string // the most this client may ever be granted
	Grants       []string
}

func (c *Client) Public() bool { return c.Secret == "" }

// Label is how the pages name the client: friendly name plus the id the contract is written in.
func (c *Client) Label() string { return c.Name + " (" + c.ID + ")" }

var clients = map[string]*Client{
	// demo-spa: a browser app. It cannot keep a secret, so PKCE is what protects its codes.
	"demo-spa": {
		ID: "demo-spa", Name: "Demo SPA",
		RedirectURIs: []string{"http://localhost:4113/callback", "http://localhost:4213/callback"},
		Scopes:       []string{"photos.read", "profile"},
		Grants:       []string{"authorization_code"},
	},
	// demo-backend: a server process with a secret and no user.
	"demo-backend": {
		ID: "demo-backend", Name: "Demo backend", Secret: "lab-secret",
		Scopes: []string{"photos.read"},
		Grants: []string{"client_credentials"},
	},
}

func (c *Client) allows(grant string) bool { return slices.Contains(c.Grants, grant) }

// redirectOK: EXACT string comparison against the registered URIs (RFC 6749 §3.1.2.3 / OAuth 2.1).
// The vulnerable mode degrades it to a prefix match, which is how "…/callback/../evil" style bypasses happen.
func (c *Client) redirectOK(uri string, vulnerable bool) bool {
	return slices.ContainsFunc(c.RedirectURIs, func(registered string) bool {
		if vulnerable {
			return strings.HasPrefix(uri, registered)
		}
		return uri == registered
	})
}

// secretOK compares in constant time (digests first, so the length does not leak either). A public client never matches.
func (c *Client) secretOK(secret string) bool {
	if c.Public() {
		return false
	}
	a, b := sha256.Sum256([]byte(c.Secret)), sha256.Sum256([]byte(secret))
	return subtle.ConstantTimeCompare(a[:], b[:]) == 1
}

// parseScope splits a space-delimited scope, dropping duplicates. ok is false when nothing is left.
func parseScope(s string) (scopes []string, ok bool) {
	for _, f := range strings.Fields(s) {
		if !slices.Contains(scopes, f) {
			scopes = append(scopes, f)
		}
	}
	return scopes, len(scopes) > 0
}

func subset(requested, allowed []string) bool {
	return !slices.ContainsFunc(requested, func(s string) bool { return !slices.Contains(allowed, s) })
}

// scopeInfo is the human text on the consent page.
var scopeInfo = map[string]string{
	"photos.read": "View your photos",
	"profile":     "View your basic profile",
}
