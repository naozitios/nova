import { describe, expect, it } from "vitest";
import { hasSelectedMetaAccount } from "@/core/business-context/meta-readiness";

describe("hasSelectedMetaAccount", () => {
  it("returns true when account is selected and matches business", () => {
    const result = hasSelectedMetaAccount({
      businessId: "biz-1",
      accounts: [
        { businessId: "biz-1", isSelected: true },
      ],
    });
    expect(result).toBe(true);
  });

  it("returns false when connection exists but account is not selected", () => {
    const result = hasSelectedMetaAccount({
      businessId: "biz-1",
      accounts: [
        { businessId: "biz-1", isSelected: false },
      ],
    });
    expect(result).toBe(false);
  });

  it("returns false when selected account belongs to different business", () => {
    const result = hasSelectedMetaAccount({
      businessId: "biz-1",
      accounts: [
        { businessId: "biz-2", isSelected: true },
      ],
    });
    expect(result).toBe(false);
  });

  it("returns false for empty accounts", () => {
    const result = hasSelectedMetaAccount({
      businessId: "biz-1",
      accounts: [],
    });
    expect(result).toBe(false);
  });
});
