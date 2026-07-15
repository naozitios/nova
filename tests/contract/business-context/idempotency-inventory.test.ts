import { describe, expect, it } from "vitest";
import {
  ALL_MUTATIONS,
  readFileSource,
  usesWithIdempotency,
} from "./_idempotency-helpers";

// ---------------------------------------------------------------------------
// T007 — Idempotency Inventory Test: Route Inventory
// Proves every client mutation route is inventoried and wraps its handler
// in withIdempotency().
// ---------------------------------------------------------------------------

describe("Idempotency Inventory — route inventory and withIdempotency checks", () => {
  describe("route inventory completeness", () => {
    it("has inventoried every mutating business-context route", () => {
      const expectedRouteFiles = ALL_MUTATIONS.map((r) => r.file);
      const routeFiles = new Set(expectedRouteFiles);

      expect(routeFiles.size).toBe(expectedRouteFiles.length);
    });

    it.each(ALL_MUTATIONS.map((r) => [`${r.method} ${r.path}`, r] as const))(
      "%s is inventoried",
      (_label, route) => {
        expect(route.file).toBeTruthy();
        expect(route.description).toBeTruthy();
      },
    );
  });

  describe("every mutation wraps handler in withIdempotency", () => {
    it.each(
      ALL_MUTATIONS.map((r) => [`${r.method} ${r.path}`, r] as const)
    )("%s — source uses withIdempotency", (_label, route) => {
      const source = readFileSource(route.file);
      expect(
        usesWithIdempotency(source, route.method),
      ).toBe(true);
    });
  });
});
