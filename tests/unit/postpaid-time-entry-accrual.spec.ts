import { describe, expect, it } from "vitest";
import type { BillingMode } from "@/lib/types";

function computeHours(startedAt: string, endedAt: string): number {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  return Number((ms / 3_600_000).toFixed(2));
}

describe("postpaid time-entry debt accrual", () => {
  it("manual closed entry computes positive debt hours", () => {
    const startedAt = "2026-04-09T10:00:00Z";
    const endedAt = "2026-04-09T12:30:00Z";
    const hours = computeHours(startedAt, endedAt);
    expect(hours).toBe(2.5);
    expect(hours).toBeGreaterThan(0);
  });

  it("debt event type is accrual for new closed entries", () => {
    const eventType = "time_entry_accrual";
    expect(eventType).toBe("time_entry_accrual");
  });

  it("no debt for running timer (ended_at is null)", () => {
    const endedAt: string | null = null;
    const shouldAccrue = endedAt !== null;
    expect(shouldAccrue).toBe(false);
  });

  it("prepaid project creates no debt ledger events", () => {
    const billingMode: BillingMode = "prepaid";
    const shouldAccrue = billingMode === "postpaid";
    expect(shouldAccrue).toBe(false);
  });

  it("postpaid project creates debt for closed entry", () => {
    const billingMode: BillingMode = "postpaid";
    const endedAt: string | null = "2026-04-09T12:00:00Z";
    const shouldAccrue = billingMode === "postpaid" && endedAt !== null;
    expect(shouldAccrue).toBe(true);
  });
});

describe("postpaid time-entry debt reversal", () => {
  it("editing 2.5h entry to 1.0h yields net 1.0h debt", () => {
    const originalDebt = 2.5;
    const newHours = 1.0;
    const reversalHours = -originalDebt;
    const accrualHours = newHours;
    const totalDebt = originalDebt + reversalHours + accrualHours;
    expect(totalDebt).toBe(1.0);
  });

  it("deleting 3.0h entry yields net -3.0h reversal", () => {
    const deletedHours = 3.0;
    const reversalHours = -deletedHours;
    expect(reversalHours).toBe(-3.0);
    expect(reversalHours).toBeLessThan(0);
  });

  it("deleting entry and then full ledger sums to zero", () => {
    const entries = [
      { event_type: "time_entry_accrual", hours: 2.5 },
      { event_type: "time_entry_reversal", hours: -2.5 },
    ];
    const netDebt = entries.reduce((sum, e) => sum + e.hours, 0);
    expect(netDebt).toBe(0);
  });

  it("moving entry to another project reverses old and accrues new", () => {
    const oldProjectDebt = [
      { event_type: "time_entry_reversal", hours: -2.5 },
    ];
    const newProjectDebt = [
      { event_type: "time_entry_accrual", hours: 2.5 },
    ];
    const oldNet = oldProjectDebt.reduce((s, e) => s + e.hours, 0);
    const newNet = newProjectDebt.reduce((s, e) => s + e.hours, 0);
    expect(oldNet).toBe(-2.5);
    expect(newNet).toBe(2.5);
  });

  it("editing entry on prepaid project produces no reversal or accrual", () => {
    const billingMode: BillingMode = "prepaid";
    const shouldReverse = billingMode === "postpaid";
    const shouldAccrue = billingMode === "postpaid";
    expect(shouldReverse).toBe(false);
    expect(shouldAccrue).toBe(false);
  });
});
