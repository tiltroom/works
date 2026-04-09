import { describe, expect, it } from "vitest";
import { parseQuoteRecord } from "@/lib/quotes";

describe("quote conversion billing mode branching", () => {
  it("parses prepaid billing_mode from database row", () => {
    const record = parseQuoteRecord({
      id: "q-001",
      title: "Prepaid Quote",
      status: "signed",
      billing_mode: "prepaid",
      customer_id: "cust-001",
      total_estimated_hours: 10,
      total_logged_hours: 0,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(record.billingMode).toBe("prepaid");
  });

  it("parses postpaid billing_mode from database row", () => {
    const record = parseQuoteRecord({
      id: "q-002",
      title: "Post-paid Quote",
      status: "signed",
      billing_mode: "postpaid",
      customer_id: "cust-001",
      total_estimated_hours: 10,
      total_logged_hours: 0,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(record.billingMode).toBe("postpaid");
  });

  it("defaults to prepaid when billing_mode is missing", () => {
    const record = parseQuoteRecord({
      id: "q-003",
      title: "Legacy Quote",
      status: "draft",
      customer_id: "cust-001",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(record.billingMode).toBe("prepaid");
  });

  it("defaults to prepaid for unknown billing_mode values", () => {
    const record = parseQuoteRecord({
      id: "q-004",
      title: "Unknown Mode Quote",
      status: "draft",
      billing_mode: "unknown",
      customer_id: "cust-001",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(record.billingMode).toBe("prepaid");
  });

  it("QuoteRecord includes billingMode field for all records", () => {
    const record = parseQuoteRecord({
      id: "q-005",
      title: "Test",
      status: "signed",
      billing_mode: "postpaid",
      customer_id: "cust-001",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(record).toHaveProperty("billingMode");
    expect(typeof record.billingMode).toBe("string");
    expect(["prepaid", "postpaid"]).toContain(record.billingMode);
  });
});
