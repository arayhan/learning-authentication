// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressProvider } from "@/components/game/ProgressProvider";
import { LessonProvider } from "@/components/lesson/LessonProvider";
import type { LessonMeta, TraceEvent, XpEvent } from "@/lib/course/types";
import { Inspector } from "./Inspector";
import { LabConsole } from "./LabConsole";
import { LabImplProvider } from "./LabImpl";
import { LabTasks } from "./LabTasks";
import { parseSetCookie } from "./TraceDetail";

const lessonMock = vi.hoisted(() => ({ lesson: null as unknown }));
vi.mock("@/lib/course/registry", () => ({ getLesson: () => lessonMock.lesson }));

class MockEventSource {
  static instances: MockEventSource[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
  open() {
    this.onopen?.();
  }
  emit(e: unknown) {
    this.onmessage?.({ data: typeof e === "string" ? e : JSON.stringify(e) });
  }
  fail() {
    this.onerror?.();
  }
}
const last = () => MockEventSource.instances[MockEventSource.instances.length - 1];

const ev = (id: string, over: Partial<TraceEvent> = {}, path = "/me"): TraceEvent => ({
  id,
  ts: "2026-01-01T00:00:00Z",
  lab: "01",
  impl: "go",
  role: "app",
  req: { method: "GET", path, query: "", headers: { host: "127.0.0.1:4101" } },
  res: { status: 200, headers: { "content-type": "application/json" }, body: '{"ok":true}' },
  durationMs: 3,
  ...over,
});

const progress = (completed: string[]) => ({ completed, xp: 0, level: { name: "Intern", min: 0, next: 300 }, badges: [], streak: 0 });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

function fakeServer(completed: string[] = [], opts: { unauthorized?: boolean } = {}) {
  const done = [...completed];
  const posts: XpEvent[] = [];
  let unauthorized = !!opts.unauthorized;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/auth/login") {
        unauthorized = false;
        return json(200, { ok: true });
      }
      if (init?.method !== "POST") return json(200, progress(done));
      if (unauthorized) return json(401, { error: "Unauthorized" });
      const { event } = JSON.parse(init.body as string) as { event: XpEvent };
      posts.push(event);
      done.push(event.ref);
      return json(200, { ...progress(done), gained: 15, newBadges: [] });
    }),
  );
  return { posts };
}

const wrap = (ui: React.ReactNode, completed: string[] = []) =>
  render(
    <LabImplProvider>
      <ProgressProvider initial={progress(completed)}>
        <LessonProvider lessonId="m1-l1">{ui}</LessonProvider>
      </ProgressProvider>
    </LabImplProvider>,
  );

beforeEach(() => {
  MockEventSource.instances = [];
  vi.stubGlobal("EventSource", MockEventSource);
  localStorage.clear();
  lessonMock.lesson = {
    id: "m1-l1",
    labTasks: [
      { id: "login", label: "Log in", lab: "01", hint: "POST /login", match: (e: TraceEvent) => e.req.path === "/login" && e.res.status === 200 },
    ],
  } as unknown as LessonMeta;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Inspector", () => {
  it("offline when the stream errors: shows the start command and keeps retrying", () => {
    vi.useFakeTimers();
    wrap(<Inspector lab="01" />);
    act(() => last().fail());
    expect(screen.getByText("Lab 01 (Go) is not running")).toBeInTheDocument();
    expect(screen.getByText("pnpm lab 01 --go")).toBeInTheDocument();
    expect(screen.getByText("Retrying…")).toBeInTheDocument();
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].closed).toBe(true);
    act(() => void vi.advanceTimersByTime(3000));
    expect(MockEventSource.instances).toHaveLength(2);
    expect(last().url).toBe("http://localhost:4101/__trace");
  });

  it("renders a row once the stream opens and emits, newest on top", () => {
    wrap(<Inspector lab="01" />);
    act(() => {
      last().open();
      last().emit(ev("a", {}, "/first"));
      last().emit(ev("b", { res: { status: 401, headers: {} } }, "/second"));
    });
    expect(screen.queryByText("Lab 01 (Go) is not running")).not.toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "Requests" })).getAllByRole("button");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("/second");
    expect(rows[0]).toHaveTextContent("401");
    expect(rows[1]).toHaveTextContent("/first");
  });

  it("dedupes events replayed on reconnect and ignores malformed messages", () => {
    vi.useFakeTimers();
    wrap(<Inspector lab="01" />);
    act(() => {
      last().open();
      last().emit(ev("a"));
      last().emit("not json {");
      last().emit("null");
      last().emit({ nope: 1 });
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    act(() => last().fail());
    act(() => void vi.advanceTimersByTime(3000));
    act(() => {
      last().open();
      last().emit(ev("a")); // replay
      last().emit(ev("b"));
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("clear empties the list; replays do not resurrect cleared rows", async () => {
    wrap(<Inspector lab="01" />);
    act(() => {
      last().open();
      last().emit(ev("a"));
    });
    await userEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(screen.queryByRole("list", { name: "Requests" })).not.toBeInTheDocument();
    act(() => last().emit(ev("a")));
    expect(screen.queryByRole("list", { name: "Requests" })).not.toBeInTheDocument();
  });

  it("switching impl closes the old EventSource and opens the new port", async () => {
    wrap(<Inspector lab="01" />);
    const first = last();
    expect(first.url).toBe("http://localhost:4101/__trace");
    await userEvent.click(screen.getByRole("radio", { name: "TS" }));
    expect(first.closed).toBe(true);
    expect(last().url).toBe("http://localhost:4201/__trace");
    expect(localStorage.getItem("academy:lab-impl")).toBe("ts");
  });

  it("lab 03 listens on the authorization server port", () => {
    wrap(<Inspector lab="03" />);
    expect(last().url).toBe("http://localhost:4103/__trace");
  });

  it("detail: cookies tab shows parsed Set-Cookie attributes, body is pretty, raw is HTTP text", async () => {
    wrap(<Inspector lab="01" />);
    act(() => {
      last().open();
      last().emit(
        ev("a", {
          req: { method: "POST", path: "/login", query: "x=1", headers: { "content-type": "application/json" }, body: '{"email":"a@b.c"}' },
          res: {
            status: 200,
            headers: { "set-cookie": ["sid=abc; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600", "theme=dark; Path=/"] },
            body: '{"ok":true}',
          },
        }),
      );
    });
    await userEvent.click(screen.getByRole("button", { name: /POST/ }));
    await userEvent.click(screen.getByRole("tab", { name: "Cookies" }));
    const table = screen.getByRole("table");
    const row = within(table).getByRole("row", { name: /sid/ });
    expect(row).toHaveTextContent("abc");
    expect(row).toHaveTextContent("Lax");
    expect(row).toHaveTextContent("3600");
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    await userEvent.click(screen.getByRole("tab", { name: "Body" }));
    expect(screen.getByText(/"email": "a@b.c"/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Raw" }));
    expect(screen.getByText(/POST \/login\?x=1 HTTP\/1\.1/)).toBeInTheDocument();
    expect(screen.getByText(/set-cookie: theme=dark; Path=\//)).toBeInTheDocument();
  });
});

describe("parseSetCookie", () => {
  it("parses name, value (with =) and attributes", () => {
    expect(parseSetCookie("sid=a=b; HttpOnly; Secure; SameSite=Strict; Path=/x; Max-Age=60; Expires=Wed, 01 Jan 2031 00:00:00 GMT")).toEqual({
      name: "sid",
      value: "a=b",
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      path: "/x",
      maxAge: "60",
      expires: "Wed, 01 Jan 2031 00:00:00 GMT",
    });
  });
});

describe("LabTasks", () => {
  const login = (id: string) => ev(id, { req: { method: "POST", path: "/login", query: "", headers: {} } });

  it("ticks and sends once even when 3 matching events arrive", async () => {
    const server = fakeServer();
    wrap(<LabTasks />);
    expect(screen.getByText("POST /login")).toBeInTheDocument();
    act(() => {
      last().open();
      last().emit(login("1"));
      last().emit(login("2"));
    });
    act(() => last().emit(login("3")));
    await waitFor(() => expect(screen.getByText(/\(done\)/)).toBeInTheDocument());
    expect(server.posts).toEqual([{ kind: "lab-task", ref: "m1-l1/login" }]);
  });

  it("never re-sends a task that is already completed", async () => {
    const server = fakeServer(["m1-l1/login"]);
    wrap(<LabTasks />, ["m1-l1/login"]);
    expect(screen.getByText(/\(done\)/)).toBeInTheDocument();
    act(() => {
      last().open();
      last().emit(login("1"));
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(server.posts).toEqual([]);
  });

  it("stays unticked on 401 and retries after re-login", async () => {
    const server = fakeServer([], { unauthorized: true });
    wrap(<LabTasks />);
    act(() => {
      last().open();
      last().emit(login("1"));
    });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/\(not done\)/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByText(/\(done\)/)).toBeInTheDocument());
    expect(server.posts).toEqual([{ kind: "lab-task", ref: "m1-l1/login" }]);
  });

  it("shows the offline card with the start command when the lab is down", () => {
    fakeServer();
    wrap(<LabTasks />);
    act(() => last().fail());
    expect(screen.getByText("Lab 01 (Go) is not running")).toBeInTheDocument();
    expect(screen.getByText("pnpm lab 01 --go")).toBeInTheDocument();
  });

  it("renders nothing for a lesson without lab tasks", () => {
    lessonMock.lesson = { id: "m1-l1", labTasks: [] };
    const { container } = wrap(<LabTasks />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("LabConsole", () => {
  it("sends with credentials, adds X-Lab-Mode for vulnerable actions and shows the response", async () => {
    const f = vi.fn(async () => new Response('{"user":"a"}', { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", f);
    wrap(
      <LabConsole
        lab="01"
        actions={[
          { label: "Whoami", method: "GET", path: "/me" },
          { label: "Login", method: "POST", path: "/login", body: { email: "a" }, vulnerable: true },
        ]}
      />,
    );
    expect(screen.getByText("vulnerable mode")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Login/ }));
    const labCalls = () => (f.mock.calls as unknown as [string, RequestInit][]).filter(([u]) => u.startsWith("http://localhost"));
    const [url, init] = labCalls()[0];
    expect(url).toBe("http://localhost:4101/login");
    expect(init.credentials).toBe("include");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"email":"a"}');
    expect(init.headers).toMatchObject({ "X-Lab-Mode": "vulnerable", "Content-Type": "application/json" });
    expect(await screen.findByText(/"user": "a"/)).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Whoami/ }));
    expect(labCalls()[1][1].headers).not.toHaveProperty("X-Lab-Mode");
  });

  it("replaces {{csrfToken}} in headers and body with the token from the latest login response", async () => {
    const f = vi.fn(async (url: string) =>
      url.endsWith("/login")
        ? new Response('{"csrfToken":"tok-123"}', { status: 200, headers: { "content-type": "application/json" } })
        : new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", f);
    wrap(
      <LabConsole
        lab="01"
        actions={[
          { label: "Login", method: "POST", path: "/login", body: { email: "a" } },
          { label: "Transfer", method: "POST", path: "/transfer", headers: { "X-CSRF-Token": "{{csrfToken}}" }, body: { to: "bob", note: "{{csrfToken}}" } },
          { label: "Whoami", method: "GET", path: "/me" },
        ]}
      />,
    );
    const labCalls = () => (f.mock.calls as unknown as [string, RequestInit][]).filter(([u]) => u.startsWith("http://localhost"));
    // before any login: empty token and a hint
    expect(screen.getByText("Log in first to get a CSRF token")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Transfer/ }));
    expect(labCalls()[0][1].headers).toMatchObject({ "X-CSRF-Token": "" });

    await userEvent.click(screen.getByRole("button", { name: /Login/ }));
    await screen.findByText(/tok-123/);
    expect(screen.queryByText("Log in first to get a CSRF token")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Whoami/ })); // a response without csrfToken keeps the token
    await userEvent.click(screen.getByRole("button", { name: /Transfer/ }));
    const init = labCalls()[3][1];
    expect(init.headers).toMatchObject({ "X-CSRF-Token": "tok-123" });
    expect(init.body).toBe('{"to":"bob","note":"tok-123"}');
  });

  it("shows the start command instead of throwing when the lab is offline", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    wrap(<LabConsole lab="02" actions={[{ label: "JWKS", method: "GET", path: "/jwks.json" }]} />);
    await userEvent.click(screen.getByRole("button", { name: /JWKS/ }));
    expect(await screen.findByText("Lab 02 (Go) is not running")).toBeInTheDocument();
    expect(screen.getByText("pnpm lab 02 --go")).toBeInTheDocument();
  });
});
