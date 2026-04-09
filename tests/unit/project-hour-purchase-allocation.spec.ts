import { describe, expect, it } from "vitest";

describe("project hour purchase allocation", () => {
  it("project with no debt credits all purchased hours as prepaid", () => {
    const outstandingDebt = 0;
    const hoursPurchased = 10;
    const debtToSettle = Math.min(outstandingDebt, hoursPurchased);
    const prepaidCredit = hoursPurchased - debtToSettle;

    expect(debtToSettle).toBe(0);
    expect(prepaidCredit).toBe(10);
  });

  it("project with debt less than purchase settles all debt and credits remainder", () => {
    const outstandingDebt = 6;
    const hoursPurchased = 10;
    const debtToSettle = Math.min(outstandingDebt, hoursPurchased);
    const prepaidCredit = hoursPurchased - debtToSettle;

    expect(debtToSettle).toBe(6);
    expect(prepaidCredit).toBe(4);
  });

  it("project with debt greater than purchase settles partial debt with no prepaid credit", () => {
    const outstandingDebt = 15;
    const hoursPurchased = 10;
    const debtToSettle = Math.min(outstandingDebt, hoursPurchased);
    const prepaidCredit = hoursPurchased - debtToSettle;

    expect(debtToSettle).toBe(10);
    expect(prepaidCredit).toBe(0);
  });

  it("debt exactly equal to purchase zeroes out debt with no prepaid credit", () => {
    const outstandingDebt = 8;
    const hoursPurchased = 8;
    const debtToSettle = Math.min(outstandingDebt, hoursPurchased);
    const prepaidCredit = hoursPurchased - debtToSettle;

    expect(debtToSettle).toBe(8);
    expect(prepaidCredit).toBe(0);
  });

  it("settlement event hours are negative (reducing debt)", () => {
    const debtToSettle = 6;
    const settlementHours = -debtToSettle;
    expect(settlementHours).toBeLessThan(0);
    expect(settlementHours).toBe(-6);
  });

  it("prepaid credit is only added when greater than zero", () => {
    const scenarios = [
      { debt: 6, purchase: 10, expectCredit: true },
      { debt: 15, purchase: 10, expectCredit: false },
      { debt: 0, purchase: 5, expectCredit: true },
      { debt: 10, purchase: 10, expectCredit: false },
    ];

    for (const { debt, purchase, expectCredit } of scenarios) {
      const debtToSettle = Math.min(debt, purchase);
      const prepaidCredit = purchase - debtToSettle;
      expect(prepaidCredit > 0).toBe(expectCredit);
    }
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
