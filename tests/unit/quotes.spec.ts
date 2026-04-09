import { describe, expect, it } from "vitest";
import {
  formatCurrencyAmount,
  formatQuoteStatus,
  isQuotesBackendMissingError,
  parseQuoteRecord,
  sumEstimatedHours,
  sumLoggedHours,
} from "@/lib/quotes";
import { createBillingScenarioFixture } from "../fixtures/billing";

describe("quotes helpers", () => {
  it("parses quote rows and preserves billing-facing fields", () => {
    const fixture = createBillingScenarioFixture();

    const parsed = parseQuoteRecord({
      id: fixture.quote.id,
      title: fixture.quote.title,
      description: fixture.quote.description,
      content_html: fixture.quote.contentHtml,
      content_json: { type: "doc", content: [] },
      status: fixture.quote.status,
      customer_id: fixture.quote.customerId,
      customer_name: fixture.quote.customerName,
      total_estimated_hours: String(fixture.quote.totalEstimatedHours),
      total_logged_hours: fixture.quote.totalLoggedHours,
      signed_by_name: fixture.quote.signedByName,
      signed_at: fixture.quote.signedAt,
      signed_by_user_id: fixture.quote.signedByUserId,
      linked_project_id: fixture.quote.linkedProjectId,
      linked_project_name: fixture.quote.linkedProjectName,
      converted_at: fixture.quote.convertedAt,
      created_by: fixture.quote.createdBy,
      created_at: fixture.quote.createdAt,
      updated_at: fixture.quote.updatedAt,
      admin_notes: fixture.quote.adminNotes,
      confirmed_at: fixture.quote.confirmedAt,
      conversion_requested_at: fixture.quote.conversionRequestedAt,
      prepayment_requested_at: fixture.quote.prepaymentRequestedAt,
    });

    expect(parsed).toMatchObject({
      id: fixture.quote.id,
      title: fixture.quote.title,
      status: "signed",
      customerId: fixture.quote.customerId,
      projectId: fixture.quote.projectId,
      projectName: fixture.quote.projectName,
      totalEstimatedHours: 18,
      totalLoggedHours: 5.5,
      prepaymentRequestedAt: fixture.quote.prepaymentRequestedAt,
      confirmedAt: fixture.quote.confirmedAt,
      signatureName: fixture.quote.signatureName,
    });
    expect(parsed.contentJson).toEqual({ type: "doc", content: [] });
  });

  it("aggregates billing totals from reusable fixtures", () => {
    const fixture = createBillingScenarioFixture();

    expect(sumEstimatedHours(fixture.estimates)).toBe(18);
    expect(sumLoggedHours(fixture.loggedHours)).toBe(5.5);
    expect(formatCurrencyAmount(fixture.prepayment.amountCents, fixture.prepayment.currency)).toBe("900.00 USD");
    expect(formatQuoteStatus("it", fixture.quote.status)).toBe("Firmato");
  });

  it("detects backend-missing quote errors without matching unrelated failures", () => {
    expect(isQuotesBackendMissingError({ code: "42P01", message: "relation quotes does not exist" })).toBe(true);
    expect(isQuotesBackendMissingError({ code: "42703", message: "column quote_workers.worker_name does not exist" })).toBe(true);
    expect(isQuotesBackendMissingError({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe(false);
  });
});
