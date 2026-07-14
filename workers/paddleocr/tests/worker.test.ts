import { describe, it, expect } from "vitest";
import { processOcrJob } from "../worker";

describe("PaddleOCR worker", () => {
  it("should export processOcrJob", () => {
    expect(typeof processOcrJob).toBe("function");
  });
});
