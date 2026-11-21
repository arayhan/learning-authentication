// Lab 01 (Go): passwords and cookie sessions. Contract: see labs/contract/lab01.test.ts.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"authacademy/trace"
)

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

// loadUI reads the UI shared with the TS lab. Tries the source tree first, then paths relative to the cwd.
func loadUI() []byte {
	var cands []string
	if _, file, _, ok := runtime.Caller(0); ok {
		cands = append(cands, filepath.Join(filepath.Dir(file), "..", "ui", "index.html"))
	}
	cands = append(cands, "labs/01-sessions/ui/index.html", "../ui/index.html")
	for _, p := range cands {
		if b, err := os.ReadFile(p); err == nil {
			return b
		}
	}
	log.Fatalf("lab01: ui/index.html not found (tried %v)", cands)
	return nil
}

func main() {
	if err := initDummyHash(); err != nil {
		log.Fatalf("lab01: dummy hash: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	store, err := openStore(ctx, env("DATABASE_URL", "postgres://academy:academy@localhost:5433/labs"))
	cancel()
	if err != nil {
		log.Fatalf("lab01: database: %v", err)
	}
	s := newServer(store, loadUI(), trace.NewHub(200))
	addr := "127.0.0.1:" + env("PORT", "4101") // loopback only: the vulnerable mode must never be reachable off-machine
	log.Printf("lab01 (go) listening on http://%s", addr)
	log.Fatal((&http.Server{Addr: addr, Handler: s.handler, ReadHeaderTimeout: 10 * time.Second}).ListenAndServe())
}
