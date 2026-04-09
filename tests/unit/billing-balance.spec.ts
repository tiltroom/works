import { describe, expect, it } from "vitest";
import {
  formatBillingMode,
  formatHours,
  isPostPaid,
  parseProjectBillingBalance,
} from "@/lib/billing-balance";

describe("billing-balance helpers", () => {
  it("identifies post-paid billing mode", () => {
    expect(isPostPaid("postpaid")).toBe(true);
    expect(isPostPaid("prepaid")).toBe(false);
  });

  it("formats billing mode labels", () => {
    expect(formatBillingMode("postpaid")).toBe("Post-paid");
    expect(formatBillingMode("prepaid")).toBe("Prepaid");
  });

  it("formats hours for display", () => {
    expect(formatHours(2.5)).toBe("2.50h");
    expect(formatHours(0)).toBe("0.00h");
    expect(formatHours(null)).toBe("\u2014");
    expect(formatHours(undefined)).toBe("\u2014");
    expect(formatHours(NaN)).toBe("\u2014");
  });

  it("parses raw billing balance rows", () => {
    const balance = parseProjectBillingBalance({
      project_id: "proj-001",
      billing_mode: "postpaid",
      prepaid_hours: 0,
      used_hours: 6.5,
      remaining_prepaid_hours: 0,
      outstanding_debt_hours: 6.5,
    });
    expect(balance).toEqual({
      project_id: "proj-001",
      billing_mode: "postpaid",
      prepaid_hours: 0,
      used_hours: 6.5,
      remaining_prepaid_hours: 0,
      outstanding_debt_hours: 6.5,
    });
  });

  it("defaults to prepaid for unknown billing_mode", () => {
    const balance = parseProjectBillingBalance({
      project_id: "proj-002",
      billing_mode: "unknown",
      prepaid_hours: 10,
    });
    expect(balance.billing_mode).toBe("prepaid");
  });

  it("parses string numbers from database rows", () => {
    const balance = parseProjectBillingBalance({
      project_id: "proj-003",
      billing_mode: "prepaid",
      prepaid_hours: "10.00",
      used_hours: "3.50",
      remaining_prepaid_hours: "6.50",
      outstanding_debt_hours: "0",
    });
    expect(balance.prepaid_hours).toBe(10);
    expect(balance.used_hours).toBe(3.5);
    expect(balance.remaining_prepaid_hours).toBe(6.5);
    expect(balance.outstanding_debt_hours).toBe(0);
  });
});
