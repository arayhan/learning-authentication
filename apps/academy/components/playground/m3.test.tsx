// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createHash, webcrypto } from "node:crypto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressProvider } from "@/components/game/ProgressProvider";
import type { TraceEvent, XpEvent } from "@/lib/course/types";
import { InterceptionAttack } from "./InterceptionAttack";
import { LabImplProvider } from "./LabImpl";
import { OAuthUrlBuilder } from "./OAuthUrlBuilder";
import { PkceGenerator } from "./PkceGenerator";
import { RFC_CHALLENGE, RFC_VERIFIER } from "./oauth";

const progress = { completed: [] as string[], xp: 0, level: { name: "Intern", min: 0, next: 300 }, badges: [], streak: 0 };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const wrap = (ui: React.ReactNode) =>
  render(
    <LabImplProvider>
      <ProgressProvider initial={progress}>{ui}</ProgressProvider>
    </LabImplProvider>,
  );

/** Replies to /api/progress (recording the POSTed events) and hands everything else to `lab`. */
function fakeFetch(lab: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const posts: XpEvent[] = [];
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url.startsWith("/api/progress")) {
        if (init.method !== "POST") return json(200, progress);
        posts.push((JSON.parse(init.body as string) as { event: XpEvent }).event);
        return json(200, { ...progress, gained: 30, newBadges: [] });
      }
      calls.push({ url, init });
      return lab(url, init);
    }),
  );
  return { posts, calls };
}

class MockEventSource {
  static instances: MockEventSource[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }
  close() {}
}
const stream = () => MockEventSource.instances[MockEventSource.instances.length - 1];

beforeEach(() => {
  localStorage.clear();
  MockEventSource.instances = [];
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("EventSource", MockEventSource);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const settle = () => new Promise((r) => setTimeout(r, 30));

describe("PkceGenerator", () => {
  it("reproduces the RFC 7636 Appendix B challenge step by step", async () => {
    fakeFetch(() => json(404, {}));
    wrap(<PkceGenerator />);
    fireEvent.change(screen.getByLabelText("Code verifier"), { target: { value: RFC_VERIFIER } });
    await waitFor(() => expect(screen.getByLabelText("code_challenge")).toHaveTextContent(RFC_CHALLENGE));
    expect(screen.getByLabelText("SHA-256 digest (hex)")).toHaveTextContent(createHash("sha256").update(RFC_VERIFIER).digest("hex"));
    expect(screen.getByLabelText("Verifier bytes (hex)")).toHaveTextContent(Buffer.from(RFC_VERIFIER).toString("hex"));
  });

  it("starts with a random verifier of 43 to 128 characters and recomputes live when edited", async () => {
    fakeFetch(() => json(404, {}));
    wrap(<PkceGenerator />);
    const box = screen.getByLabelText("Code verifier") as HTMLTextAreaElement;
    await waitFor(() => expect(box.value).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/));
    const first = (await screen.findByLabelText("code_challenge")).textContent;
    fireEvent.change(box, { target: { value: `${box.value}x` } });
    await waitFor(() => expect(screen.getByLabelText("code_challenge").textContent).not.toBe(first));
  });

  it("rejects a verifier that is too short or has illegal characters, and shows no challenge", async () => {
    fakeFetch(() => json(404, {}));
    wrap(<PkceGenerator />);
    const box = screen.getByLabelText("Code verifier");
    for (const bad of ["short", `${RFC_VERIFIER}!`, "é".repeat(50)]) {
      fireEvent.change(box, { target: { value: bad } });
      expect(await screen.findByRole("alert")).toHaveTextContent(/43.*128/);
      expect(screen.queryByLabelText("code_challenge")).not.toBeInTheDocument();
    }
  });

  it("posts a WRONG verifier to the lab /token and shows invalid_grant", async () => {
    const { calls } = fakeFetch(() => json(400, { error: "invalid_grant" }));
    wrap(<PkceGenerator />);
    fireEvent.change(screen.getByLabelText("Code verifier"), { target: { value: RFC_VERIFIER } });
    await userEvent.click(screen.getByRole("button", { name: /test a wrong verifier/i }));
    expect(await screen.findByText("invalid_grant")).toBeInTheDocument();
    const c = calls[0];
    expect(c.url).toBe("http://localhost:4103/token");
    expect(c.init.method).toBe("POST");
    expect((c.init.headers as Record<string, string>)["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const body = new URLSearchParams(c.init.body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("client_id")).toBe("demo-spa");
    expect(body.get("redirect_uri")).toBe("http://localhost:4113/callback");
    expect(body.get("code_verifier")).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);
    expect(body.get("code_verifier")).not.toBe(RFC_VERIFIER);
  });

  it("sends the pasted authorization code when there is one", async () => {
    const { calls } = fakeFetch(() => json(400, { error: "invalid_grant" }));
    wrap(<PkceGenerator />);
    fireEvent.change(screen.getByLabelText(/authorization code/i), { target: { value: " real-code " } });
    await userEvent.click(screen.getByRole("button", { name: /test a wrong verifier/i }));
    await screen.findByText("invalid_grant");
    expect(new URLSearchParams(calls[0].init.body as string).get("code")).toBe("real-code");
  });

  it("shows the offline card with the start command when the lab is down", async () => {
    fakeFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    wrap(<PkceGenerator />);
    await userEvent.click(screen.getByRole("button", { name: /test a wrong verifier/i }));
    expect(await screen.findByText("Lab 03 (Go) is not running")).toBeInTheDocument();
    expect(screen.getByText("pnpm lab 03 --go")).toBeInTheDocument();
  });
});

describe("OAuthUrlBuilder", () => {
  const url = () => screen.getByLabelText("Authorize URL").textContent!;

  it("encodes scope spaces as %20, encodes the redirect_uri and sends code_challenge_method=S256", () => {
    wrap(<OAuthUrlBuilder />);
    fireEvent.change(screen.getByLabelText("state"), { target: { value: "abc123" } });
    expect(url()).toMatch(/^http:\/\/localhost:4103\/authorize\?response_type=code&client_id=demo-spa&/);
    expect(url()).toContain("scope=photos.read%20profile");
    expect(url()).not.toContain("+");
    expect(url()).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A4113%2Fcallback");
    expect(url()).toContain("state=abc123");
    expect(url()).toContain(`code_challenge=${RFC_CHALLENGE}`);
    expect(url()).toContain("code_challenge_method=S256");
    expect(url()).not.toContain("lab_mode");
  });

  it("vulnerable mode adds lab_mode=vulnerable, and an empty challenge sends no PKCE parameters", () => {
    wrap(<OAuthUrlBuilder />);
    fireEvent.click(screen.getByLabelText(/vulnerable mode/i));
    fireEvent.change(screen.getByLabelText("code_challenge"), { target: { value: "" } });
    expect(url()).toContain("lab_mode=vulnerable");
    expect(url()).not.toContain("code_challenge");
  });

  it("Open launches the URL in a new tab against the selected implementation", async () => {
    localStorage.setItem("academy:lab-impl", "ts");
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    wrap(<OAuthUrlBuilder />);
    expect(url()).toMatch(/^http:\/\/localhost:4203\/authorize\?/);
    expect(url()).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A4213%2Fcallback");
    await userEvent.click(screen.getByRole("button", { name: /^open/i }));
    expect(open).toHaveBeenCalledWith(url(), "_blank", "noopener,noreferrer");
  });

  describe("redirect-prefix attack", () => {
    const labFor = (opts: { secure?: number; vulnerable?: number; offline?: boolean } = {}) => (u: string) => {
      if (opts.offline) throw new TypeError("Failed to fetch");
      return new Response("<html></html>", { status: u.includes("lab_mode=vulnerable") ? (opts.vulnerable ?? 200) : (opts.secure ?? 400) });
    };
    const run = () => userEvent.click(screen.getByRole("button", { name: /run redirect attack/i }));

    it("sends m3-l5/redirect-prefix once, after secure 400 and vulnerable 200 for a callback.evil redirect", async () => {
      const { posts, calls } = fakeFetch(labFor());
      wrap(<OAuthUrlBuilder attack />);
      await run();
      await waitFor(() => expect(posts).toEqual([{ kind: "attack", ref: "m3-l5/redirect-prefix" }]));
      await run();
      await settle();
      expect(posts).toHaveLength(1);
      expect(calls).toHaveLength(4);
      for (const c of calls) expect(c.url).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A4113%2Fcallback.evil");
      expect(calls[0].url).not.toContain("lab_mode");
      expect(calls[1].url).toContain("lab_mode=vulnerable");
    });

    it("sends nothing when the secure server accepts the evil redirect", async () => {
      const { posts } = fakeFetch(labFor({ secure: 200 }));
      wrap(<OAuthUrlBuilder attack />);
      await run();
      await settle();
      expect(posts).toEqual([]);
    });

    it("does not render the attack panel without the attack prop", () => {
      wrap(<OAuthUrlBuilder />);
      expect(screen.queryByRole("button", { name: /run redirect attack/i })).not.toBeInTheDocument();
    });

    it("degrades to the offline card when the lab is down", async () => {
      const { posts } = fakeFetch(labFor({ offline: true }));
      wrap(<OAuthUrlBuilder attack />);
      await run();
      expect(await screen.findByText("Lab 03 (Go) is not running")).toBeInTheDocument();
      expect(posts).toEqual([]);
    });
  });
});

describe("InterceptionAttack", () => {
  const consent = (id: string, state: string, code: string): TraceEvent => ({
    id,
    ts: "2026-01-01T00:00:00Z",
    lab: "03",
    impl: "go",
    role: "as",
    req: { method: "POST", path: "/consent", query: "", headers: {} },
    res: { status: 302, headers: { location: `http://localhost:4113/callback?code=${code}&state=${state}` } },
    durationMs: 2,
  });
  const emit = (...events: TraceEvent[]) =>
    act(() => {
      stream().onopen?.();
      for (const e of events) stream().onmessage?.({ data: JSON.stringify(e) });
    });
  // The lab: the code issued without PKCE can be redeemed by anyone; the one with a challenge cannot.
  const lab = (opts: { vulnerable?: number; secure?: number } = {}) => (u: string, init: RequestInit) => {
    if (!u.endsWith("/__attack/intercept")) return json(404, {});
    const { code } = JSON.parse(init.body as string) as { code: string };
    return code === "CODE-V" ? json(opts.vulnerable ?? 200, { access_token: "eyJ.stolen.token", token_type: "Bearer" }) : json(opts.secure ?? 400, { error: "invalid_grant" });
  };
  const replay = (slot: RegExp) => userEvent.click(screen.getByRole("button", { name: slot }));

  it("opens the authorize URLs: no PKCE with lab_mode=vulnerable, and a PKCE one", async () => {
    fakeFetch(lab());
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    wrap(<InterceptionAttack />);
    await userEvent.click(screen.getByRole("button", { name: /open the authorize page without pkce/i }));
    await userEvent.click(screen.getByRole("button", { name: /open the authorize page with pkce/i }));
    const [v, s] = open.mock.calls.map((c) => c[0] as string);
    expect(v).toContain("lab_mode=vulnerable");
    expect(v).toContain("state=m3-l4-vulnerable");
    expect(v).not.toContain("code_challenge");
    expect(s).toContain("code_challenge_method=S256");
    expect(s).toContain("state=m3-l4-secure");
    expect(s).not.toContain("lab_mode");
  });

  it("sends m3-l4/code-interception only after the vulnerable code works AND the PKCE code fails", async () => {
    const { posts, calls } = fakeFetch(lab());
    wrap(<InterceptionAttack />);
    expect(screen.getByRole("button", { name: /replay the code without pkce/i })).toBeDisabled(); // no code seen yet
    emit(consent("e1", "m3-l4-vulnerable", "CODE-V"), consent("e2", "m3-l4-secure", "CODE-S"));

    await replay(/replay the code without pkce/i);
    expect(await screen.findByText("200")).toBeInTheDocument();
    await settle();
    expect(posts).toEqual([]); // one outcome is not enough

    await replay(/replay the code with pkce/i);
    expect(await screen.findByText("400")).toBeInTheDocument();
    await waitFor(() => expect(posts).toEqual([{ kind: "attack", ref: "m3-l4/code-interception" }]));

    await replay(/replay the code with pkce/i);
    await settle();
    expect(posts).toHaveLength(1);

    const attacks = calls.filter((c) => c.url.endsWith("/__attack/intercept"));
    expect(attacks[0].url).toBe("http://localhost:4103/__attack/intercept");
    expect((attacks[0].init.headers as Record<string, string>)["X-Lab-Mode"]).toBe("vulnerable");
    expect(JSON.parse(attacks[0].init.body as string)).toEqual({ code: "CODE-V" });
  });

  it("order does not matter: PKCE code first, then the vulnerable one", async () => {
    const { posts } = fakeFetch(lab());
    wrap(<InterceptionAttack />);
    emit(consent("e1", "m3-l4-secure", "CODE-S"), consent("e2", "m3-l4-vulnerable", "CODE-V"));
    await replay(/replay the code with pkce/i);
    await screen.findByText("400");
    await settle();
    expect(posts).toEqual([]);
    await replay(/replay the code without pkce/i);
    await waitFor(() => expect(posts).toHaveLength(1));
  });

  it("sends nothing when the PKCE code is also accepted (that would not be the lesson)", async () => {
    const { posts } = fakeFetch(lab({ secure: 200 }));
    wrap(<InterceptionAttack />);
    emit(consent("e1", "m3-l4-vulnerable", "CODE-V"), consent("e2", "m3-l4-secure", "CODE-S"));
    await replay(/replay the code without pkce/i);
    await replay(/replay the code with pkce/i);
    expect(await screen.findAllByText("200")).toHaveLength(2);
    await settle();
    expect(posts).toEqual([]);
  });

  it("ignores consent events for other states, denials and non-302s", async () => {
    fakeFetch(lab());
    wrap(<InterceptionAttack />);
    const denied = consent("e3", "m3-l4-vulnerable", "x");
    denied.res.headers = { location: "http://localhost:4113/callback?error=access_denied&state=m3-l4-vulnerable" };
    emit(consent("e1", "some-other-flow", "CODE-X"), denied, { ...consent("e2", "m3-l4-vulnerable", "CODE-V"), res: { status: 200, headers: {} } });
    expect(screen.getByRole("button", { name: /replay the code without pkce/i })).toBeDisabled();
  });

  it("degrades to the offline card when the lab is down", async () => {
    const { posts } = fakeFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    wrap(<InterceptionAttack />);
    emit(consent("e1", "m3-l4-vulnerable", "CODE-V"));
    await replay(/replay the code without pkce/i);
    expect(await screen.findAllByText("Lab 03 (Go) is not running")).not.toHaveLength(0);
    expect(posts).toEqual([]);
  });
});
