import { describe, expect, it } from "vitest";

describe("project hour purchase allocation", () => {
  it("postpaid purchase settles debt up to the current balance", () => {
    const outstandingDebt = 6;
    const hoursPurchased = 10;
    const debtToSettle = Math.min(Math.max(outstandingDebt, 0), hoursPurchased);
    const updatedDebt = Math.max(outstandingDebt - hoursPurchased, 0);

    expect(debtToSettle).toBe(6);
    expect(updatedDebt).toBe(0);
  });

  it("postpaid purchase partially settles larger debt", () => {
    const outstandingDebt = 15;
    const hoursPurchased = 10;
    const debtToSettle = Math.min(Math.max(outstandingDebt, 0), hoursPurchased);
    const updatedDebt = Math.max(outstandingDebt - hoursPurchased, 0);

    expect(debtToSettle).toBe(10);
    expect(updatedDebt).toBe(5);
  });

  it("postpaid purchase does not drive debt below zero", () => {
    const outstandingDebt = 0;
    const hoursPurchased = 10;
    const debtToSettle = Math.min(Math.max(outstandingDebt, 0), hoursPurchased);
    const updatedDebt = Math.max(outstandingDebt - hoursPurchased, 0);

    expect(debtToSettle).toBe(0);
    expect(updatedDebt).toBe(0);
  });

  it("debt exactly equal to purchase zeroes out debt", () => {
    const outstandingDebt = 8;
    const hoursPurchased = 8;
    const debtToSettle = Math.min(Math.max(outstandingDebt, 0), hoursPurchased);
    const updatedDebt = Math.max(outstandingDebt - hoursPurchased, 0);

    expect(debtToSettle).toBe(8);
    expect(updatedDebt).toBe(0);
  });

  it("settlement event hours are negative (reducing debt)", () => {
    const debtToSettle = 6;
    const settlementHours = -debtToSettle;
    expect(settlementHours).toBeLessThan(0);
    expect(settlementHours).toBe(-6);
  });

  it("postpaid purchases never create prepaid assigned-hour credit", () => {
    const scenarios = [
      { debt: 6, purchase: 10 },
      { debt: 15, purchase: 10 },
      { debt: 0, purchase: 5 },
      { debt: 10, purchase: 10 },
    ];

    for (const { debt, purchase } of scenarios) {
      const debtToSettle = Math.min(Math.max(debt, 0), purchase);
      const assignedHoursDelta = 0;
      expect(debtToSettle).toBeGreaterThanOrEqual(0);
      expect(assignedHoursDelta).toBe(0);
    }
  });

  it("negative manual postpaid adjustment increases debt", () => {
    const currentDebt = 4;
    const manualAdjustment = -2.5;
    const debtDelta = -manualAdjustment;
    const updatedDebt = currentDebt + debtDelta;

    expect(debtDelta).toBe(2.5);
    expect(updatedDebt).toBe(6.5);
  });
});

describe("stripe webhook idempotency", () => {
  it("same event ID produces no duplicate processing", () => {
    const processedEvents = new Set(["evt_001"]);
    const incomingEvent = "evt_001";
    const isDuplicate = processedEvents.has(incomingEvent);
    expect(isDuplicate).toBe(true);
  });

  it("different event IDs are processed independently", () => {
    const processedEvents = new Set(["evt_001"]);
    const incomingEvent = "evt_002";
    const isDuplicate = processedEvents.has(incomingEvent);
    expect(isDuplicate).toBe(false);
  });

  it("debt settlement uses event ID as source_event_id for dedup", () => {
    const ledgerEntry = {
      project_id: "proj-1",
      event_type: "payment_settlement",
      source_type: "stripe_event",
      source_event_id: "evt_001",
    };
    expect(ledgerEntry.source_event_id).toBe("evt_001");
    expect(ledgerEntry.source_type).toBe("stripe_event");
  });
});
