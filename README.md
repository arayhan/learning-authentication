# Auth Academy

Local learning platform for authentication: a Next.js academy app plus Go and TypeScript auth lab servers.

## Setup

```bash
pnpm i
cp apps/academy/.env.example apps/academy/.env.local   # first time only
docker compose up -d --wait                 # Postgres 17 on localhost:5433 (waits until healthy)
pnpm --filter academy exec drizzle-kit migrate   # create the academy tables
pnpm dev                                    # academy on http://localhost:3000
pnpm lab 01                                 # a lab server (Go by default, add --ts for TypeScript)
```

Git Bash on Windows with Docker Desktop: run `unset DOCKER_HOST; export DOCKER_CONTEXT=desktop-linux` first, otherwise `docker compose` talks to the wrong engine.

Databases: `academy`, `academy_test`, `labs` (user/password `academy`).

## Labs

| Command | Go | TypeScript |
|---|---|---|
| `pnpm lab 01` | 4101 | 4201 |
| `pnpm lab 02` | 4102 | 4202 |
| `pnpm lab 03` | AS 4103, client SPA 4113, API 4123 | AS 4203, client SPA 4213, API 4223 |

Add `--ts` to run the TypeScript implementation. Labs listen on `127.0.0.1` only.

## Tests

```bash
pnpm -r test                                          # unit tests (needs Postgres)
node scripts/contract.mjs 01 go                       # lab contract test, also 02/03 and ts
pnpm --filter academy exec playwright install chromium   # once
pnpm --filter academy exec playwright test            # e2e + accessibility, starts academy and Go labs 01-03
pnpm shots                                            # regenerate lesson screenshots in apps/academy/public/shots
```
