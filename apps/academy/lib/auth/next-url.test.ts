import { describe, expect, it } from "vitest";
import { safeNext } from "./next-url";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/m/a/b?x=1")).toBe("/m/a/b?x=1");
    expect(safeNext(["/", "/x"])).toBe("/");
  });
  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "evil", "", undefined])("rejects %s", (v) => {
    expect(safeNext(v)).toBeUndefined();
  });
});
