import { traceMiddleware, type Hub } from "@academy/trace";
import { readFile } from "node:fs/promises";
import { Hono, type Context } from "hono";
import { scopeInfo } from "./clients.ts";
import { jsonNotFound, limitBody } from "./http.ts";

// The AS pages are server-rendered; every dynamic value goes through esc(), never straight into the markup.
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

const STYLE = `
  :root { --bg:#fafafa; --card:#fff; --fg:#18181b; --muted:#71717a; --line:#e4e4e7; --accent:#4f46e5; --accent-fg:#fff; --bad:#b91c1c; }
  @media (prefers-color-scheme: dark) { :root { --bg:#09090b; --card:#18181b; --fg:#fafafa; --muted:#a1a1aa; --line:#27272a; --accent:#818cf8; --accent-fg:#09090b; --bad:#f87171; } }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:16px; background:var(--bg); color:var(--fg); font:15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { width:100%; max-width:380px; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:24px; }
  h1 { margin:0 0 4px; font-size:18px; }
  p.sub { margin:0 0 20px; color:var(--muted); font-size:13px; }
  label { display:block; margin:0 0 12px; font-size:13px; color:var(--muted); }
  input[type=email], input[type=password] { display:block; width:100%; margin-top:4px; padding:8px 10px; font:inherit; color:var(--fg); background:var(--bg); border:1px solid var(--line); border-radius:8px; }
  input:focus-visible, button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  ul { margin:0 0 16px; padding:0; list-style:none; border:1px solid var(--line); border-radius:8px; }
  li { padding:8px 12px; font-size:14px; } li + li { border-top:1px solid var(--line); }
  li code { font:12px ui-monospace, "JetBrains Mono", Consolas, monospace; color:var(--muted); display:block; }
  .row { display:flex; gap:8px; margin-top:16px; }
  button { flex:1; padding:8px 12px; font:inherit; font-weight:500; cursor:pointer; color:var(--fg); background:transparent; border:1px solid var(--line); border-radius:8px; }
  button.primary { color:var(--accent-fg); background:var(--accent); border-color:var(--accent); }
  .err { margin:0 0 12px; color:var(--bad); font-size:13px; }
`;

const shell = (title: string, inner: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${STYLE}</style></head><body><main>${inner}</main></body></html>`;

export const loginPage = (client: string, rid: string, error = "") =>
  shell("Authorization server", `
<h1>Sign in</h1><p class="sub">to continue to <strong>${esc(client)}</strong></p>
${error ? `<p class="err" role="alert">${esc(error)}</p>` : ""}
<form action="/login" method="post">
<input type="hidden" name="rid" value="${esc(rid)}">
<label>Email<input type="email" name="email" autocomplete="username" required></label>
<label>Password<input type="password" name="password" autocomplete="current-password" required></label>
<div class="row"><button class="primary" type="submit">Sign in</button></div>
</form>`);

export const consentPage = (client: string, rid: string, csrf: string, scopes: string[]) =>
  shell("Authorization server", `
<h1>Authorize access</h1><p class="sub"><strong>${esc(client)}</strong> wants to access your account.</p>
<ul>${scopes.map((s) => `<li>${esc(scopeInfo[s] ?? s)}<code>${esc(s)}</code></li>`).join("")}</ul>
<form action="/consent" method="post">
<input type="hidden" name="rid" value="${esc(rid)}">
<input type="hidden" name="csrf" value="${esc(csrf)}">
<div class="row"><button type="submit" name="decision" value="deny">Deny</button><button class="primary" type="submit" name="decision" value="approve">Approve</button></div>
</form>`);

/** What /authorize shows when the client or redirect_uri cannot be trusted: nothing is echoed from the request, and the browser is never redirected. */
export const errorPage = (title: string, message: string) => shell(title, `<h1>${esc(title)}</h1><p class="sub">${esc(message)}</p>`);

/** Rendered pages are never cached and never framed (clickjacking on the consent button). */
export function htmlResponse(c: Context, status: 200 | 400 | 401 | 403, html: string) {
  return c.body(html, status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
  });
}

const SPA_URL = new URL("../../client-spa/index.html", import.meta.url);

/** The client listener: serves the shared SPA (read on every request, so editing index.html needs no restart). */
export function createClientApp(hub: Hub) {
  const app = new Hono();
  app.use("*", limitBody);
  app.use("*", traceMiddleware(hub, { lab: "03", impl: "ts", role: "client" }));
  jsonNotFound(app);
  const spa = async (c: Context) => {
    try {
      return c.body(await readFile(process.env.SPA_PATH ?? SPA_URL), 200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    } catch {
      return c.json({ error: "client page missing" }, 500);
    }
  };
  app.get("/", spa);
  app.get("/callback", spa);
  return app;
}
