# Auth Academy — Phase 1 Plan

## Context
User wants to learn authentication end to end (password login, sessions, JWT, OAuth2, PKCE, OIDC, SSO), at three depths at once:
- **build real apps**: reusable production-style code
- **deep understanding**: specs, attacks, and why each step exists
- **interview prep**: quizzes, cheat-sheets, "explain it back"

Their day job is a **modular monolith with SSO**:
- sso-frontend (Next.js) + sso-backend (Go)
- core-api (Go REST)
- platforms A/B/C (Next.js), all signing in through the one SSO

The course must lead to that architecture. Folder `D:\Personal Data\source-codes\learning\learning-authentication` is empty. Tooling present: Node 24, pnpm 11, Go 1.27, Docker 27, git.

**Decisions made with the user**
| Topic | Decision |
|---|---|
| App approach | Custom Next.js monorepo (academy + labs in one repo) |
| Stacks | Layers first; Phase 1 labs in **Go + TS side by side**; NextAuth / React+Nest+Postgres / Python variants later |
| Playground | **Hybrid**: simulated step-through visuals + real local lab servers with live HTTP inspector |
| Progress | **Postgres + academy login** (session auth now; switches to the course's own SSO in Phase 2) |
| Phase 1 scope | Platform shell + M1 Passwords & Sessions, M2 JWT, M3 OAuth2 + PKCE |
| SSO capstone | Phase 2, shaped exactly like their work system |

## Architecture
```
learning-authentication/
  apps/academy/              Next.js 16 App Router, TS, Tailwind v4, shadcn/ui
    app/(learn)/m/[module]/[lesson]   lesson pages (MDX)
    app/api/progress, app/api/auth    route handlers (Drizzle → Postgres)
    components/flow/         <SequenceFlow> animated diagram engine
    components/playground/   Inspector, TokenDecoder, PKCE lab, AttackSim
    components/game/         XP bar, badges, streak, quiz, checkpoints
    content/m1..m3/*.mdx     lessons
  labs/
    01-sessions/{go,ts}      real servers :4101 (go) / :4201 (ts)
    02-jwt/{go,ts}           :4102 / :4202
    03-oauth-pkce/{go,ts}    mini auth server + client + resource API
  packages/trace/            shared trace event schema (JSON) used by Go + TS middleware
  docker-compose.yml         postgres:17 (academy DB + lab DBs)
  go.work, pnpm-workspace.yaml
```
**Live inspector:** each lab wraps its handlers in trace middleware (Go `net/http` and TS Hono). The middleware publishes request/response events (headers, cookies, body, redacted secrets) on `GET /__trace` (SSE). The academy's Inspector panel subscribes and shows a DevTools-like timeline. Lab picker toggles Go ↔ TS: same API contract, same trace format.

```
Browser (academy :3000) ──fetch──▶ lab :41xx/:42xx ──▶ Postgres
        ▲                               │
        └────────── SSE /__trace ───────┘
```

## Lesson anatomy (UX, applied to every lesson)
1. **Hook**: a one-screen real-world analogy (e.g. session = coat-check ticket).
2. **Concept**: short paragraphs plus an animated `<SequenceFlow>` the learner steps through (Next / Back / autoplay). Each arrow is clickable and shows the raw HTTP message.
3. **Check**: 2–3 inline questions; must pass to unlock the next section (retrieval practice).
4. **Lab**: run the real server (`pnpm lab 01 --go`); guided tasks verified through the trace stream (e.g. "observe `Set-Cookie: HttpOnly`" auto-ticks when seen).
5. **Code**: Go | TS tabs, annotated line-by-line walkthrough.
6. **Break it**: attack sim (session fixation, CSRF, JWT `alg:none`, auth-code interception without PKCE). Then the fix.
7. **Recap card**: interview cheat-sheet + "explain it back" free-text prompt (self-graded with rubric).

Screens: annotated browser-frame screenshots of lab UIs (login page, consent screen, DevTools cookie tab), captured with a Playwright script into `apps/academy/public/shots/`.

## Gamification
- **XP** for each section, quiz, lab task and attack. **Levels**: Intern → Junior → Mid → Senior → Staff → Principal (title badge in header).
- **Badges** per milestone, e.g. "Cookie Monster" (M1), "Token Smith" (M2), "Code Verifier" (M3), "Red Team" (all attacks).
- **Streak** (daily), **skill map** (module graph with locked/unlocked nodes), **boss quiz** at module end (timed, 10 questions).
- Kept quiet in enterprise style: no confetti spam; subtle toasts, one restrained celebratory animation per badge; respects `prefers-reduced-motion`.

## Visual design
Minimalist, professional and enterprise-style: neutral zinc palette with one accent (indigo); Inter + JetBrains Mono; light and dark themes. Layout: three panes:
- left: module nav + skill map
- center: lesson
- right: collapsible Inspector/Playground

Design pass uses the `impeccable` / `frontend-design` skills during build.

## Curriculum — Phase 1
**M1 Passwords & Sessions**
1. Identity vs authentication vs authorization
2. Password storage: hashing, salt, argon2id/bcrypt; **lab**: register/login
3. Server sessions and cookies (HttpOnly, Secure, SameSite); **lab**
4. Session lifecycle: rotation on login, logout, expiry; **attack**: fixation
5. CSRF and defenses; **attack sim**
6. Rate limiting and account enumeration
7. Boss quiz

**M2 JWT & Tokens**
1. Stateful vs stateless; JWT anatomy (decoder playground)
2. Signing: HS256 vs RS256/ES256, JWKS
3. Access + refresh tokens, rotation and reuse detection; **lab**
4. Where to store tokens (cookie vs memory vs localStorage), XSS
5. **Attacks**: `alg:none`, key confusion, missing `exp`/`aud` checks
6. Revocation strategies
7. Boss quiz

**M3 OAuth 2.0 + PKCE**
1. The delegation problem (valet-key analogy); roles
2. Authorization code flow, step by step; **lab** with a mini auth server
3. Client types; why implicit flow is dead
4. PKCE: verifier and challenge, S256 (interactive generator); **attack**: code interception
5. Scopes and consent; state param; redirect URI validation
6. Client credentials (service to service, preview of core-api)
7. OAuth 2.1 / BCP summary + boss quiz

## Data model (Drizzle, academy DB)
`users`, `sessions` (hashed token id, expires), `lesson_progress` (user, lesson, section, completed_at), `xp_events` (user, source, amount), `badges` (user, badge, earned_at), `quiz_attempts`. Academy auth = cookie session with argon2id (`@node-rs/argon2`). It dogfoods M1 and is replaced by SSO in Phase 2.

## Build order (Phase 1)
1. `git init`; write spec to `docs/superpowers/specs/2026-11-20-auth-academy-design.md`; then `superpowers:writing-plans` for the detailed task plan.
2. Scaffold monorepo: pnpm workspace, `go.work`, docker-compose Postgres, Next.js academy with Tailwind + shadcn.
3. Academy shell: layout, theming, academy login, Drizzle schema and migrations, progress API.
4. Engines: `<SequenceFlow>`, Quiz/Checkpoint, XP/badge service, Inspector (SSE client), `packages/trace` + Go and TS trace middleware.
5. M1 content + labs (Go + TS) + attack sims.
6. M2 content + labs + JWT decoder/attack playground.
7. M3 content + mini auth server/client/resource API (Go + TS) + PKCE lab.
8. Playwright screenshot script; boss quizzes; skill map; polish pass.

## Later phases (not built now)
- **Phase 2**: M4 OIDC (ID token, discovery, userinfo); M5 SSO capstone: `sso-backend` (Go OIDC provider), `sso-frontend` (Next.js login/consent), `core-api` (Go, validates tokens via JWKS), `platform-a/b/c` (Next.js). Single sign-on and single logout across platforms. Academy login moves to this SSO.
- **Phase 3**: MFA (TOTP), Passkeys/WebAuthn, SAML, Keycloak comparison, stack variants (NextAuth/Auth.js, React SPA + NestJS + Postgres, Python FastAPI).

## Verification
- `docker compose up -d && pnpm dev`: academy on :3000; register, log in, complete a lesson section, confirm XP persists in Postgres after restart.
- `pnpm lab 01 --go` and `--ts`: Inspector shows live traces; guided tasks auto-tick from traces.
- Go labs: `go test ./...` per lab (login, session rotation, JWT validation rejects `alg:none`/expired, PKCE rejects wrong verifier).
- TS labs: `vitest` with the same cases (shared contract tests run against both servers on their ports).
- Playwright e2e: one happy path per module (lesson, quiz, lab task, badge earned).
- Accessibility: keyboard-navigable flows, `prefers-reduced-motion`, axe check on lesson page.
