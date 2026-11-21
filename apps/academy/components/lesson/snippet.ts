import { readFile } from "node:fs/promises";
import path from "node:path";

/** Repo root, assuming `next` runs from apps/academy. */
const REPO_ROOT = path.resolve(process.cwd(), "../..");

const LANGS: Record<string, string> = { ".go": "go", ".ts": "ts", ".tsx": "tsx", ".js": "js", ".sql": "sql", ".json": "json", ".html": "html", ".sh": "bash" };

export function parseSpec(spec: string): { file: string; range?: [number, number] } {
  const m = /^(.*)#L(\d+)(?:-L(\d+))?$/.exec(spec);
  if (!m) return { file: spec, range: undefined };
  return { file: m[1], range: [Number(m[2]), Number(m[3] ?? m[2])] };
}

export type Snippet = { ok: true; code: string; startLine: number; lang: string } | { ok: false; path: string };

/** Read `labs/…/file.go#L10-L42` (1-based, inclusive) relative to the repo root, confined to `labs/`. A missing or out-of-root file is `{ok:false}`, never a throw. */
export async function readSnippet(spec: string, repoRoot = REPO_ROOT): Promise<Snippet> {
  const { file, range } = parseSpec(spec);
  const abs = path.resolve(repoRoot, file);
  // Only <repo>/labs is readable; absolute paths and ../ escapes (incl. a different Windows drive) are refused.
  const rel = path.relative(path.join(repoRoot, "labs"), abs);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return { ok: false, path: file };
  try {
    // Labs live outside the app on purpose; opt out of Turbopack's whole-project file tracing.
    const lines = (await readFile(/* turbopackIgnore: true */ abs, "utf8")).replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
    const start = range ? Math.max(1, range[0]) : 1;
    const code = range ? lines.slice(start - 1, range[1]).join("\n") : lines.join("\n");
    return { ok: true, code, startLine: start, lang: LANGS[path.extname(file)] ?? "text" };
  } catch {
    return { ok: false, path: file };
  }
}
