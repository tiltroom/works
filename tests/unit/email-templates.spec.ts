import { describe, expect, it } from "vitest";
import {
  renderQuoteCreatedEmail,
  renderQuoteConvertedEmail,
  renderQuoteRevertedEmail,
} from "@/lib/email-templates";

const APP_URL = "https://app.example.com";
const QUOTE_ID = "quote-123";
const QUOTE_TITLE = "Kitchen Renovation";
const CUSTOMER_NAME = "Mario Rossi";

describe("renderQuoteCreatedEmail", () => {
  it("renders subject and html in English", () => {
    const result = renderQuoteCreatedEmail({
      locale: "en",
      quoteTitle: QUOTE_TITLE,
      quoteId: QUOTE_ID,
      customerName: CUSTOMER_NAME,
      appUrl: APP_URL,
    });

    expect(result.subject).toBe("New Quote: Kitchen Renovation");
    expect(result.html).toContain("New Quote Created");
    expect(result.html).toContain("Mario Rossi");
    expect(result.html).toContain(APP_URL);
  });

  it("renders subject and html in Italian", () => {
    const result = renderQuoteCreatedEmail({
      locale: "it",
      quoteTitle: QUOTE_TITLE,
      quoteId: QUOTE_ID,
      customerName: CUSTOMER_NAME,
      appUrl: APP_URL,
    });

    expect(result.subject).toBe("Nuovo Preventivo: Kitchen Renovation");
    expect(result.html).toContain("Nuovo Preventivo Creato");
    expect(result.html).toContain("Mario Rossi");
    expect(result.html).toContain(APP_URL);
  });

  it("uses admin link (no role suffix) for created email", () => {
    const result = renderQuoteCreatedEmail({
      locale: "en",
      quoteTitle: QUOTE_TITLE,
      quoteId: QUOTE_ID,
      customerName: CUSTOMER_NAME,
      appUrl: APP_URL,
    });

    expect(result.html).toContain(`/admin/quotes/${QUOTE_ID}`);
    expect(result.html).not.toContain(`/customer/quotes/${QUOTE_ID}`);
    expect(result.html).not.toContain(`/worker/quotes/${QUOTE_ID}`);
  });

  it("falls back to English for unknown locale", () => {
    const result = renderQuoteCreatedEmail({
      locale: "fr",
      quoteTitle: QUOTE_TITLE,
      quoteId: QUOTE_ID,
      customerName: CUSTOMER_NAME,
      appUrl: APP_URL,
    });

    expect(result.subject).toBe("New Quote: Kitchen Renovation");
    expect(result.html).toContain("New Quote Created");
  });

  it("escapes html characters in quote title and customer name", () => {
    const result = renderQuoteCreatedEmail({
      locale: "en",
      quoteTitle: "Kitchen & Bath <Renovation>",
      quoteId: QUOTE_ID,
      customerName: "Mario <Rossi> & Sons",
      appUrl: APP_URL,
    });

    // Raw < > characters should NOT appear; & and quotes should be escaped
    expect(result.html).not.toContain("<Renovation>");
    expect(result.html).not.toContain("<Rossi>");
    expect(result.html).toContain("Kitchen &amp; Bath &lt;Renovation&gt;");
    expect(result.html).toContain("Mario &lt;Rossi&gt; &amp; Sons");
  });
});

describe("renderQuoteConvertedEmail", () => {
  it("renders subject and html in English", () => {
    const result = renderQuoteConvertedEmail({
      locale: "en",
      quoteTitle: QUOTE_TITLE,
      quoteId: QUOTE_ID,
      customerName: CUSTOMER_NAME,
      appUrl: APP_URL,
    });

    expect(result.subject).toBe("Quote Converted: Kitchen Renovation");
    expect(result.html).toContain("Quote Converted to Project");
    expect(result.html).toContain("Mario Rossi");
  });

  it("renders subject and html in Italian", () => {
    const result = renderQuoteConvertedEmail({
      locale: "it",
      quoteTitle: QUOTE_TITLE,
      quoteId: QUOTE_ID,
      customerName: CUSTOMER_NAME,
      appUrl: APP_URL,
    });

    expect(result.subject).toBe("Preventivo Convertito: Kitchen Renovation");
    expect(result.html).toContain("Preventivo Convertito in Progetto");
  });

  it("uses admin link when recipientRole is undefined", () => {
    const result = renderQuoteConvertedEmail({
      locale: "en",
      quoteTitle: QUOTE_TITLE,
      quoteId: QUOTE_ID,
      customerName: CUSTOMER_NAME,
      appUrl: APP_URL,
    });

    expect(result.html).toContain(`/admin/quotes/${QUOTE_ID}`);
  });

  it("uses customer link when recipientRole is 'customer'", () => {
    const result = renderQuoteConvertedEmail({
      locale: "en",
      quoteTitle: QUOTE_TITLE,
      quoteId: QUOTE_ID,
      customerName: CUSTOMER_NAME,
      appUrl: APP_URL,
      recipientRole: "customer",
    });

    expect(result.html).toContain(`/customer/quotes/${QUOTE_ID}`);
    expect(result.html).toContain("Your quote");
  });

  it("uses worker link when recipientRole is 'worker'", () => {
    const result = renderQuoteConvertedEmail({
      locale: "en",
      quoteTitle: QUOTE_TITLE,
      quoteId: QUOTE_ID,
      customerName: CUSTOMER_NAME,
      appUrl: APP_URL,
      recipientRole: "worker",
    });

    expect(result.html).toContain(`/worker/quotes/${QUOTE_ID}`);
    expect(result.html).toContain("assigned to you");
  });
});

describe("renderQuoteRevertedEmail", () => {
  it("renders subject and html in English", () => {
    const result = renderQuoteRevertedEmail({
      locale: "en",
      quoteTitle: QUOTE_TITLE,
      quoteId: QUOTE_ID,
      customerName: CUSTOMER_NAME,
      appUrl: APP_URL,
    });

    expect(result.subject).toBe("Quote Reverted: Kitchen Renovation");
    expect(result.html).toContain("Quote Reverted to Draft");
    expect(result.html).toContain("Mario Rossi");
  });

  it("renders subject and html in Italian", () => {
    const result = renderQuoteRevertedEmail({
      locale: "it",
      quoteTitle: QUOTE_TITLE,
      quoteId: QUOTE_ID,
      customerName: CUSTOMER_NAME,
      appUrl: APP_URL,
    });

    expect(result.subject).toBe("Preventivo Ripristinato: Kitchen Renovation");
    expect(result.html).toContain("Preventivo Ripristinato a Bozza");
  });

  it("uses admin link when recipientRole is undefined", () => {
    const result = renderQuoteRevertedEmail({
      locale: "en",
      quoteTitle: QUOTE_TITLE,
      quoteId: QUOTE_ID,
      customerName: CUSTOMER_NAME,
      appUrl: APP_URL,
    });

    expect(result.html).toContain(`/admin/quotes/${QUOTE_ID}`);
  });

  it("uses customer link when recipientRole is 'customer'", () => {
    const result = renderQuoteRevertedEmail({
      locale: "en",
      quoteTitle: QUOTE_TITLE,
      quoteId: QUOTE_ID,
      customerName: CUSTOMER_NAME,
      appUrl: APP_URL,
      recipientRole: "customer",
    });

    expect(result.html).toContain(`/customer/quotes/${QUOTE_ID}`);
    expect(result.html).toContain("reverted to draft");
  });

  it("uses worker link when recipientRole is 'worker'", () => {
    const result = renderQuoteRevertedEmail({
      locale: "en",
      quoteTitle: QUOTE_TITLE,
      quoteId: QUOTE_ID,
      customerName: CUSTOMER_NAME,
      appUrl: APP_URL,
      recipientRole: "worker",
    });

    expect(result.html).toContain(`/worker/quotes/${QUOTE_ID}`);
    expect(result.html).toContain("Logging hours is paused");
  });
});