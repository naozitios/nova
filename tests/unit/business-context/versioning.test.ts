import { describe, expect, it } from "vitest";
import {
  computeFieldDiffs,
  type FieldDiffMap,
} from "@/core/business-context/versioning";

describe("computeFieldDiffs", () => {
  it("returns empty diff when profiles are identical", () => {
    const d: FieldDiffMap = computeFieldDiffs({ a: 1 }, { a: 1 });
    expect(d).toEqual({});
  });

  it("returns changed entries for differing values", () => {
    const d = computeFieldDiffs({ a: 1, b: 2 }, { a: 1, b: 3 });
    expect(d.b).toBeDefined();
    expect(d.b.before).toBe(2);
    expect(d.b.after).toBe(3);
  });

  it("returns added entries for keys only in draft", () => {
    const d = computeFieldDiffs({ a: 1 }, { a: 1, c: 4 });
    expect(d.c).toBeDefined();
    expect(d.c.before).toBeNull();
    expect(d.c.after).toBe(4);
  });

  it("returns removed entries for keys only in current", () => {
    const d = computeFieldDiffs({ a: 1, b: 2 }, { a: 1 });
    expect(d.b).toBeDefined();
    expect(d.b.before).toBe(2);
    expect(d.b.after).toBeNull();
  });
});
