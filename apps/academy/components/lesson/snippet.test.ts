import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSpec, readSnippet } from "./snippet";

const root = path.join(__dirname, "__fixtures__");

describe("parseSpec", () => {
  it("splits an #L range", () => {
    expect(parseSpec("a/b.go#L10-L42")).toEqual({ file: "a/b.go", range: [10, 42] });
    expect(parseSpec("a/b.go#L7")).toEqual({ file: "a/b.go", range: [7, 7] });
    expect(parseSpec("a/b.go")).toEqual({ file: "a/b.go", range: undefined });
  });
});

describe("readSnippet", () => {
  it("returns the whole file without a range", async () => {
    const r = await readSnippet("sample.go", root);
    expect(r).toMatchObject({ ok: true, startLine: 1, lang: "go" });
    expect(r.ok && r.code.split("\n")).toHaveLength(5);
  });

  it("slices 1-based inclusive lines and reports the first line number", async () => {
    expect(await readSnippet("sample.go#L2-L3", root)).toMatchObject({ ok: true, code: "line two\nline three", startLine: 2 });
  });

  it("clamps a range past the end of the file", async () => {
    expect(await readSnippet("sample.go#L4-L99", root)).toMatchObject({ ok: true, code: "line four\nline five", startLine: 4 });
  });

  it("returns ok:false for a missing file instead of throwing", async () => {
    expect(await readSnippet("labs/01-sessions/go/main.go#L1-L5", root)).toEqual({ ok: false, path: "labs/01-sessions/go/main.go" });
  });

  it("refuses paths that escape the root", async () => {
    expect(await readSnippet("../../package.json", root)).toMatchObject({ ok: false });
  });
});
