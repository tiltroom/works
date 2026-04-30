import { describe, expect, it } from "vitest";
import {
  datetimeLocalValueToUtcIso,
  parseOptionalUtcDateTime,
  parseUtcDateTimeInput,
  toUtcIsoString,
  utcIsoToDatetimeLocalValue,
} from "@/lib/date-time";
import { parseQuoteRecord } from "@/lib/quotes";

describe("date time UTC/local boundaries", () => {
  it("accepts only UTC ISO strings for server time entry inputs", () => {
    expect(parseUtcDateTimeInput("2026-04-09T10:00:00.000Z", "Start").toISOString()).toBe("2026-04-09T10:00:00.000Z");
    expect(() => parseUtcDateTimeInput("2026-04-09T10:00", "Start")).toThrow("Start must be a UTC ISO timestamp");
  });

  it("normalizes offset timestamp outputs to UTC ISO strings", () => {
    expect(toUtcIsoString("2026-04-09T12:00:00+02:00")).toBe("2026-04-09T10:00:00.000Z");
    expect(parseOptionalUtcDateTime("2026-04-09T12:00:00+02:00")).toBeNull();
  });

  it("converts local datetime input values to UTC ISO strings", () => {
    const expected = new Date("2026-04-09T10:30").toISOString();
    expect(datetimeLocalValueToUtcIso("2026-04-09T10:30")).toBe(expected);
  });

  it("formats UTC instants for datetime-local with local getters", () => {
    const iso = "2026-04-09T10:30:00.000Z";
    const date = new Date(iso);
    const pad = (value: number) => String(value).padStart(2, "0");
    const expected = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

    expect(utcIsoToDatetimeLocalValue(iso)).toBe(expected);
  });

  it("normalizes quote timestamp fields emitted to the app", () => {
    const parsed = parseQuoteRecord({
      id: "quote-1",
      title: "Quote",
      status: "signed",
      customer_id: "customer-1",
      total_estimated_hours: 1,
      total_logged_hours: 0,
      signed_at: "2026-04-09T12:00:00+02:00",
      customer_signed_at: "2026-04-09T13:00:00+02:00",
      converted_at: "2026-04-09T14:00:00+02:00",
      created_at: "2026-04-09T15:00:00+02:00",
      updated_at: "2026-04-09T16:00:00+02:00",
    });

    expect(parsed.signedAt).toBe("2026-04-09T10:00:00.000Z");
    expect(parsed.customerSignedAt).toBe("2026-04-09T11:00:00.000Z");
    expect(parsed.convertedAt).toBe("2026-04-09T12:00:00.000Z");
    expect(parsed.createdAt).toBe("2026-04-09T13:00:00.000Z");
    expect(parsed.updatedAt).toBe("2026-04-09T14:00:00.000Z");
  });
});
