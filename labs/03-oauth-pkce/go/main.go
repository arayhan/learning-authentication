// Lab 03 (Go): OAuth 2.0 authorization server + PKCE, a public SPA client and a resource API: three listeners,
// one process. Contract: see labs/contract/lab03.test.ts.
package main

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"time"

	"authacademy/trace"
)

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

// handlers wires the three listeners onto ONE trace hub; only the AS serves /__trace.
func newHandlers(store *Store, hub *trace.Hub, asBase string) (as, client, api http.Handler) {
	s := &Server{store: store, sessions: map[string]*session{}, pend: map[string]*pending{}}
	a := newAPI(store, asBase)

	asMux := http.NewServeMux()
	asMux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, map[string]bool{"ok": true}) })
	asMux.HandleFunc("GET /__trace", hub.SSE())
	asMux.HandleFunc("GET /.well-known/jwks.json", s.jwks)
	asMux.HandleFunc("GET /authorize", s.authorize)
	asMux.HandleFunc("POST /login", s.login)
	asMux.HandleFunc("POST /consent", s.consent)
	asMux.HandleFunc("POST /token", s.token)
	asMux.HandleFunc("POST /__attack/intercept", s.attackIntercept)
	asMux.HandleFunc("/", notFound)

	clientMux := http.NewServeMux()
	clientMux.HandleFunc("GET /{$}", serveSPA)
	clientMux.HandleFunc("GET /callback", serveSPA)
	clientMux.HandleFunc("/", notFound)

	apiMux := http.NewServeMux()
	apiMux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, map[string]bool{"ok": true}) })
	apiMux.HandleFunc("GET /api/photos", a.photos)
	apiMux.HandleFunc("/", notFound)

	as = cors(limitBody(trace.Middleware(hub, "03", "go", "as")(asMux)))
	client = limitBody(trace.Middleware(hub, "03", "go", "client")(clientMux))
	api = cors(limitBody(trace.Middleware(hub, "03", "go", "api")(apiMux)))
	return
}

func main() {
	if err := initDummyHash(); err != nil {
		log.Fatalf("lab03: dummy hash: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	store, err := openStore(ctx, env("DATABASE_URL", "postgres://academy:academy@localhost:5433/labs"))
	cancel()
	if err != nil {
		log.Fatalf("lab03: database: %v", err)
	}

	asPort := env("PORT", "4103")
	n, err := strconv.Atoi(asPort)
	if err != nil {
		log.Fatalf("lab03: bad PORT %q", asPort)
	}
	clientPort, apiPort := env("CLIENT_PORT", strconv.Itoa(n+10)), env("API_PORT", strconv.Itoa(n+20))
	as, client, api := newHandlers(store, trace.NewHub(200), "http://127.0.0.1:"+asPort)

	// Loopback only: the vulnerable mode must never be reachable off-machine. Bind all three BEFORE serving, so
	// /healthz on the AS port means the client and API ports are open too.
	type listener struct {
		ln net.Listener
		h  http.Handler
	}
	var ls []listener
	for name, l := range map[string]struct {
		port string
		h    http.Handler
	}{"as": {asPort, as}, "client": {clientPort, client}, "api": {apiPort, api}} {
		ln, err := net.Listen("tcp", "127.0.0.1:"+l.port)
		if err != nil {
			log.Fatalf("lab03: %s: %v", name, err)
		}
		log.Printf("lab03 (go) %s listening on http://%s", name, ln.Addr())
		ls = append(ls, listener{ln, l.h})
	}
	errc := make(chan error, len(ls))
	for _, l := range ls {
		go func() { errc <- (&http.Server{Handler: l.h, ReadHeaderTimeout: 10 * time.Second}).Serve(l.ln) }()
	}
	log.Fatal(<-errc)
}
