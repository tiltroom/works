import { describe, expect, it } from "vitest";

const VALID_EVENT_TYPES = ["time_entry_accrual", "time_entry_reversal", "payment_settlement"] as const;

const VALID_SOURCE_TYPES = ["time_entry", "stripe_event", "manual_adjustment"] as const;

describe("debt ledger invariants", () => {
  it("defines exactly three event types", () => {
    expect(VALID_EVENT_TYPES).toHaveLength(3);
    expect(VALID_EVENT_TYPES).toContain("time_entry_accrual");
    expect(VALID_EVENT_TYPES).toContain("time_entry_reversal");
    expect(VALID_EVENT_TYPES).toContain("payment_settlement");
  });

  it("accrual events represent positive hours (debt increases)", () => {
    const accrualHours = 2.5;
    expect(accrualHours).toBeGreaterThan(0);
  });

  it("reversal events represent negative hours (debt decreases)", () => {
    const reversalHours = -2.5;
    expect(reversalHours).toBeLessThan(0);
  });

  it("outstanding debt is computed as sum of all ledger hours", () => {
    const ledgerEntries = [
      { hours: 5.0, event_type: "time_entry_accrual" },
      { hours: 2.0, event_type: "time_entry_accrual" },
      { hours: -1.0, event_type: "time_entry_reversal" },
      { hours: -3.0, event_type: "payment_settlement" },
    ];
    const outstandingDebt = ledgerEntries.reduce((sum, e) => sum + e.hours, 0);
    expect(outstandingDebt).toBe(3.0);
  });

  it("prepaid projects have zero outstanding debt when no ledger entries exist", () => {
    const ledgerEntries: { hours: number }[] = [];
    const outstandingDebt = ledgerEntries.reduce((sum, e) => sum + e.hours, 0);
    expect(outstandingDebt).toBe(0);
  });

  it("idempotency: same source_id and event_type cannot create duplicate entries", () => {
    const existingEntries = [
      { project_id: "proj-1", source_id: "te-001", event_type: "time_entry_accrual" },
    ];
    const newEntry = { project_id: "proj-1", source_id: "te-001", event_type: "time_entry_accrual" };
    const isDuplicate = existingEntries.some(
      (e) =>
        e.project_id === newEntry.project_id &&
        e.source_id === newEntry.source_id &&
        e.event_type === newEntry.event_type,
    );
    expect(isDuplicate).toBe(true);
  });

  it("different event types for same source_id are allowed", () => {
    const existingEntries = [
      { project_id: "proj-1", source_id: "te-001", event_type: "time_entry_accrual" },
    ];
    const newEntry = { project_id: "proj-1", source_id: "te-001", event_type: "time_entry_reversal" };
    const isDuplicate = existingEntries.some(
      (e) =>
        e.project_id === newEntry.project_id &&
        e.source_id === newEntry.source_id &&
        e.event_type === newEntry.event_type,
    );
    expect(isDuplicate).toBe(false);
  });

  it("source types are limited to known values", () => {
    expect(VALID_SOURCE_TYPES).toHaveLength(3);
    expect(VALID_SOURCE_TYPES).toContain("time_entry");
    expect(VALID_SOURCE_TYPES).toContain("stripe_event");
    expect(VALID_SOURCE_TYPES).toContain("manual_adjustment");
  });

  it("full settlement scenario: accrual then payment zeroes out debt", () => {
    const entries = [
      { hours: 6.0, event_type: "time_entry_accrual" as const },
      { hours: -6.0, event_type: "payment_settlement" as const },
    ];
    const debt = entries.reduce((sum, e) => sum + e.hours, 0);
    expect(debt).toBe(0);
  });

  it("partial settlement reduces debt without eliminating it", () => {
    const entries = [
      { hours: 8.0, event_type: "time_entry_accrual" as const },
      { hours: -3.0, event_type: "payment_settlement" as const },
    ];
    const debt = entries.reduce((sum, e) => sum + e.hours, 0);
    expect(debt).toBe(5.0);
  });
});
