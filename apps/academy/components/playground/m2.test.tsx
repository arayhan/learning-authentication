// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressProvider } from "@/components/game/ProgressProvider";
import type { XpEvent } from "@/lib/course/types";
import { LabImplProvider } from "./LabImpl";
import { JwtAttackLab } from "./JwtAttackLab";
import { StorageSim } from "./StorageSim";
import { TokenDecoder } from "./TokenDecoder";

const progress = { completed: [] as string[], xp: 0, level: { name: "Intern", min: 0, next: 300 }, badges: [], streak: 0 };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");

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

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("crypto", webcrypto);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const NOW = new Date("2026-11-21T10:00:00Z");
const nowSec = Math.floor(NOW.getTime() / 1000);
const token = (exp: number) =>
  [
    b64({ alg: "RS256", typ: "JWT", kid: "kid-1" }),
    b64({ iss: "http://localhost:4102", sub: "user-1", aud: "lab02-api", email: "alice@example.com", iat: nowSec, exp, jti: "j-1" }),
    "c2lnbmF0dXJl",
  ].join(".");

describe("TokenDecoder", () => {
  it("decodes a fixture token into colour-coded segments and labels exp as relative time", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    wrap(<TokenDecoder defaultToken={token(nowSec + 300)} />);
    expect(within(screen.getByLabelText("Header")).getByText(/"alg": "RS256"/)).toBeInTheDocument();
    expect(within(screen.getByLabelText("Payload")).getByText(/"email": "alice@example.com"/)).toBeInTheDocument();
    expect(within(screen.getByLabelText("Signature")).getByText("c2lnbmF0dXJl")).toBeInTheDocument();
    expect(screen.getByText("expires in 5 minutes")).toBeInTheDocument();
    // every known claim has an explanation
    for (const claim of ["iss", "sub", "aud", "exp", "iat", "jti", "kid", "alg"]) expect(screen.getByTestId(`claim-${claim}`)).toHaveAttribute("title");
  });

  it("says an expired token expired", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    wrap(<TokenDecoder defaultToken={token(nowSec - 7200)} />);
    expect(screen.getByText("expired 2 hours ago")).toBeInTheDocument();
  });

  it("shows an inline error for garbage input and never throws", () => {
    wrap(<TokenDecoder />);
    const box = screen.getByLabelText("JWT");
    for (const garbage of ["hello", "a.b.c", "....", "eyJ.eyJ.sig", "%%%.%%%.%%%", `${b64("str")}.${b64([1])}.x`, "a.b.c.d"]) {
      fireEvent.change(box, { target: { value: garbage } });
      expect(screen.getByRole("alert")).toHaveTextContent(/not a valid JWT/i);
      expect(screen.queryByLabelText("Header")).not.toBeInTheDocument();
    }
    fireEvent.change(box, { target: { value: "" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("survives claim names that exist on Object.prototype (__proto__, constructor, toString)", () => {
    const raw = (s: string) => Buffer.from(s).toString("base64url");
    const payload = '{"__proto__":{"x":1},"constructor":"c","toString":"t","hasOwnProperty":1,"sub":"u"}';
    wrap(<TokenDecoder defaultToken={`${b64({ alg: "RS256", constructor: "h", toString: "h" })}.${raw(payload)}.c2ln`} />);
    expect(within(screen.getByLabelText("Payload")).getByText(/"constructor": "c"/)).toBeInTheDocument();
    expect(screen.getByTestId("claim-sub")).toBeInTheDocument();
    for (const name of ["constructor", "toString", "hasOwnProperty", "__proto__"]) expect(screen.queryByTestId(`claim-${name}`)).not.toBeInTheDocument();
  });

  it("warns about alg none and never offers it as valid", () => {
    wrap(<TokenDecoder defaultToken={`${b64({ alg: "none" })}.${b64({ sub: "x" })}.`} />);
    expect(screen.getByText(/alg is "none"/i)).toBeInTheDocument();
  });

  it("verifies a real RS256 token against the lab JWKS (RS256 pinned, issuer and audience checked)", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
    const jwk = { ...(await exportJWK(publicKey)), kid: "kid-1", alg: "RS256", use: "sig" };
    const sign = (aud: string) =>
      new SignJWT({ email: "alice@example.com" })
        .setProtectedHeader({ alg: "RS256", kid: "kid-1" })
        .setIssuer("http://localhost:4102")
        .setAudience(aud)
        .setSubject("user-1")
        .setExpirationTime("5m")
        .sign(privateKey);
    const { calls } = fakeFetch(() => json(200, { keys: [jwk] }));

    wrap(<TokenDecoder defaultToken={await sign("lab02-api")} />);
    await userEvent.click(screen.getByRole("button", { name: /verify with lab jwks/i }));
    expect(await screen.findByText(/signature valid/i)).toBeInTheDocument();
    expect(calls[0].url).toBe("http://localhost:4102/.well-known/jwks.json");

    fireEvent.change(screen.getByLabelText("JWT"), { target: { value: await sign("some-other-api") } });
    await userEvent.click(screen.getByRole("button", { name: /verify with lab jwks/i }));
    expect(await screen.findByText(/verification failed.*aud/i)).toBeInTheDocument();
  });

  it("shows the offline card with the start command when the lab is down", async () => {
    fakeFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    wrap(<TokenDecoder defaultToken={token(nowSec + 300)} />);
    await userEvent.click(screen.getByRole("button", { name: /verify with lab jwks/i }));
    expect(await screen.findByText("Lab 02 (Go) is not running")).toBeInTheDocument();
    expect(screen.getByText("pnpm lab 02 --go")).toBeInTheDocument();
  });
});

describe("StorageSim", () => {
  const runScript = () => userEvent.click(screen.getByRole("button", { name: /run xss script/i }));
  const row = (name: RegExp) => screen.getByRole("row", { name });

  it("shows which stores leak and marks the HttpOnly cookie not readable", async () => {
    fakeFetch(() => json(404, {}));
    wrap(<StorageSim />);
    await runScript();
    expect(within(row(/localStorage/)).getByText("leaked")).toBeInTheDocument();
    expect(within(row(/sessionStorage/)).getByText("leaked")).toBeInTheDocument();
    expect(within(row(/global variable/i)).getByText("leaked")).toBeInTheDocument();
    expect(within(row(/closure/i)).getByText("not readable")).toBeInTheDocument();
    expect(within(row(/HttpOnly cookie/)).getByText("not readable")).toBeInTheDocument();
  });

  it("is honest that the script can still use the session, and sends the attack event once", async () => {
    const { posts } = fakeFetch(() => json(404, {}));
    wrap(<StorageSim />);
    expect(screen.queryByText(/can still use/i)).not.toBeInTheDocument();
    await runScript();
    await waitFor(() => expect(posts).toEqual([{ kind: "attack", ref: "m2-l4/xss-storage" }]));
    await runScript();
    await userEvent.click(screen.getByRole("button", { name: /call the api from the page/i }));
    expect(screen.getByText(/can still use/i)).toBeInTheDocument();
    expect(posts).toHaveLength(1);
  });
});

describe("JwtAttackLab", () => {
  const labFor = (opts: { secureStatus?: number; vulnerableStatus?: number; offline?: boolean } = {}) => (url: string, init: RequestInit) => {
    if (opts.offline) throw new TypeError("Failed to fetch");
    const headers = (init.headers ?? {}) as Record<string, string>;
    if (url.endsWith("/__attack/sign")) return json(200, { token: `forged.${(JSON.parse(init.body as string) as { mode: string }).mode}.sig` });
    if (url.endsWith("/api/profile")) {
      return headers["X-Lab-Mode"] === "vulnerable" ? json(opts.vulnerableStatus ?? 200, { sub: "forged-user" }) : json(opts.secureStatus ?? 401, { error: "invalid token" });
    }
    return json(404, {});
  };
  const run = (id: string) => userEvent.click(screen.getByRole("button", { name: new RegExp(`run ${id}`, "i") }));

  it("sends exactly 3 attack events, one per card, after observing secure 401 and vulnerable 200", async () => {
    const { posts, calls } = fakeFetch(labFor());
    wrap(<JwtAttackLab />);
    await run("alg-none");
    await waitFor(() => expect(posts).toHaveLength(1));
    await run("key-confusion");
    await run("expired");
    await waitFor(() => expect(posts).toHaveLength(3));
    await new Promise((r) => setTimeout(r, 30));
    expect(posts.map((p) => (p as { ref: string }).ref).sort()).toEqual(["m2-l5/alg-none", "m2-l5/expired", "m2-l5/key-confusion"]);
    expect(posts.every((p) => p.kind === "attack")).toBe(true);

    await run("alg-none"); // running again does not send a second event
    await new Promise((r) => setTimeout(r, 30));
    expect(posts).toHaveLength(3);

    // sign requests are vulnerable-only and carry the mode; every profile call carries the forged Bearer token
    const signs = calls.filter((c) => c.url.endsWith("/__attack/sign"));
    expect(signs.slice(0, 3).map((c) => JSON.parse(c.init.body as string).mode)).toEqual(["none", "hs256-with-public-key", "expired"]);
    expect(signs.every((c) => (c.init.headers as Record<string, string>)["X-Lab-Mode"] === "vulnerable")).toBe(true);
    const profiles = calls.filter((c) => c.url.endsWith("/api/profile"));
    expect(profiles.slice(0, 2).map((c) => (c.init.headers as Record<string, string>)["X-Lab-Mode"])).toEqual([undefined, "vulnerable"]);
    expect((profiles[0].init.headers as Record<string, string>).Authorization).toBe("Bearer forged.none.sig");
    expect(calls.every((c) => c.url.startsWith("http://localhost:4102/") && c.init.credentials === "include")).toBe(true);
  });

  it("sends nothing when the secure verifier accepts the forged token (that is not the lesson)", async () => {
    const { posts } = fakeFetch(labFor({ secureStatus: 200 }));
    wrap(<JwtAttackLab />);
    await run("alg-none");
    expect(await screen.findAllByText("200")).toHaveLength(2);
    await new Promise((r) => setTimeout(r, 30));
    expect(posts).toEqual([]);
  });

  it("degrades to the offline card when the lab is not running", async () => {
    const { posts } = fakeFetch(labFor({ offline: true }));
    wrap(<JwtAttackLab />);
    await run("expired");
    expect(await screen.findByText("Lab 02 (Go) is not running")).toBeInTheDocument();
    expect(screen.getByText("pnpm lab 02 --go")).toBeInTheDocument();
    expect(posts).toEqual([]);
  });
});
