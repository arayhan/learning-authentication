"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 250;
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const randomSalt = () => hex(crypto.getRandomValues(new Uint8Array(8)).buffer);

type Hashes = { sha: string; pbkdf2: string; ms: number };

/** SHA-256(salt || password) and PBKDF2-HMAC-SHA256 (32 bytes) with Web Crypto. `ms` times the PBKDF2 call only. */
async function hashBoth(password: string, salt: string, iterations: number): Promise<Hashes> {
  const sha = hex(await crypto.subtle.digest("SHA-256", enc.encode(salt + password)));
  const t0 = performance.now();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations }, key, 256);
  return { sha, pbkdf2: hex(bits), ms: performance.now() - t0 };
}

type Input = { password: string; saltA: string; saltB: string; iterations: number };

/**
 * Same password, two salts, two algorithms. Inputs are debounced so dragging the slider or typing never queues a pile
 * of 600k-iteration derivations; Web Crypto runs them off the main thread, so typing stays responsive meanwhile.
 */
export function HashPlayground() {
  const uid = useId();
  const [form, setForm] = useState<Input>({ password: "correct horse", saltA: "3fa91c2e", saltB: "b7d04e65", iterations: 100_000 });
  const [settled, setSettled] = useState(form);
  const [result, setResult] = useState<{ for: Input; a: Hashes; b: Hashes } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSettled(form), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [form]);

  useEffect(() => {
    let live = true;
    Promise.all([hashBoth(settled.password, settled.saltA, settled.iterations), hashBoth(settled.password, settled.saltB, settled.iterations)])
      .then(([a, b]) => live && setResult({ for: settled, a, b }))
      .catch(() => {}); // Web Crypto unavailable (insecure context): leave "hashing…"
    return () => {
      live = false;
    };
  }, [settled]);

  const set = (patch: Partial<Input>) => setForm((f) => ({ ...f, ...patch }));
  const ready = result !== null && result.for === settled && settled === form;

  const cell = (label: string, value: string | undefined) => (
    <output aria-label={label} className="block break-all font-mono text-xs">
      {ready && value ? value : <span className="text-muted-foreground">hashing…</span>}
    </output>
  );

  return (
    <div className="max-w-3xl space-y-4 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Hash playground</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs font-medium">
          Password
          <Input value={form.password} onChange={(e) => set({ password: e.target.value })} spellCheck={false} autoComplete="off" />
        </label>
        {(["saltA", "saltB"] as const).map((k) => (
          <div key={k} className="space-y-1">
            <label htmlFor={`${uid}-${k}`} className="text-xs font-medium">
              {k === "saltA" ? "Salt A" : "Salt B"}
            </label>
            <div className="flex gap-1.5">
              <Input id={`${uid}-${k}`} value={form[k]} onChange={(e) => set({ [k]: e.target.value })} spellCheck={false} autoComplete="off" className="font-mono" />
              <Button type="button" variant="outline" size="sm" onClick={() => set({ [k]: randomSalt() })} aria-label={`New random ${k === "saltA" ? "salt A" : "salt B"}`}>
                New
              </Button>
            </div>
          </div>
        ))}
      </div>

      <label className="block space-y-1 text-xs font-medium">
        <span>
          Iterations: <span className="font-mono tabular-nums">{form.iterations.toLocaleString("en-US")}</span>
        </span>
        <input
          type="range"
          min={1000}
          max={600_000}
          step={1000}
          value={form.iterations}
          onChange={(e) => set({ iterations: Number(e.target.value) })}
          className="block w-full accent-[var(--brand)]"
        />
      </label>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium"><span className="sr-only">Algorithm</span></th>
              <th className="px-3 py-2 font-medium">Salt A</th>
              <th className="px-3 py-2 font-medium">Salt B</th>
            </tr>
          </thead>
          <tbody className="[&_td]:border-t [&_td]:px-3 [&_td]:py-2 [&_td]:align-top">
            <tr>
              <th scope="row" className="px-3 py-2 text-xs font-medium">SHA-256 <span className="block font-normal text-muted-foreground">instant: built to be fast</span></th>
              <td>{cell("SHA-256 with salt A", result?.a.sha)}</td>
              <td>{cell("SHA-256 with salt B", result?.b.sha)}</td>
            </tr>
            <tr>
              <th scope="row" className="px-3 py-2 text-xs font-medium">PBKDF2-SHA256 <span className="block font-normal text-muted-foreground">{form.iterations.toLocaleString("en-US")} iterations</span></th>
              <td>
                {cell("PBKDF2 with salt A", result?.a.pbkdf2)}
                {ready && result && <span className="mt-1 block text-xs tabular-nums text-muted-foreground">{Math.max(1, Math.round(result.a.ms))} ms</span>}
              </td>
              <td>
                {cell("PBKDF2 with salt B", result?.b.pbkdf2)}
                {ready && result && <span className="mt-1 block text-xs tabular-nums text-muted-foreground">{Math.max(1, Math.round(result.b.ms))} ms</span>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Same password, different salt, completely different hash. Drag the slider: SHA-256 stays instant, PBKDF2 gets slower on purpose. OWASP asks for at least 600,000 iterations of PBKDF2-HMAC-SHA256.
        The lab itself uses <strong>argon2id</strong>, which is memory-hard; the browser demo does not run it.
      </p>
    </div>
  );
}
