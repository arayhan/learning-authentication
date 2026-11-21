package main

import (
	"html/template"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
)

// The AS pages are server-rendered with html/template (contextual escaping), never string concatenation.
const style = `
  :root { --bg:#fafafa; --card:#fff; --fg:#18181b; --muted:#71717a; --line:#e4e4e7; --accent:#4f46e5; --accent-fg:#fff; --bad:#b91c1c; }
  @media (prefers-color-scheme: dark) { :root { --bg:#09090b; --card:#18181b; --fg:#fafafa; --muted:#a1a1aa; --line:#27272a; --accent:#818cf8; --accent-fg:#09090b; --bad:#f87171; } }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:16px; background:var(--bg); color:var(--fg); font:15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { width:100%; max-width:380px; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:24px; }
  h1 { margin:0 0 4px; font-size:18px; }
  p.sub { margin:0 0 20px; color:var(--muted); font-size:13px; }
  label { display:block; margin:0 0 12px; font-size:13px; color:var(--muted); }
  input[type=email], input[type=password] { display:block; width:100%; margin-top:4px; padding:8px 10px; font:inherit; color:var(--fg); background:var(--bg); border:1px solid var(--line); border-radius:8px; }
  input:focus-visible, button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  ul { margin:0 0 16px; padding:0; list-style:none; border:1px solid var(--line); border-radius:8px; }
  li { padding:8px 12px; font-size:14px; } li + li { border-top:1px solid var(--line); }
  li code { font:12px ui-monospace, "JetBrains Mono", Consolas, monospace; color:var(--muted); display:block; }
  .row { display:flex; gap:8px; margin-top:16px; }
  button { flex:1; padding:8px 12px; font:inherit; font-weight:500; cursor:pointer; color:var(--fg); background:transparent; border:1px solid var(--line); border-radius:8px; }
  button.primary { color:var(--accent-fg); background:var(--accent); border-color:var(--accent); }
  .err { margin:0 0 12px; color:var(--bad); font-size:13px; }
`

var pageTmpl = template.Must(template.New("").Parse(`
{{define "head"}}<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{{.Title}}</title><style>` + style + `</style></head><body><main>{{end}}
{{define "login"}}{{template "head" .}}
<h1>Sign in</h1><p class="sub">to continue to <strong>{{.Client}}</strong></p>
{{if .Error}}<p class="err" role="alert">{{.Error}}</p>{{end}}
<form action="/login" method="post">
<input type="hidden" name="rid" value="{{.Rid}}">
<label>Email<input type="email" name="email" autocomplete="username" required></label>
<label>Password<input type="password" name="password" autocomplete="current-password" required></label>
<div class="row"><button class="primary" type="submit">Sign in</button></div>
</form></main></body></html>{{end}}
{{define "consent"}}{{template "head" .}}
<h1>Authorize access</h1><p class="sub"><strong>{{.Client}}</strong> wants to access your account.</p>
<ul>{{range .Scopes}}<li>{{.Text}}<code>{{.Name}}</code></li>{{end}}</ul>
<form action="/consent" method="post">
<input type="hidden" name="rid" value="{{.Rid}}">
<input type="hidden" name="csrf" value="{{.CSRF}}">
<div class="row"><button type="submit" name="decision" value="deny">Deny</button><button class="primary" type="submit" name="decision" value="approve">Approve</button></div>
</form></main></body></html>{{end}}
{{define "error"}}{{template "head" .}}
<h1>{{.Title}}</h1><p class="sub">{{.Message}}</p></main></body></html>{{end}}
`))

type scopeView struct{ Name, Text string }

type pageData struct {
	Title, Message, Client, Rid, CSRF, Error string
	Scopes                                   []scopeView
}

// htmlPage: rendered pages are never cached and never framed (clickjacking on the consent button).
func htmlPage(w http.ResponseWriter, status int, name string, d pageData) {
	h := w.Header()
	h.Set("Content-Type", "text/html; charset=utf-8")
	h.Set("Cache-Control", "no-store")
	h.Set("X-Frame-Options", "DENY")
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'")
	w.WriteHeader(status)
	if d.Title == "" {
		d.Title = "Authorization server"
	}
	pageTmpl.ExecuteTemplate(w, name, d)
}

// errorPage is what /authorize shows when the client or redirect_uri cannot be trusted: nothing here is echoed
// from the request, and the browser is never redirected.
func errorPage(w http.ResponseWriter, status int, title, message string) {
	htmlPage(w, status, "error", pageData{Title: title, Message: message})
}

func scopeViews(scopes []string) []scopeView {
	out := make([]scopeView, len(scopes))
	for i, s := range scopes {
		out[i] = scopeView{s, scopeInfo[s]}
		if out[i].Text == "" {
			out[i].Text = s
		}
	}
	return out
}

// spaPath finds the shared client page. `go run ./labs/03-oauth-pkce/go` runs from the repo root, but the
// source file's own directory is the dependable anchor.
func spaPath() string {
	if p := os.Getenv("SPA_PATH"); p != "" {
		return p
	}
	if _, file, _, ok := runtime.Caller(0); ok {
		if p := filepath.Join(filepath.Dir(file), "..", "client-spa", "index.html"); fileExists(p) {
			return p
		}
	}
	return filepath.Join("labs", "03-oauth-pkce", "client-spa", "index.html")
}

func fileExists(p string) bool { _, err := os.Stat(p); return err == nil }

// serveSPA reads the file on every request, so editing index.html needs no restart.
func serveSPA(w http.ResponseWriter, r *http.Request) {
	b, err := os.ReadFile(spaPath())
	if err != nil {
		writeError(w, 500, "client page missing")
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Write(b)
}
