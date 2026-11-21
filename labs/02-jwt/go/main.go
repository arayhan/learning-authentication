// Lab 02 (Go): JWT access tokens, JWKS, rotating refresh tokens. Contract: see labs/contract/lab02.test.ts.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"authacademy/trace"
)

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func main() {
	if err := initDummyHash(); err != nil {
		log.Fatalf("lab02: dummy hash: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	store, err := openStore(ctx, env("DATABASE_URL", "postgres://academy:academy@localhost:5433/labs"))
	cancel()
	if err != nil {
		log.Fatalf("lab02: database: %v", err)
	}
	s := newServer(store, trace.NewHub(200))
	addr := "127.0.0.1:" + env("PORT", "4102") // loopback only: the vulnerable mode must never be reachable off-machine
	log.Printf("lab02 (go) listening on http://%s (kid %s)", addr, store.keys.KID)
	log.Fatal((&http.Server{Addr: addr, Handler: s.handler, ReadHeaderTimeout: 10 * time.Second}).ListenAndServe())
}
