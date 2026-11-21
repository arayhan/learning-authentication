// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { pbkdf2Sync, webcrypto } from "node:crypto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressProvider } from "@/components/game/ProgressProvider";
import type { XpEvent } from "@/lib/course/types";
import { CsrfSim } from "./CsrfSim";
import { FixationAttack } from "./FixationAttack";
import { HashPlayground } from "./HashPlayground";
import { LabImplProvider } from "./LabImpl";

const progress = { completed: [] as string[], xp: 0, level: { name: "Intern", min: 0, next: 300 }, badges: [], streak: 0 };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const wrap = (ui: React.ReactNode) =>
  render(
    <LabImplProvider>
      <ProgressProvider initial={progress}>{ui}</ProgressProvider>
    </LabImplProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("crypto", webcrypto); // jsdom has no SubtleCrypto
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HashPlayground", () => {
  const out = (name: RegExp) => screen.getByRole("status", { name }).textContent ?? "";

  it("different salts give different hashes for the same password, and PBKDF2 matches a reference implementation", async () => {
    wrap(<HashPlayground />);
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "hunter2" } });
    fireEvent.change(screen.getByLabelText("Salt A"), { target: { value: "aaaa" } });
    fireEvent.change(screen.getByLabelText("Salt B"), { target: { value: "bbbb" } });
    fireEvent.change(screen.getByLabelText(/Iterasi/), { target: { value: "1000" } });
    await waitFor(() => expect(out(/PBKDF2.*salt A/)).toMatch(/^[0-9a-f]{64}$/));
    await waitFor(() => expect(out(/PBKDF2.*salt B/)).toMatch(/^[0-9a-f]{64}$/));
    const [pa, pb] = [out(/PBKDF2.*salt A/), out(/PBKDF2.*salt B/)];
    const [sa, sb] = [out(/SHA-256.*salt A/), out(/SHA-256.*salt B/)];
    expect(sa).toMatch(/^[0-9a-f]{64}$/);
    expect(sa).not.toBe(sb);
    expect(pa).not.toBe(pb);
    expect(pa).toBe(pbkdf2Sync("hunter2", "aaaa", 1000, 32, "sha256").toString("hex"));
    expect(screen.getAllByText(/^\d+ ms$/)).toHaveLength(2);
  });

  it("shows 'hashing…' while a slow derivation runs, and says the lab uses argon2id", async () => {
    wrap(<HashPlayground />);
    expect(screen.getByText(/argon2id/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "x" } });
    expect(screen.getAllByText("lagi nge-hash…").length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByText("lagi nge-hash…")).not.toBeInTheDocument());
  });
});

describe("CsrfSim", () => {
  function fakeProgress() {
    const posts: XpEvent[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method !== "POST") return json(200, progress);
        posts.push((JSON.parse(init.body as string) as { event: XpEvent }).event);
        return json(200, { ...progress, gained: 30, newBadges: [] });
      }),
    );
    return posts;
  }
  const send = () => userEvent.click(screen.getByRole("button", { name: /kirim forged request/i }));
  const toggle = (name: RegExp) => userEvent.click(screen.getByRole("checkbox", { name }));
  const verdict = () => {
    const text = within(screen.getByRole("status", { name: "Hasil" })).getByText(/forged request/i).textContent ?? "";
    return /diblokir/i.test(text) ? "blocked" : /berhasil/i.test(text) ? "succeeded" : text;
  };

  it("the forged request goes through with every defense off", async () => {
    fakeProgress();
    wrap(<CsrfSim />);
    await send();
    expect(verdict()).toBe("succeeded");
  });

  it("marks the forged request blocked when SameSite=Lax is on", async () => {
    fakeProgress();
    wrap(<CsrfSim />);
    await toggle(/SameSite=Lax/);
    await send();
    expect(verdict()).toBe("blocked");
  });

  it("each defense on its own blocks the forged request", async () => {
    fakeProgress();
    wrap(<CsrfSim />);
    await toggle(/CSRF token/);
    await send();
    expect(verdict()).toBe("blocked");
    await toggle(/CSRF token/);
    await toggle(/Origin check/);
    await send();
    expect(verdict()).toBe("blocked");
  });

  it("sends the attack event once: success with nothing on, then blocked by each defense alone", async () => {
    const posts = fakeProgress();
    wrap(<CsrfSim />);
    await send(); // all off: succeeds
    await toggle(/SameSite=Lax/);
    await send();
    await toggle(/SameSite=Lax/);
    await toggle(/CSRF token/);
    await send();
    await toggle(/CSRF token/);
    expect(posts).toEqual([]);
    await toggle(/Origin check/);
    await send();
    await waitFor(() => expect(posts).toEqual([{ kind: "attack", ref: "m1-l5/csrf" }]));
    await send();
    expect(posts).toHaveLength(1);
  });
});

describe("FixationAttack", () => {
  type Call = { url: string; init: RequestInit };
  function fakeLab(opts: { offline?: boolean } = {}) {
    const lab: Call[] = [];
    const posts: XpEvent[] = [];
    let lastLoginVulnerable = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        if (url.startsWith("/api/progress")) {
          if (init.method !== "POST") return json(200, progress);
          posts.push((JSON.parse(init.body as string) as { event: XpEvent }).event);
          return json(200, { ...progress, gained: 30, newBadges: [] });
        }
        if (opts.offline) throw new TypeError("Failed to fetch");
        lab.push({ url, init });
        const headers = (init.headers ?? {}) as Record<string, string>;
        if (url.endsWith("/register")) return json(409, { error: "email already registered" });
        if (url.endsWith("/__attack/plant-sid")) return json(200, { ok: true });
        if (url.endsWith("/login")) {
          lastLoginVulnerable = headers["X-Lab-Mode"] === "vulnerable";
          return json(200, { csrfToken: "t" });
        }
        if (url.endsWith("/__attack/as")) return json(200, { status: lastLoginVulnerable ? 200 : 401, body: lastLoginVulnerable ? '{"email":"v@x.co"}' : '{"error":"unauthorized"}' });
        return json(404, {});
      }),
    );
    return { lab, posts };
  }
  const run = (mode: "vulnerable" | "secure") => userEvent.click(screen.getByRole("button", { name: new RegExp(`jalankan ${mode}`, "i") }));

  it("sends the attack event only after both modes were observed", async () => {
    const { lab, posts } = fakeLab();
    wrap(<FixationAttack />);
    await run("vulnerable");
    expect(await screen.findByText("200")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 30));
    expect(posts).toEqual([]);
    await run("secure");
    expect(await screen.findByText("401")).toBeInTheDocument();
    await waitFor(() => expect(posts).toEqual([{ kind: "attack", ref: "m1-l4/fixation" }]));

    // every lab call is credentialed, hits the Go lab, and only the vulnerable run's login opts into vulnerable mode
    expect(lab.every((c) => c.url.startsWith("http://localhost:4101/") && c.init.credentials === "include")).toBe(true);
    const logins = lab.filter((c) => c.url.endsWith("/login")).map((c) => (c.init.headers as Record<string, string>)["X-Lab-Mode"]);
    expect(logins).toEqual(["vulnerable", undefined]);
    expect(lab.filter((c) => c.url.endsWith("/plant-sid")).every((c) => (c.init.headers as Record<string, string>)["X-Lab-Mode"] === "vulnerable")).toBe(true);
    const asBodies = lab.filter((c) => c.url.endsWith("/__attack/as")).map((c) => JSON.parse(c.init.body as string));
    expect(asBodies.map((b) => b.path)).toEqual(["/me", "/me"]);
  });

  it("degrades to the offline card when the lab is not running", async () => {
    const { posts } = fakeLab({ offline: true });
    wrap(<FixationAttack />);
    await run("vulnerable");
    expect(await screen.findByText("Lab 01 (Go) belum jalan")).toBeInTheDocument();
    expect(screen.getByText("pnpm lab 01 --go")).toBeInTheDocument();
    expect(posts).toEqual([]);
  });
});
