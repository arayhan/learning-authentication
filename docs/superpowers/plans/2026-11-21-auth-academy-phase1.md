# Auth Academy Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local learning platform: a Next.js "academy" that teaches Sessions, JWT and OAuth2+PKCE. It has gamified lessons and animated flow diagrams, and it is backed by real lab servers in Go and TypeScript. The labs stream live HTTP traces into the academy.

**Architecture:** pnpm + Go-workspace monorepo.
- **Academy:** `apps/academy` (Next.js 16 App Router). It owns the UI, MDX lessons, academy login and progress/XP (Postgres via Drizzle).
- **Labs:** each lab in `labs/NN-*/{go,ts}` implements one shared HTTP contract. A shared trace middleware publishes every request/response on `GET /__trace` (SSE). The academy's Inspector subscribes to it, and lesson tasks auto-complete when matching traces arrive.

**Tech Stack:**
- **Academy:** Next.js 16, React 19, Tailwind v4, shadcn/ui, @next/mdx, Drizzle ORM + `postgres` driver, zod, `@node-rs/argon2`, motion
- **TS labs:** Hono 4 + @hono/node-server, jose
- **Go labs:** Go 1.27, chi v5, pgx v5, golang-jwt v5, x/crypto/argon2
- **Testing:** vitest, Playwright, @axe-core/playwright
- **Infra:** Postgres 17 (docker compose)

**Spec:** `docs/superpowers/specs/2026-11-20-auth-academy-design.md`

## Global Constraints

- Node 24, pnpm 11, Go 1.27, Docker 27 (present on machine).
- Next.js 16 conventions: `proxy.ts` (not `middleware.ts`), `params` is a `Promise`, Turbopack default.
- Ports:

  | Service | Port |
  |---|---|
  | academy | 3000 |
  | Postgres | 5433 (avoids local 5432) |
  | lab01 | go 4101, ts 4201 |
  | lab02 | go 4102, ts 4202 |
  | lab03 AS | go 4103, ts 4203 |
  | lab03 client SPA | go 4113, ts 4213 |
  | lab03 API | go 4123, ts 4223 |

- DB URLs:
  - `postgres://academy:academy@localhost:5433/academy` (app)
  - `.../academy_test` (tests)
  - `.../labs` (labs)
- Go and TS implementations of a lab share one HTTP contract and one Postgres schema (`lab01`, `lab02`, `lab03`). A user registered via Go must log in via TS.
- Password hashing everywhere: argon2id, m=19456 KiB, t=2, p=1, 16-byte salt, PHC string format (`$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>`, unpadded base64).
- Session/refresh tokens: 32 random bytes, base64url. Only the `sha256` hex is stored in the DB.
- Labs bind `127.0.0.1` only. "Vulnerable mode" is enabled per request by the header `X-Lab-Mode: vulnerable`. Without it, every defense is on.
- Lab CORS: allow origin `http://localhost:3000` (plus the lab03 client origins for the AS/API), credentials true. Allowed headers include `Content-Type, Authorization, X-CSRF-Token, X-Lab-Mode`.
- Visual design:
  - neutral zinc palette, single indigo accent
  - Inter (UI) + JetBrains Mono (code)
  - light + dark themes
  - every animation respects `prefers-reduced-motion`
  - no confetti
- Copy is English. Analogies are short (≤ 3 sentences).
- XP values (server-defined only):

  | Event | XP |
  |---|---|
  | step (lesson section) | 10 |
  | quiz pass | 20 |
  | lab task | 15 |
  | attack | 30 |
  | boss pass | 100 |

- Level thresholds: Intern 0, Junior 300, Mid 900, Senior 1800, Staff 2800, Principal 4000.

## Review Focus

1. **Duplicate XP events** (double-click, page reload, React StrictMode double effects, two tabs) must award XP once. Test lives in Task 4.
2. **Lab not running or wrong impl selected.** The Inspector and lab tasks show an "offline" state with the exact start command, auto-reconnect when the server comes up, and never throw. Test lives in Task 9.
3. **Reload or revisit mid-lesson.** Already-passed gates and completed steps are restored from the server, and the learner lands on the first incomplete step. Test lives in Task 6.
4. **Academy session expires mid-lesson.** The progress POST gets 401; the UI shows a re-login dialog and keeps the lesson position (no hard redirect that loses state). Test lives in Task 6.
5. **Cross-impl interop.** Register via the Go lab, log in via the TS lab (and the reverse); JWTs issued by Go verify in TS. Tests live in Tasks 10, 12 and 14.

---

## File Structure

```
package.json, pnpm-workspace.yaml, go.work, docker-compose.yml, docker/init.sql, .gitignore, README.md
scripts/lab.mjs                    # pnpm lab <01|02|03> --go|--ts
scripts/contract.mjs               # start lab impl, wait /healthz, run its contract test, stop
scripts/shots.ts                   # Playwright screenshots of lab UIs → apps/academy/public/shots
packages/trace/
  ts/src/{types.ts,hub.ts,hono.ts,index.ts}   # @academy/trace
  go/{trace.go,hub.go,middleware.go}          # module authacademy/trace
  fixtures/event.golden.json
labs/contract/{lab01,lab02,lab03}.test.ts      # @academy/lab-contract (vitest, LAB_IMPL env)
labs/01-sessions/{go,ts}
labs/02-jwt/{go,ts}
labs/03-oauth-pkce/{go,ts,client-spa/index.html}
apps/academy/
  proxy.ts, drizzle.config.ts, mdx-components.tsx, next.config.ts
  app/layout.tsx, app/page.tsx (dashboard), app/login/page.tsx, app/register/page.tsx
  app/m/[module]/[lesson]/page.tsx
  app/api/auth/{register,login,logout}/route.ts, app/api/progress/route.ts
  lib/db/{schema.ts,client.ts}, lib/auth/{password.ts,session.ts,rate-limit.ts,origin.ts}
  lib/course/{types.ts,registry.ts}, lib/game/{rules.ts,levels.ts,badges.ts,streak.ts,award.ts}
  components/shell/*, components/lesson/*, components/flow/*, components/playground/*, components/game/*
  content/m1/NN-slug/{lesson.ts,index.mdx}, content/m2/..., content/m3/..., content/flows/*.ts
  e2e/*.spec.ts
```

---

### Task 1: Monorepo scaffold, Postgres, academy boots

**Files:**
- Create: root `package.json`, `pnpm-workspace.yaml` (`apps/*`, `labs/*/ts`, `labs/contract`, `packages/trace/ts`), `go.work`, `docker-compose.yml`, `docker/init.sql`, `.gitignore`, `README.md`
- Create: `apps/academy` via `pnpm create next-app@latest apps/academy --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-pnpm --yes`, then `pnpm dlx shadcn@latest init -d` inside it
- Create: `apps/academy/app/globals.css` design tokens; `app/layout.tsx` fonts via `next/font/google` (Inter, JetBrains_Mono)

**Interfaces:**
- Produces: root scripts `dev` (academy), `lab`, `contract`, `test`, `db:up` (`docker compose up -d`). CSS variables `--accent` (indigo-600 / indigo-400 dark), zinc neutrals, `.font-mono`.

- [ ] **Step 1:** `docker-compose.yml`: one `postgres:17` service:
  - user/password `academy`, port `5433:5432`, named volume
  - `docker/init.sql` mounted to `/docker-entrypoint-initdb.d`; it creates DBs `academy_test` and `labs` (the default DB is `academy`)
- [ ] **Step 2:** Run `docker compose up -d` and then `docker compose exec postgres psql -U academy -c "\l"`. Expected: the list shows `academy`, `academy_test` and `labs`.
- [ ] **Step 3:** Scaffold the academy and shadcn (commands above). Add the tokens and fonts. Add a theme toggle via a `class` on `<html>`, with no extra deps beyond shadcn.
- [ ] **Step 4:** Run `pnpm --filter academy build`. Expected: build succeeds.
- [ ] **Step 5:** Commit `chore: scaffold monorepo, postgres, academy app`.

### Task 2: Academy DB schema + academy login

**Files:**
- Create: `apps/academy/lib/db/{schema.ts,client.ts}`, `drizzle.config.ts`
- Create: `lib/auth/{password.ts,session.ts,rate-limit.ts,origin.ts}`
- Create: `app/api/auth/{register,login,logout}/route.ts`, `proxy.ts`
- Test: `apps/academy/lib/auth/*.test.ts`, `apps/academy/app/api/auth/auth.int.test.ts` (uses `academy_test`)

**Interfaces:**
- Produces (schema):
  - `users(id uuid pk, email text unique lowercased, display_name text, password_hash text, created_at)`
  - `sessions(id text pk /*sha256 hex*/, user_id fk cascade, expires_at timestamptz, created_at)`
  - `lesson_progress(user_id, ref text, completed_at, pk(user_id, ref))`
  - `xp_events(id, user_id, source text, amount int, created_at, unique(user_id, source))`
  - `badges(user_id, badge_id, earned_at, pk(user_id, badge_id))`
  - `quiz_attempts(id, user_id, quiz_ref, score, total, created_at)`
- Produces (functions):
  - `hashPassword(pw: string): Promise<string>`, `verifyPassword(hash: string, pw: string): Promise<boolean>`
  - `createSession(userId: string): Promise<{ token: string; expiresAt: Date }>` (30 days)
  - `getSessionUser(token: string | undefined): Promise<{ id: string; email: string; displayName: string } | null>`, `deleteSession(token: string): Promise<void>`
  - `currentUser(): Promise<User | null>` (reads cookie `academy_session`)
  - `rateLimit(key: string, opts: { limit: number; windowMs: number }): { ok: boolean; retryAfterMs: number }` (in-memory). Comment: `shortcut: in-memory, resets on restart; move to Postgres/Redis if academy is ever multi-instance`.
  - `assertSameOrigin(req: Request): void` (throws 403 when `Origin` is present and differs from the request host)
- Produces (routes):
  - `POST /api/auth/register {email, password, displayName}` → 201 + cookie | 400 | 409
  - `POST /api/auth/login {email, password}` → 200 + cookie | 401 `{"error":"Invalid email or password"}` | 429
  - `POST /api/auth/logout` → 204 + cleared cookie
- Cookie: `academy_session`; HttpOnly; SameSite=Lax; Path=/; Secure when `NODE_ENV=production`.
- Login always deletes any pre-existing session cookie before creating a new one (rotation).

- [ ] **Step 1: Failing tests**

```ts
test("hash is PHC argon2id and verifies", async () => {
  const h = await hashPassword("correct horse battery staple");
  expect(h).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  expect(await verifyPassword(h, "correct horse battery staple")).toBe(true);
  expect(await verifyPassword(h, "wrong")).toBe(false);
});
test("rateLimit blocks 6th attempt in window", () => {
  for (let i = 0; i < 5; i++) expect(rateLimit("k", { limit: 5, windowMs: 60_000 }).ok).toBe(true);
  expect(rateLimit("k", { limit: 5, windowMs: 60_000 }).ok).toBe(false);
});
// auth.int.test.ts (academy_test DB, migrations applied in beforeAll)
test("register → login → session stored hashed", ...)       // sessions.id !== raw cookie token, === sha256(token)
test("login with unknown email and wrong password return identical 401 body", ...)
test("login rotates: old cookie token no longer resolves", ...)
test("cross-origin POST /api/auth/login → 403", ...)        // Origin: http://evil.test
test("password shorter than 8 chars → 400", ...)
```

- [ ] **Step 2:** Run `pnpm --filter academy vitest run lib/auth app/api/auth`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Implement the schema, `pnpm drizzle-kit generate`, and the auth libs and routes. `proxy.ts` redirects to `/login?next=<path>` when `/m/*` or `/` is requested without the `academy_session` cookie (presence check only; real validation happens in `currentUser()`).
- [ ] **Step 4:** Run the same tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(academy): db schema and session-based academy login`.

### Task 3: Course registry + game rules (pure)

**Files:**
- Create: `apps/academy/lib/course/{types.ts,registry.ts}`, `lib/game/{rules.ts,levels.ts,badges.ts,streak.ts}`
- Test: `lib/game/game.test.ts`, `lib/course/registry.test.ts`

**Interfaces:**
- Produces:

```ts
type ModuleId = "m1" | "m2" | "m3";
type LabId = "01" | "02" | "03";
type QuizQuestion = { prompt: string; choices: string[]; answer: number; why: string };
type Quiz = { id: string; questions: QuizQuestion[]; boss?: { seconds: number; passRatio: number } };
type LabTask = { id: string; label: string; lab: LabId; hint: string; match: (e: TraceEvent) => boolean };
type Attack = { id: string; title: string; kind: "live" | "simulated" };
type LessonMeta = { id: string /* "m1-l2" */; module: ModuleId; slug: string; title: string; minutes: number;
  steps: { id: string; title: string }[]; quizzes: Quiz[]; labTasks: LabTask[]; attacks: Attack[] };
type CourseModule = { id: ModuleId; slug: string; title: string; summary: string; badge: BadgeId; lessons: LessonMeta[] };
type BadgeId = "cookie-monster" | "token-smith" | "code-verifier" | "red-team" | "on-call" | "flawless";
type XpEvent =
  | { kind: "step"; ref: string }        // "m1-l2/hook"
  | { kind: "quiz"; ref: string; answers: number[] }       // "m1-l2/q1"
  | { kind: "lab-task"; ref: string }    // "m1-l3/set-cookie-httponly"
  | { kind: "attack"; ref: string }      // "m1-l4/fixation"
  | { kind: "boss"; ref: string; answers: number[]; elapsedMs: number };
```

- `course: CourseModule[]` in `registry.ts`. It imports every `content/mN/NN-slug/lesson.ts` default export. Task 3 ships stub lesson.ts files with titles/steps from the curriculum table (Task 11 onward fills them).
- `resolveRef(ref: string): { lesson: LessonMeta; kind: "step" | "quiz" | "lab-task" | "attack" } | null`
- `xpFor(e: XpEvent): number` (values from Global Constraints)
- `gradeQuiz(quiz: Quiz, answers: number[]): { score: number; total: number; passed: boolean }`
  - normal quiz: passed only when all answers are correct
  - boss: passed when `score/total ≥ passRatio` (0.8) and `elapsedMs ≤ seconds*1000` (600)
- `levelFor(xp: number): { name: string; min: number; next: number | null }`
- `moduleRefs(m: CourseModule): string[]` (every step, quiz, lab-task and attack ref, plus `"<lastLessonId>/boss"`)
- `evaluateBadges(s: { completed: Set<string>; perfectBoss: boolean; streak: number }): BadgeId[]`. Rules:
  - module badge when all `moduleRefs` are completed
  - `red-team` when every attack ref in the course is completed
  - `on-call` when streak ≥ 7
  - `flawless` when any boss scored 100%
- `streakDays(dates: Date[], timeZone: string, now: Date): number`: consecutive local calendar days with ≥ 1 event, ending today or yesterday.

- [ ] **Step 1: Failing tests**

```ts
expect(levelFor(0).name).toBe("Intern"); expect(levelFor(899).name).toBe("Junior");
expect(levelFor(4000)).toEqual({ name: "Principal", min: 4000, next: null });
expect(xpFor({ kind: "boss", ref: "m1-l7/boss", answers: [], elapsedMs: 0 })).toBe(100);
expect(gradeQuiz(q /*2 questions*/, [q.questions[0].answer, 99]).passed).toBe(false);
expect(resolveRef("m9-l1/x")).toBeNull();
// streak in Asia/Jakarta: events 2026-11-19T20:00Z (=11-20 local) and 2026-11-20T18:00Z (=11-21 local), now 2026-11-21T05:00Z → 2
expect(streakDays([...], "Asia/Jakarta", new Date("2026-11-21T05:00:00Z"))).toBe(2);
expect(streakDays([new Date("2026-11-18T03:00:00Z")], "UTC", new Date("2026-11-21T05:00:00Z"))).toBe(0);
// registry.test.ts: every ref id unique across course; every lesson has ≥1 step; module m1 has 7 lessons
```

- [ ] **Step 2:** Run `pnpm --filter academy vitest run lib/game lib/course`. Expected: FAIL.
- [ ] **Step 3:** Implement. Define the `TraceEvent` type import from `@academy/trace` (Task 8). Until that task lands, declare it via a local type in `lib/course/types.ts` re-exported later. Task 8 swaps this to the package import.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(academy): course registry and game rules`.

### Task 4: Progress API

**Files:**
- Create: `apps/academy/lib/game/award.ts`, `app/api/progress/route.ts`
- Test: `app/api/progress/progress.int.test.ts`

**Interfaces:**
- Consumes: Task 2 `currentUser`, `assertSameOrigin`; Task 3 `resolveRef`, `xpFor`, `gradeQuiz`, `evaluateBadges`, `streakDays`, `levelFor`.
- Produces:
  - `award(userId: string, e: XpEvent, tz: string): Promise<ProgressState & { gained: number; newBadges: BadgeId[] }>`
  - `getProgress(userId: string, tz: string): Promise<ProgressState>`
  - `type ProgressState = { completed: string[]; xp: number; level: ReturnType<typeof levelFor>; badges: BadgeId[]; streak: number }`
- Produces (routes):
  - `GET /api/progress?tz=Asia/Jakarta` → `ProgressState`
  - `POST /api/progress {event: XpEvent, tz}` → 200 `ProgressState & {gained, newBadges}` | 400 unknown ref | 401 | 422 quiz failed (body `{score,total,passed:false}`, records attempt, no XP)
- XP insert uses `ON CONFLICT (user_id, source) DO NOTHING`; source = `${kind}:${ref}`. Progress row and XP insert run in one transaction.
- `tz` is validated with `Intl.DateTimeFormat(undefined,{timeZone})`; on failure it falls back to `"UTC"`.

- [ ] **Step 1: Failing tests**

```ts
test("same step event twice awards XP once", async () => {
  const a = await post({ kind: "step", ref: "m1-l1/hook" }); const b = await post({ kind: "step", ref: "m1-l1/hook" });
  expect(a.gained).toBe(10); expect(b.gained).toBe(0); expect(b.xp).toBe(a.xp);
});
test("10 concurrent identical events → xp 10", ...)          // Promise.all, Review Focus #1
test("wrong quiz answers → 422, attempt stored, xp unchanged", ...)
test("unknown ref → 400", ...); test("no session → 401", ...)
test("completing all m1 refs grants cookie-monster in newBadges exactly once", ...)
```

- [ ] **Step 2:** Run `pnpm --filter academy vitest run app/api/progress`. Expected: FAIL.
- [ ] **Step 3:** Implement `award`, `getProgress` and the route.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(academy): idempotent progress and XP API`.

### Task 5: App shell UI (layout, auth pages, dashboard, skill map)

**Files:**
- Create: `app/login/page.tsx`, `app/register/page.tsx`, `app/page.tsx`
- Create: `components/shell/{AppShell.tsx,Header.tsx,ModuleNav.tsx,ThemeToggle.tsx,RightPane.tsx}`, `components/game/{XpBar.tsx,LevelBadge.tsx,BadgeShelf.tsx,SkillMap.tsx,StreakChip.tsx,ProgressProvider.tsx,Toaster.tsx}`
- Test: `components/game/game-ui.test.tsx` (vitest + @testing-library/react + jsdom)

**Interfaces:**
- Consumes: Task 4 routes, Task 3 `course`.
- Produces:
  - `<ProgressProvider initial={ProgressState}>`
  - `useProgress(): { state: ProgressState; send(e: XpEvent): Promise<AwardResult | "unauthorized">; isDone(ref: string): boolean }`. `send` shows a toast `+N XP` and badge toasts; on 401 it returns `"unauthorized"` and opens `<ReauthDialog>`.
  - `<AppShell left={…} right={…}>`: three panes, collapsible right pane (state in localStorage), stacked on < 1024px.
- SkillMap: a node per lesson grouped by module. States: done / available / locked. A lesson unlocks when the previous lesson's steps are all done; module 1 lesson 1 is always available.
- Dashboard: greeting, level + XP bar, streak, "Continue: <first incomplete lesson>" button, SkillMap, BadgeShelf (locked badges greyed with a hint).

- [ ] **Step 1: Failing tests**: SkillMap marks m1-l2 locked when m1-l1 is incomplete and available when it is complete. XpBar renders `aria-valuenow` = xp - level.min. BadgeShelf shows 6 badges with the earned count.
- [ ] **Step 2:** Run `pnpm --filter academy vitest run components/game`. Expected: FAIL.
- [ ] **Step 3:** Implement. Use shadcn `button card dialog progress tooltip sonner tabs`. Login/register forms post to Task 2 routes, then `router.push(next ?? "/")`.
- [ ] **Step 4:** Run the tests. Expected: PASS. Then check by hand: `pnpm dev`, register, land on the dashboard.
- [ ] **Step 5:** Commit `feat(academy): app shell, auth pages, dashboard and skill map`.

### Task 6: Lesson engine (MDX + steps, quizzes, code tabs, recap)

**Files:**
- Create: `next.config.ts` (@next/mdx, `pageExtensions` incl. mdx, remark-gfm passed as string for Turbopack), `mdx-components.tsx`
- Create: `app/m/[module]/[lesson]/page.tsx`
- Create: `components/lesson/{LessonProvider.tsx,LessonSteps.tsx,Step.tsx,Quiz.tsx,BossQuiz.tsx,Callout.tsx,Analogy.tsx,CodeTabs.tsx,RecapCard.tsx,ExplainBack.tsx,ReauthDialog.tsx,Shot.tsx}`
- Test: `components/lesson/lesson.test.tsx`

**Interfaces:**
- Consumes: `useProgress` (Task 5), `resolveRef`/`course` (Task 3).
- Produces (MDX vocabulary used by all content tasks):
  - `<LessonSteps>` wraps `<Step id title>`. Steps reveal one at a time. The "Continue" button sends `{kind:"step", ref}`. It is disabled while the step contains an unpassed gated `<Quiz>`.
  - `<Quiz id gate?>`: questions come from `lesson.quizzes`. One question at a time, the `why` is shown after each answer, retries allowed. On completion it sends the quiz event; on 422 it shows the score and "Try again".
  - `<BossQuiz id>`: 10 questions, countdown `seconds`, shuffles choices client-side but maps back to original indexes before sending.
  - `<Analogy title>{children}</Analogy>`, `<Callout type="info|warn|security">`
  - `<CodeTabs go="labs/…/file.go#L10-L42" ts="labs/…/file.ts#L5-L30" notes={{ [line]: string }} />`: reads files at build time (server component, `fs`). Shiki highlighting via `shiki` (`codeToHtml`). Line notes appear as margin markers.
  - `<RecapCard bullets={string[]} interview={{q:string,a:string}[]} />`, `<ExplainBack prompt rubric={string[]} />` (self-check checkboxes, stored in localStorage only)
  - `<Shot src alt caption callouts={{x,y,label}[]} />`: browser-frame screenshot with numbered callouts.
  - `<StepGuard>`: `Step` throws in dev when `id` is not in `lesson.steps`.
- Page: `generateStaticParams` from `course`. `params` is awaited; `notFound()` for unknown slugs. The page renders `content/<module>/<NN-slug>/index.mdx` via dynamic import keyed by the registry entry. Lesson header shows title, minutes and a step progress dots row.
- Restore (Review Focus #3): on mount it reveals all completed steps and scrolls to the first incomplete one.

- [ ] **Step 1: Failing tests** (render with a fake `ProgressProvider`):

```ts
test("only first step visible until Continue", ...)
test("gated quiz blocks Continue until passed", ...)
test("completed refs restore: steps 1-2 done → step 3 visible and focused", ...)   // Review Focus #3
test("send returns 'unauthorized' → ReauthDialog opens, revealed steps unchanged", ...) // Review Focus #4
test("BossQuiz maps shuffled choice back to original index", ...)
```

- [ ] **Step 2:** Run `pnpm --filter academy vitest run components/lesson`. Expected: FAIL.
- [ ] **Step 3:** Implement. Write a sample lesson `content/m1/01-identity/index.mdx` with 2 steps + 1 gated quiz to exercise the page.
- [ ] **Step 4:** Run the tests. Expected: PASS. Then run `pnpm --filter academy build`. Expected: OK (static params for all registry lessons).
- [ ] **Step 5:** Commit `feat(academy): MDX lesson engine with gated steps and quizzes`.

### Task 7: SequenceFlow diagram engine

**Files:**
- Create: `components/flow/{SequenceFlow.tsx,MessageDrawer.tsx,types.ts}`, `content/flows/index.ts`
- Test: `components/flow/flow.test.tsx`

**Interfaces:**
- Produces:

```ts
type Actor = { id: string; label: string; kind: "user" | "browser" | "server" | "db" | "attacker" | "as" | "api" };
type FlowStep = { from: string; to: string; label: string; http?: string /* raw HTTP text */; note?: string; danger?: boolean };
type Flow = { id: string; title: string; actors: Actor[]; steps: FlowStep[] };
<SequenceFlow flow={Flow} />   // usage in MDX: <SequenceFlow flow={flows.sessionCookie} />
```

- SVG lifelines, one per actor, plus arrows. Steps ≤ current are drawn, the current step is highlighted in the accent colour, `danger` steps are red.
- Controls: Back / Next / Play (1.6s per step) / Reset, a step counter, and the current `note` in a caption below.
- Keyboard: ←/→ when focused. Clicking an arrow with `http` opens `MessageDrawer` with the monospace raw message.
- Animation: arrows draw with `motion` path length. With reduced motion they appear instantly.
- Responsive: horizontal scroll inside the component under 640px; the page never scrolls sideways.

- [ ] **Step 1: Failing tests**:
  - Next advances `aria-current` step.
  - ArrowRight key advances.
  - Back at step 0 is disabled.
  - Clicking an arrow with `http` opens a drawer containing the raw text.
  - With `matchMedia('(prefers-reduced-motion: reduce)')` mocked true, Play still advances.
- [ ] **Step 2:** Run `pnpm --filter academy vitest run components/flow`. Expected: FAIL.
- [ ] **Step 3:** Implement. `content/flows/index.ts` exports `flows` (filled per module task).
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(academy): animated sequence flow diagrams`.

### Task 8: Trace package (TS + Go)

**Files:**
- Create: `packages/trace/ts/src/{types.ts,hub.ts,hono.ts,index.ts}` (package `@academy/trace`)
- Create: `packages/trace/go/{go.mod (module authacademy/trace),trace.go,hub.go,middleware.go}`
- Create: `packages/trace/fixtures/event.golden.json`
- Test: `packages/trace/ts/src/trace.test.ts`, `packages/trace/go/middleware_test.go`

**Interfaces:**
- Produces:

```ts
type TraceEvent = {
  id: string; ts: string /* ISO */; lab: "01" | "02" | "03"; impl: "go" | "ts"; role: "app" | "as" | "client" | "api";
  req: { method: string; path: string; query: string; headers: Record<string, string>; body?: string };
  res: { status: number; headers: Record<string, string | string[]>; body?: string };   // set-cookie always string[]
  durationMs: number;
};
createHub(capacity = 200): { publish(e: TraceEvent): void; recent(): TraceEvent[]; subscribe(fn): () => void }
traceMiddleware(hub, { lab, impl, role }): MiddlewareHandler        // Hono
sseHandler(hub): Handler                                            // GET /__trace: replays recent(), then live; ": ping" every 15s
```

- Go mirrors these: `trace.NewHub(capacity int) *Hub`, `trace.Middleware(h *Hub, lab, impl, role string) func(http.Handler) http.Handler`, `h.SSE() http.HandlerFunc`.
- Rules (both):
  - header names lowercased
  - bodies truncated to 4096 bytes with `…[truncated]`
  - JSON or form fields `password` and `client_secret` replaced by `"[redacted]"`
  - skip `OPTIONS` and `/__trace` itself
  - SSE `data:` is one JSON event per message

- [ ] **Step 1: Failing tests (both langs)**. Feed `POST /login` with form/JSON body `{"email":"a@b.c","password":"x"}` and a handler responding 200 with two `Set-Cookie` headers. Then:
  - the event normalized (id/ts/durationMs zeroed) deep-equals `fixtures/event.golden.json`
  - `password` equals `[redacted]`
  - `OPTIONS` produces no event
  - an SSE subscriber receives the replayed event
- [ ] **Step 2:** Run `pnpm --filter @academy/trace vitest run` and `go test ./packages/trace/go/...`. Expected: FAIL.
- [ ] **Step 3:** Implement. Swap the academy's local `TraceEvent` (Task 3) to `import type { TraceEvent } from "@academy/trace"`.
- [ ] **Step 4:** Run both. Expected: PASS.
- [ ] **Step 5:** Commit `feat(trace): shared trace middleware and SSE hub for Go and TS`.

### Task 9: Inspector, lab console, lab tasks, lab runner

**Files:**
- Create: `apps/academy/lib/labs.ts`
- Create: `components/playground/{Inspector.tsx,TraceDetail.tsx,LabSwitcher.tsx,LabTasks.tsx,LabConsole.tsx,useTraceStream.ts}`
- Create: `scripts/lab.mjs`, `scripts/contract.mjs`
- Test: `components/playground/playground.test.tsx`

**Interfaces:**
- Produces:
  - `labs: Record<LabId, { title: string; ports: { go: number; ts: number }; traceUrl(impl): string; startCmd(impl): string }>`. lab03's trace URL is the AS port.
  - `useTraceStream(lab: LabId, impl: "go"|"ts"): { status: "connecting"|"online"|"offline"; events: TraceEvent[]; clear(): void }`: EventSource with retry every 3s while offline, buffer 200, resubscribes when lab/impl changes.
  - `useLabImpl(): ["go"|"ts", set]`: persisted in localStorage, shared via context.
  - `<Inspector lab>` (right pane): timeline rows (method, path, status colour, duration, role chip), detail tabs Headers / Cookies (parsed Set-Cookie attributes as a table) / Body (pretty JSON) / Raw.
  - `<LabTasks lesson>`: lists `lesson.labTasks`. Each incoming event is checked with `match`; on the first match it calls `send({kind:"lab-task", ref})` and ticks the task.
  - `<LabConsole lab actions={ConsoleAction[]}>` with `type ConsoleAction = { label: string; method: string; path: string; body?: unknown; headers?: Record<string,string>; vulnerable?: boolean }`. It sends `fetch(…, { credentials: "include" })` to the selected impl and shows the response inline.
- Offline state (Review Focus #2): a card with "Lab 01 (Go) is not running", a copyable `pnpm lab 01 --go` and a "Retrying…" indicator.
- Scripts:
  - `scripts/lab.mjs <01|02|03> [--go|--ts]` (default go) runs `go run ./labs/<dir>/go` or `pnpm --filter @academy/lab<NN>-ts dev`, with `DATABASE_URL` defaulting to the labs URL.
  - `scripts/contract.mjs <NN> <go|ts>` starts the lab, polls `/healthz` ≤ 30s, runs `vitest run labs/contract/lab<NN>.test.ts` with `LAB_IMPL`, and kills the process tree on exit (Windows: `taskkill /T /F /PID`).

- [ ] **Step 1: Failing tests**:
  - With a mock EventSource that errors → status `offline` and the start command is rendered.
  - After the mock opens and emits an event → a row is rendered.
  - LabTasks ticks and calls `send` once even when 3 matching events arrive.
  - Switching impl closes the old EventSource and opens the new port.
- [ ] **Step 2:** Run `pnpm --filter academy vitest run components/playground`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(academy): live inspector, lab tasks and lab runner`.

### Task 10: Lab 01 — Passwords & Sessions (Go + TS)

**Files:**
- Create: `labs/01-sessions/go/{go.mod (authacademy/lab01),main.go,server.go,password.go,session.go,store.go,server_test.go}`
- Create: `labs/01-sessions/ts/{package.json (@academy/lab01-ts),src/main.ts,src/app.ts,src/password.ts,src/session.ts,src/store.ts}`
- Test: `labs/contract/lab01.test.ts`, Go unit tests in `server_test.go`

**Interfaces (HTTP contract, both impls):**
- Schema `lab01`, created on startup (`CREATE SCHEMA/TABLE IF NOT EXISTS`):
  - `users(id uuid, email unique, password_hash)`
  - `sessions(id text pk sha256, user_id, csrf_token, expires_at)`
  - `login_failures(email, at)`
- Routes:
  - `GET /healthz` → 200
  - `POST /register {email,password}` → 201 `{id,email}` | 400 (password 8–128 chars) | 409
  - `POST /login {email,password}` → 200 `{csrfToken}` + `Set-Cookie: sid=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600`
    - 401 `{"error":"invalid credentials"}` (identical for unknown email; still runs a dummy argon2 verify for equal timing)
    - 429 + `Retry-After` after 5 failures per email in 15 min
  - `GET /me` → 200 `{email}` | 401
  - `POST /logout` (needs `X-CSRF-Token`) → 204, deletes the row, sets `sid=; Max-Age=0`
  - `POST /transfer {to,amount}` (needs `X-CSRF-Token` = the session's token) → 200 `{ok:true}` | 403 `{"error":"csrf"}`
- Secure behaviour: login always issues a new session id (rotation) and deletes any session named by the incoming `sid`.
- Vulnerable mode (`X-Lab-Mode: vulnerable`):
  - login reuses the incoming `sid` value as the session id when present (fixation)
  - `/transfer` skips the CSRF check
- Attack helpers (browsers forbid setting `Cookie` in fetch, so the lab does it): `POST /__attack/plant-sid {sid}` sets cookie `sid=<value>` on the lab origin; `POST /__attack/as {sid, path}` replays a GET to `path` server-side carrying that sid and returns `{status, body}`. Both → 404 unless `X-Lab-Mode: vulnerable`.
- Lab UI: `GET /` serves a minimal HTML login form (for screenshots and the DevTools cookie demo).
- Trace: `Middleware(hub,"01",impl,"app")`; `/__trace` mounted.

- [ ] **Step 1: Failing contract tests** (`fetch` against `http://127.0.0.1:${LAB_IMPL==="go"?4101:4201}`; random emails per run):

```ts
test("set-cookie has HttpOnly, SameSite=Lax, Path=/", ...)
test("unknown email and wrong password → same status and body", ...)
test("6th failed login within window → 429 with Retry-After", ...)
test("secure: login with attacker-chosen sid → response sid differs and attacker sid gives /me 401", ...)
test("vulnerable: login with attacker-chosen sid → attacker sid gives /me 200", ...)
test("transfer without X-CSRF-Token → 403; with token → 200", ...)
test("logout → /me 401", ...)
test("/__attack/* → 404 without vulnerable header", ...)
test("interop: user registered via other impl can log in", ...)   // Review Focus #5: runs only when OTHER_URL env reachable, else skip with message
```

  Go unit test: `hashPassword` PHC output verifies with a fixed PHC string produced by `@node-rs/argon2` (paste as a constant).
- [ ] **Step 2:** Run `node scripts/contract.mjs 01 go`. Expected: FAIL (server missing).
- [ ] **Step 3:** Implement Go (chi, pgx, x/crypto/argon2 PHC encode/decode, `crypto/subtle` compare). Implement TS (Hono, `postgres`, `@node-rs/argon2`). Keep each file focused; `password.*` and `session.*` hold the lines `<CodeTabs>` will cite.
- [ ] **Step 4:** Run `node scripts/contract.mjs 01 go`, `node scripts/contract.mjs 01 ts` and `go test ./labs/01-sessions/go/...`. Expected: all PASS. With both running: `OTHER_URL=http://127.0.0.1:4201 node scripts/contract.mjs 01 go`. Expected: the interop test passes.
- [ ] **Step 5:** Commit `feat(lab01): sessions lab in Go and TS with shared contract tests`.

### Task 11: Module 1 content

**Files:**
- Create: `content/m1/{01-identity,02-password-storage,03-sessions-cookies,04-session-lifecycle,05-csrf,06-rate-limit-enumeration,07-boss}/{lesson.ts,index.mdx}`
- Create: `content/flows/m1.ts`
- Create: `components/playground/{HashPlayground.tsx,CsrfSim.tsx,FixationAttack.tsx}`
- Test: `components/playground/m1.test.tsx`, `lib/course/registry.test.ts` (extend)

**Interfaces:**
- Consumes: Tasks 6, 7, 9 vocabulary; lab01 contract.
- `<HashPlayground>`: input password + salt. Shows SHA-256 (instant) next to PBKDF2-SHA256 with an iterations slider (1k–600k) and measured ms via WebCrypto. A "same password, new salt → new hash" demo. A caption says the lab uses argon2id (memory-hard), which the browser demo does not run.
- `<FixationAttack>` (live): (1) attacker picks a sid → `POST /__attack/plant-sid`, (2) victim logs in via `/login` (once with, once without `X-Lab-Mode: vulnerable`), (3) attacker calls `POST /__attack/as {sid, path:"/me"}`. Shows 200 in vulnerable mode vs 401 in secure, side by side. On observing both outcomes it sends `{kind:"attack", ref:"m1-l4/fixation"}`.
- `<CsrfSim>` (simulated): two mini browser windows ("bank.localhost", "evil.example"). Step-through with toggles `SameSite=Lax`, `CSRF token`, `Origin check`; it shows which combination lets the forged POST through. Completing all toggles sends the attack event.

Per-lesson content table (each lesson: Hook `<Analogy>` → concept steps with flow → gated `<Quiz>` → lab step with `<LabTasks>` + `<LabConsole>` where listed → `<CodeTabs>` → break-it where listed → `<RecapCard>` + `<ExplainBack>`):

| Lesson | Analogy | Flow(s) | Quiz Qs | Lab tasks (match) | Attack |
|---|---|---|---|---|---|
| m1-l1 identity | Hotel: passport check (authn) vs room key opens which floors (authz) | `whoIsWho` | 3 | – | – |
| m1-l2 password-storage | Keep a fingerprint, never the key | `registerLogin` | 3 | `register-201` (POST /register → 201), `login-200` (POST /login → 200) | – (HashPlayground) |
| m1-l3 sessions-cookies | Coat-check ticket | `sessionCookie` | 3 | `set-cookie-httponly` (set-cookie has HttpOnly & SameSite=Lax), `me-200` (GET /me → 200) | – |
| m1-l4 session-lifecycle | Change the locks when you move in | `sessionRotation`, `fixation` | 3 | `logout-204` | `fixation` (live) |
| m1-l5 csrf | Forged signature on a letter you didn't write | `csrfAttack` | 3 | `transfer-403` (no token → 403), `transfer-200` | `csrf` (simulated) |
| m1-l6 rate-limit-enumeration | Bouncer who says "not tonight" to everyone the same way | `bruteForce` | 3 | `login-429`, `generic-401` (401 body = `{"error":"invalid credentials"}`) | – |
| m1-l7 boss | – | – | boss 10 Qs, 600s, 0.8 | – | – |

Every lesson cites real code lines via `<CodeTabs>` from lab01 Go + TS. Every recap has ≥ 3 interview Q&As.

- [ ] **Step 1: Failing tests**: HashPlayground shows different hashes for 2 salts. CsrfSim marks the forged request blocked when SameSite=Lax is on. FixationAttack sends the attack event only after both modes are observed (mock fetch). Registry test: every `labTask.match` returns true for a hand-written matching `TraceEvent` fixture and false for a near-miss.
- [ ] **Step 2:** Run `pnpm --filter academy vitest run components/playground lib/course`. Expected: FAIL.
- [ ] **Step 3:** Write components, flows, lesson.ts (quizzes with `why` per question) and MDX.
- [ ] **Step 4:** Run the tests. Expected: PASS. Then do a manual walkthrough: `pnpm lab 01`, complete m1-l3, confirm the Inspector shows Set-Cookie and the task ticks.
- [ ] **Step 5:** Commit `feat(content): module 1 passwords and sessions`.

### Task 12: Lab 02 — JWT (Go + TS)

**Files:**
- Create: `labs/02-jwt/go/{go.mod (authacademy/lab02),main.go,server.go,keys.go,tokens.go,naive.go,refresh.go,server_test.go}`
- Create: `labs/02-jwt/ts/src/{main.ts,app.ts,keys.ts,tokens.ts,naive.ts,refresh.ts}`
- Test: `labs/contract/lab02.test.ts`

**Interfaces (HTTP contract):**
- Keys: RSA-2048 keypair, generated on first start and stored in `lab02.keys(kid, private_pem, public_pem)`. Both impls load the same row, which makes tokens interoperable.
- Seeded user `alice@example.com` / `correct-horse-battery` (argon2id).
- Routes:
  - `GET /.well-known/jwks.json` → `{keys:[{kty,n,e,kid,alg:"RS256",use:"sig"}]}`
  - `POST /login {email,password}` → 200 `{access_token, token_type:"Bearer", expires_in:300}` + `Set-Cookie: rt=<opaque>; HttpOnly; SameSite=Strict; Path=/refresh; Max-Age=1209600`
    - access JWT claims: `iss:"http://localhost:4102"` (the same value for both impls), `aud:"lab02-api"`, `sub`, `iat`, `exp`=+300s, `jti`
  - `GET /api/profile` (Bearer) → 200 `{sub,email}` | 401 + `WWW-Authenticate: Bearer error="invalid_token"`
  - `POST /refresh` (cookie rt) → 200 new access token + rotated rt
    - reusing an already-rotated rt → 401 and the whole family is revoked
    - table `lab02.refresh_tokens(id sha256, family_id, user_id, used_at, revoked_at, expires_at)`
  - `POST /logout` → revokes the family, clears the rt cookie, 204
  - `POST /__attack/sign {header, payload, mode:"none"|"hs256-with-public-key"|"expired"}` → returns a forged token for attack demos (vulnerable-lab helper; the forgery is public-knowledge, no secret needed)
- Verification: secure uses golang-jwt / jose with `alg` pinned to RS256 and checks `exp`, `aud` and `iss`. Vulnerable mode uses `naive.*`, a hand-written verifier that trusts the header `alg`: it accepts `none`, does HS256 with the public PEM as secret, and ignores `exp`/`aud`.

- [ ] **Step 1: Failing contract tests**:

```ts
test("jwks has one RS256 key with kid matching token header", ...)
test("profile with valid token → 200; tampered payload → 401", ...)
test("alg none token: secure → 401, vulnerable → 200", ...)
test("hs256-with-public-key token: secure → 401, vulnerable → 200", ...)
test("expired token: secure → 401, vulnerable → 200", ...)
test("refresh rotates rt; reusing old rt → 401; then new rt also → 401 (family revoked)", ...)
test("logout then refresh → 401", ...)
test("interop: token from other impl verifies here", ...)          // Review Focus #5 (OTHER_URL, else skip)
```

- [ ] **Step 2:** Run `node scripts/contract.mjs 02 go`. Expected: FAIL.
- [ ] **Step 3:** Implement both.
- [ ] **Step 4:** Run `node scripts/contract.mjs 02 go`, `… 02 ts`, `go test ./labs/02-jwt/go/...`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(lab02): JWT lab with refresh rotation and attack modes`.

### Task 13: Module 2 content

**Files:**
- Create: `content/m2/{01-jwt-anatomy,02-signing-jwks,03-access-refresh,04-token-storage,05-jwt-attacks,06-revocation,07-boss}/{lesson.ts,index.mdx}`
- Create: `content/flows/m2.ts`
- Create: `components/playground/{TokenDecoder.tsx,StorageSim.tsx,JwtAttackLab.tsx}`
- Test: `components/playground/m2.test.tsx`

**Interfaces:**
- `<TokenDecoder defaultToken?>`: paste a JWT and see colour-coded header.payload.signature segments, decoded JSON with claim explanations on hover (`iss, sub, aud, exp, iat, jti, kid, alg`), and `exp` as relative time. Optional "verify with JWKS URL" uses `jose` in the browser against the selected lab's JWKS. Invalid input shows inline errors and never throws.
- `<StorageSim>` (simulated): an injected "XSS script" tries to read the token from localStorage, sessionStorage, a JS variable in memory, and an HttpOnly cookie. It shows which leak and explains in-memory + HttpOnly refresh-cookie as the recommended pattern.
- `<JwtAttackLab>` (live): three attack cards (`alg-none`, `key-confusion`, `expired`). Each calls `/__attack/sign`, then `/api/profile` in both modes, and shows the result side by side. When all three are observed it sends the attack events `m2-l5/alg-none|key-confusion|expired`.

| Lesson | Analogy | Flow(s) | Quiz Qs | Lab tasks | Attack |
|---|---|---|---|---|---|
| m2-l1 jwt-anatomy | Concert wristband: readable by anyone, forgeable by no one | `statefulVsStateless` | 3 | – (TokenDecoder) | – |
| m2-l2 signing-jwks | Wax seal + public seal catalogue | `jwksVerify` | 3 | `jwks-fetched` (GET /.well-known/jwks.json → 200) | – |
| m2-l3 access-refresh | Day pass + membership card at the desk | `refreshRotation` | 3 | `login-access-token`, `refresh-rotated` (POST /refresh → 200 with set-cookie rt), `refresh-reuse-401` | – |
| m2-l4 token-storage | Wallet in pocket vs note taped to the door | `xssTheft` | 3 | – (StorageSim) | `xss-storage` (simulated) |
| m2-l5 jwt-attacks | Guard who reads the "checked by" line written by the visitor | `algNone` | 3 | – | `alg-none`, `key-confusion`, `expired` (live) |
| m2-l6 revocation | Cancelling a lost card when the shop checks offline | `revocation` | 3 | `logout-revokes` (POST /refresh → 401 after logout) | – |
| m2-l7 boss | – | – | boss 10 | – | – |

- [ ] **Step 1: Failing tests**:
  - TokenDecoder decodes a fixture token and labels `exp`.
  - Garbage input shows an error without throwing.
  - StorageSim marks the HttpOnly cookie "not readable".
  - JwtAttackLab sends exactly 3 attack events (mock fetch).
- [ ] **Step 2:** Run `pnpm --filter academy vitest run components/playground`. Expected: FAIL.
- [ ] **Step 3:** Implement components, flows, lessons.
- [ ] **Step 4:** Run the tests. Expected: PASS. Then a manual walkthrough of m2-l3 against `pnpm lab 02 --ts`.
- [ ] **Step 5:** Commit `feat(content): module 2 JWT and tokens`.

### Task 14: Lab 03 — OAuth 2.0 + PKCE (Go + TS + shared SPA)

**Files:**
- Create: `labs/03-oauth-pkce/client-spa/index.html` (vanilla JS, shared by both impls)
- Create: `labs/03-oauth-pkce/go/{go.mod (authacademy/lab03),main.go,as.go,pkce.go,clients.go,api.go,pages.go,as_test.go}`
- Create: `labs/03-oauth-pkce/ts/src/{main.ts,as.ts,pkce.ts,clients.ts,api.ts,pages.ts}`
- Test: `labs/contract/lab03.test.ts`

**Interfaces (HTTP contract). One process, three listeners: AS, client, API:**
- Clients (static config):
  - `demo-spa`: public, `redirect_uris:["http://localhost:{4113|4213}/callback"]`, scopes `photos.read profile`, PKCE required (S256 only)
  - `demo-backend`: confidential, `client_secret:"lab-secret"`, `client_credentials` with scope `photos.read`
- Seeded user `alice@example.com` / `correct-horse-battery`. AS session is a cookie `as_sid` (reuses the lab01 pattern, in-memory map). Comment: `shortcut: in-memory AS sessions, fine for a single-process lab`.
- AS routes:
  - `GET /authorize`
    - Unknown client or redirect_uri not an **exact** match → 400 HTML error page; never redirects.
    - Not logged in → login page.
    - Then a consent page listing scopes.
    - Approve → `302 redirect_uri?code&state`; deny → `302 redirect_uri?error=access_denied&state`.
    - `code` lives 60s, single use, bound to client_id, redirect_uri, code_challenge and scope.
  - `POST /token` (form):
    - `authorization_code` requires `code_verifier` where `BASE64URL(SHA256(verifier)) == challenge` (constant-time) → `{access_token, token_type, expires_in:300, scope}`. Errors use RFC 6749 JSON `{error:"invalid_grant"}` 400.
    - Code reuse → 400 and revokes tokens issued from that code.
    - `client_credentials` with basic auth → token with `sub:"demo-backend"`.
  - `GET /.well-known/jwks.json` (RSA key from `lab03.keys`, same scheme as lab02)
  - `/__trace` serves the shared hub for all three roles
- Client (4113/4213): serves `client-spa/index.html`, which:
  - generates verifier/state, stores them in sessionStorage
  - redirects to `/authorize` and handles `/callback` (checks `state`)
  - exchanges the code via CORS POST `/token`, then calls the API
  - renders each step in a numbered log on the page
- API (4123/4223): `GET /api/photos` needs a Bearer JWT with `aud:"lab03-api"` and scope `photos.read`.
  - 401 invalid; 403 `{error:"insufficient_scope"}`
  - verifies via the AS JWKS (cached 5 min)
- Vulnerable mode (header on `/authorize` is impossible via browser navigation, so use query `lab_mode=vulnerable` on `/authorize` and the `X-Lab-Mode` header on `/token`):
  - PKCE not required for demo-spa
  - redirect_uri prefix match accepted
- Attack helper: `POST /__attack/intercept {code}` replays a token exchange as a "malicious app" without a verifier. It shows success only for codes issued in vulnerable mode.

- [ ] **Step 1: Failing contract tests** (driving `/authorize` with a cookie jar and following the login/consent forms via fetch):

```ts
test("full code+PKCE flow returns token; /api/photos → 200", ...)
test("wrong code_verifier → 400 invalid_grant", ...)
test("code reused → 400", ...)
test("redirect_uri not exact (…/callback/evil) → 400 page, no Location header", ...)
test("vulnerable: no PKCE accepted and intercept succeeds; secure: intercept → 400", ...)
test("token with scope profile only → /api/photos 403 insufficient_scope", ...)
test("client_credentials with wrong secret → 401 invalid_client; right → 200", ...)
test("deny consent → redirect with error=access_denied and original state", ...)
test("interop: Go-issued token accepted by TS API", ...)          // Review Focus #5
```

  Go unit test: the PKCE S256 RFC 7636 Appendix B vector (`dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk` → `E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`).
- [ ] **Step 2:** Run `node scripts/contract.mjs 03 go`. Expected: FAIL.
- [ ] **Step 3:** Implement both and the shared SPA.
- [ ] **Step 4:** Run `node scripts/contract.mjs 03 go`, `… 03 ts`, `go test ./labs/03-oauth-pkce/go/...`. Expected: PASS. Then open `http://localhost:4113` by hand and complete the flow.
- [ ] **Step 5:** Commit `feat(lab03): OAuth2 authorization server, PKCE SPA client and resource API`.

### Task 15: Module 3 content

**Files:**
- Create: `content/m3/{01-delegation,02-auth-code-flow,03-client-types,04-pkce,05-scopes-state-redirect,06-client-credentials,07-summary-boss}/{lesson.ts,index.mdx}`
- Create: `content/flows/m3.ts`
- Create: `components/playground/{PkceGenerator.tsx,InterceptionAttack.tsx,OAuthUrlBuilder.tsx}`
- Test: `components/playground/m3.test.tsx`

**Interfaces:**
- `<PkceGenerator>`:
  - generates a verifier (43–128 chars) and computes the S256 challenge step by step: bytes → SHA-256 hex → base64url
  - "Edit verifier" recomputes live
  - a test button posts a wrong verifier to the lab and shows `invalid_grant`
- `<OAuthUrlBuilder>`: form fields for client_id, redirect_uri, scope, state and challenge. It builds and annotates the `/authorize` URL, and "Open" launches it in a new tab against the selected impl.
- `<InterceptionAttack>` (live): a mobile-app style diagram with a malicious app registered on the same custom scheme. It runs `/__attack/intercept` with codes from vulnerable and secure flows and shows the outcomes. Sends `m3-l4/code-interception`.
- Redirect attack (`m3-l5/redirect-prefix`) uses `OAuthUrlBuilder` with an `…/callback.evil` redirect in both modes.

| Lesson | Analogy | Flow(s) | Quiz Qs | Lab tasks | Attack |
|---|---|---|---|---|---|
| m3-l1 delegation | Valet key: drives the car, can't open the trunk | `oauthRoles` | 3 | – | – |
| m3-l2 auth-code-flow | Claim ticket exchanged at the counter for the coat | `authCode` | 3 | `authorize-302-code`, `token-200`, `api-200-bearer` | – |
| m3-l3 client-types | Diary on a shared table vs in a locked drawer | `implicitDeprecated` | 3 | – | – |
| m3-l4 pkce | Tear a ticket in half; only the matching half redeems it | `authCodePkce`, `codeInterception` | 3 | `token-400-bad-verifier` | `code-interception` (live) |
| m3-l5 scopes-state-redirect | Return address on the envelope must match exactly | `stateCsrf` | 3 | `api-403-scope`, `authorize-400-redirect` | `redirect-prefix` (live) |
| m3-l6 client-credentials | Company badge for the delivery robot, no human involved | `clientCredentials` | 3 | `client-credentials-200` | – |
| m3-l7 summary-boss | OAuth 2.1/BCP checklist | – | boss 10 | – | – |

m3-l6 ends with a "Coming in Phase 2" callout. It shows the user's SSO architecture diagram (sso-frontend, sso-backend, core-api, platforms A/B/C) as a `SequenceFlow` (`ssoPreview`).

- [ ] **Step 1: Failing tests**:
  - PkceGenerator with the RFC 7636 verifier shows the RFC challenge.
  - OAuthUrlBuilder encodes scope spaces as `%20` and includes `code_challenge_method=S256`.
  - InterceptionAttack sends the event only after both outcomes.
- [ ] **Step 2:** Run `pnpm --filter academy vitest run components/playground`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS. Then a manual walkthrough of m3-l2 and m3-l4 against `pnpm lab 03`.
- [ ] **Step 5:** Commit `feat(content): module 3 OAuth2 and PKCE`.

### Task 16: Screenshots, e2e, accessibility, polish

**Files:**
- Create: `scripts/shots.ts`, `apps/academy/playwright.config.ts`, `apps/academy/e2e/{m1.spec.ts,m2.spec.ts,m3.spec.ts,a11y.spec.ts}`
- Modify: lesson MDX files to reference `<Shot>` images in `public/shots/`

**Interfaces:**
- `pnpm shots`: starts lab01 and lab03 (Go) and captures PNGs at 1280×800:
  - `lab01-login.png`, `lab01-devtools-cookie.png` (render a page showing `document.cookie` vs the cookie list from CDP `Network.getCookies` to illustrate HttpOnly)
  - `lab03-login.png`, `lab03-consent.png`, `lab03-spa-log.png`
- Playwright `webServer`: academy `pnpm dev` + `node scripts/lab.mjs 01 --go` (+ 02, 03), with `reuseExistingServer`.

- [ ] **Step 1: Write e2e specs**:
  - **m1**: register → open m1-l3 → complete steps and pass the gated quiz → click LabConsole "Login" → task `set-cookie-httponly` ticks → XP bar increases → reload → state restored.
  - **m2**: m2-l5 → run all JwtAttackLab cards → 3 attack ticks.
  - **m3**: m3-l2 → run the flow in the SPA tab → 3 lab tasks tick.
  - **a11y**: axe on the dashboard and m1-l3 has no `serious`/`critical` violations. Keyboard: Tab reaches SequenceFlow Next and ArrowRight advances.
- [ ] **Step 2:** Run `docker compose up -d; pnpm --filter academy exec playwright test`. Expected: failures point at real gaps; fix them in the owning components.
- [ ] **Step 3:** Run `pnpm shots` and wire `<Shot>` into m1-l3, m3-l2, m3-l4. Then do a design polish pass with the `impeccable` skill on the dashboard, lesson page and Inspector (spacing, hierarchy, dark mode, 375px width with no horizontal scroll).
- [ ] **Step 4:** Run the full verification:

  ```bash
  pnpm -r test
  go test ./...
  for l in 01 02 03; do node scripts/contract.mjs $l go; node scripts/contract.mjs $l ts; done
  pnpm --filter academy build
  pnpm --filter academy exec playwright test
  ```

  Expected: all PASS.
- [ ] **Step 5:** Update `README.md` (setup: `pnpm i`, `docker compose up -d`, `pnpm --filter academy drizzle-kit migrate`, `pnpm dev`, `pnpm lab 01`). Commit `test: e2e, screenshots, a11y and polish`.
