"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TraceEvent } from "@/lib/course/types";

export type Cookie = {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: string;
  path?: string;
  maxAge?: string;
  expires?: string;
};

export function parseSetCookie(raw: string): Cookie {
  const [pair = "", ...attrs] = raw.split(";").map((s) => s.trim());
  const eq = pair.indexOf("=");
  const c: Cookie = { name: eq < 0 ? pair : pair.slice(0, eq), value: eq < 0 ? "" : pair.slice(eq + 1), httpOnly: false, secure: false };
  for (const a of attrs) {
    const i = a.indexOf("=");
    const k = (i < 0 ? a : a.slice(0, i)).toLowerCase();
    const v = i < 0 ? "" : a.slice(i + 1);
    if (k === "httponly") c.httpOnly = true;
    else if (k === "secure") c.secure = true;
    else if (k === "samesite") c.sameSite = v;
    else if (k === "path") c.path = v;
    else if (k === "max-age") c.maxAge = v;
    else if (k === "expires") c.expires = v;
  }
  return c;
}

export const setCookies = (e: TraceEvent): string[] => {
  const v = Object.entries(e.res.headers).find(([k]) => k.toLowerCase() === "set-cookie")?.[1];
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
};

const url = (e: TraceEvent) => `${e.req.path}${e.req.query ? `?${e.req.query}` : ""}`;
const lines = (h: Record<string, string | string[]>) =>
  Object.entries(h).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map((x) => `${k}: ${x}`));

/** Reconstructed HTTP text of the exchange (headers are lowercased by the tracer). */
export function rawText(e: TraceEvent): string {
  const req = [`${e.req.method} ${url(e)} HTTP/1.1`, ...lines(e.req.headers), "", ...(e.req.body ? [e.req.body] : [])];
  const res = [`HTTP/1.1 ${e.res.status}`, ...lines(e.res.headers), "", ...(e.res.body ? [e.res.body] : [])];
  return `${req.join("\n")}\n\n${res.join("\n")}`;
}

export function pretty(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

const mono = "overflow-x-auto whitespace-pre-wrap break-all rounded-md border bg-muted/30 p-2 font-mono text-xs";

function Headers({ title, headers }: { title: string; headers: Record<string, string | string[]> }) {
  const rows = lines(headers);
  return (
    <section className="space-y-1">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      {rows.length ? <pre className={mono}>{rows.join("\n")}</pre> : <p className="text-xs text-muted-foreground">None</p>}
    </section>
  );
}

function Body({ title, body }: { title: string; body?: string }) {
  return (
    <section className="space-y-1">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      {body ? <pre className={mono}>{pretty(body)}</pre> : <p className="text-xs text-muted-foreground">Empty</p>}
    </section>
  );
}

const flag = (b: boolean) => (b ? "Yes" : "-");

function Cookies({ event }: { event: TraceEvent }) {
  const cookies = setCookies(event).map(parseSetCookie);
  if (!cookies.length) return <p className="text-xs text-muted-foreground">No Set-Cookie headers in this response.</p>;
  const th = "px-2 py-1 font-medium whitespace-nowrap";
  const td = "px-2 py-1 align-top font-mono break-all";
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">Set-Cookie headers</caption>
        <thead className="bg-muted/40">
          <tr>
            {["Name", "Value", "HttpOnly", "Secure", "SameSite", "Path", "Max-Age", "Expires"].map((h) => (
              <th key={h} scope="col" className={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cookies.map((c, i) => (
            <tr key={i} className="border-t">
              <th scope="row" className={`${td} font-semibold`}>{c.name}</th>
              <td className={td}>{c.value}</td>
              <td className={td}>{flag(c.httpOnly)}</td>
              <td className={td}>{flag(c.secure)}</td>
              <td className={td}>{c.sameSite ?? "-"}</td>
              <td className={td}>{c.path ?? "-"}</td>
              <td className={td}>{c.maxAge ?? "-"}</td>
              <td className={td}>{c.expires ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Detail view of one trace event: Headers / Cookies / Body / Raw. Tabs are arrow-key navigable (Base UI). */
export function TraceDetail({ event }: { event: TraceEvent }) {
  return (
    <Tabs defaultValue="headers" className="min-w-0">
      <div className="overflow-x-auto">
        <TabsList variant="line">
          <TabsTrigger value="headers">Headers</TabsTrigger>
          <TabsTrigger value="cookies">Cookies</TabsTrigger>
          <TabsTrigger value="body">Body</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="headers" className="space-y-3">
        <Headers title="Request headers" headers={event.req.headers} />
        <Headers title="Response headers" headers={event.res.headers} />
      </TabsContent>
      <TabsContent value="cookies">
        <Cookies event={event} />
      </TabsContent>
      <TabsContent value="body" className="space-y-3">
        <Body title="Request body" body={event.req.body} />
        <Body title="Response body" body={event.res.body} />
      </TabsContent>
      <TabsContent value="raw">
        <pre className={mono}>{rawText(event)}</pre>
      </TabsContent>
    </Tabs>
  );
}
