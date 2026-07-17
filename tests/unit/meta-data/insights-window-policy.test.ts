import { describe, expect, it } from "vitest";
import {
  buildIncrementalInsightWindows,
  buildInitialInsightWindows,
  type DateWindow,
} from "@/core/meta-data/sync-policy";

describe("DateWindow", () => {
  it("has since and until string fields", () => {
    const w: DateWindow = { since: "2025-01-01", until: "2025-01-01" };
    expect(w.since).toBe("2025-01-01");
    expect(w.until).toBe("2025-01-01");
  });
});

describe("buildInitialInsightWindows", () => {
  it("returns 90 single-day windows ending yesterday by default", () => {
    const windows = buildInitialInsightWindows("2025-07-17");

    expect(windows).toHaveLength(90);
    // oldest first
    expect(windows[0]!.since).toBe("2025-04-18");
    expect(windows[0]!.until).toBe("2025-04-18");
    // newest last — yesterday
    expect(windows[89]!.since).toBe("2025-07-16");
    expect(windows[89]!.until).toBe("2025-07-16");
  });

  it("each window spans exactly one day", () => {
    const windows = buildInitialInsightWindows("2025-07-17");

    for (const w of windows) {
      expect(w.until).toBe(w.since);
    }
  });

  it("excludes current incomplete day", () => {
    const windows = buildInitialInsightWindows("2025-07-17");

    const allSinceDates = windows.map((w) => w.since);
    expect(allSinceDates).not.toContain("2025-07-17");
  });

  it("accepts custom days count", () => {
    const windows = buildInitialInsightWindows("2025-07-17", 5);

    expect(windows).toHaveLength(5);
    expect(windows[0]!.since).toBe("2025-07-12");
    expect(windows[0]!.until).toBe("2025-07-12");
    expect(windows[4]!.since).toBe("2025-07-16");
    expect(windows[4]!.until).toBe("2025-07-16");
  });

  it("windows are contiguous with no gaps", () => {
    const windows = buildInitialInsightWindows("2025-07-17", 10);

    for (let i = 1; i < windows.length; i++) {
      const previous = new Date(windows[i - 1]!.until + "T00:00:00Z");
      previous.setUTCDate(previous.getUTCDate() + 1);
      expect(windows[i]!.since).toBe(previous.toISOString().slice(0, 10));
    }
  });

  it("all dates are UTC ISO format YYYY-MM-DD", () => {
    const windows = buildInitialInsightWindows("2025-07-17", 5);
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    for (const w of windows) {
      expect(w.since).toMatch(datePattern);
      expect(w.until).toMatch(datePattern);
    }
  });
});

describe("buildIncrementalInsightWindows", () => {
  it("returns 7 recent complete days by default", () => {
    const windows = buildIncrementalInsightWindows("2025-07-17");

    expect(windows).toHaveLength(7);
    expect(windows[0]!.since).toBe("2025-07-10");
    expect(windows[0]!.until).toBe("2025-07-10");
    expect(windows[6]!.since).toBe("2025-07-16");
    expect(windows[6]!.until).toBe("2025-07-16");
  });

  it("excludes current incomplete day", () => {
    const windows = buildIncrementalInsightWindows("2025-07-17");

    const allSinceDates = windows.map((w) => w.since);
    const allUntilDates = windows.map((w) => w.until);
    expect(allSinceDates).not.toContain("2025-07-17");
    expect(allUntilDates).not.toContain("2025-07-17");
  });

  it("accepts custom lookbackDays", () => {
    const windows = buildIncrementalInsightWindows("2025-07-17", 3);

    expect(windows).toHaveLength(3);
    expect(windows[0]!.since).toBe("2025-07-14");
    expect(windows[2]!.since).toBe("2025-07-16");
  });

  it("windows are contiguous with no gaps", () => {
    const windows = buildIncrementalInsightWindows("2025-07-17", 5);

    for (let i = 1; i < windows.length; i++) {
      const previous = new Date(windows[i - 1]!.until + "T00:00:00Z");
      previous.setUTCDate(previous.getUTCDate() + 1);
      expect(windows[i]!.since).toBe(previous.toISOString().slice(0, 10));
    }
  });

  it("all dates are UTC ISO format YYYY-MM-DD", () => {
    const windows = buildIncrementalInsightWindows("2025-07-17", 3);
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    for (const w of windows) {
      expect(w.since).toMatch(datePattern);
      expect(w.until).toMatch(datePattern);
    }
  });
});
