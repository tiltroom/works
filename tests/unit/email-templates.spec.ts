import { describe, expect, it } from "vitest";
import {
  renderProjectDiscussionMessageEmail,
  renderQuoteCreatedEmail,
  renderQuoteConvertedEmail,
  renderQuoteDiscussionMessageEmail,
  renderQuoteRevertedEmail,
} from "@/lib/email-templates";

const APP_URL = "https://app.example.com";
const QUOTE_ID = "quote-123";
const QUOTE_TITLE = "Kitchen Renovation";
const CUSTOMER_NAME = "Mario Rossi";
const PROJECT_ID = "project-123";
const PROJECT_TITLE = "Kitchen Installation";

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

    expect(result.subject).toBe("Quote reverted to draft: Kitchen Renovation");
    expect(result.html).toContain('html lang="en"');
    expect(result.html).toContain("Quote reverted to draft");
    expect(result.html).toContain("Current status · Draft");
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

    expect(result.subject).toBe("Preventivo riportato in bozza: Kitchen Renovation");
    expect(result.html).toContain("Preventivo riportato in bozza");
    expect(result.html).toContain("Prossimo passo");
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
    expect(result.html).toContain("associated with your account");
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
    expect(result.html).toContain("Hour logging is temporarily suspended");
  });
});

describe("discussion message email templates", () => {
  it("renders quote discussion email with a role-specific quote link and escaped preview", () => {
    const result = renderQuoteDiscussionMessageEmail({
      locale: "en",
      quoteTitle: QUOTE_TITLE,
      quoteId: QUOTE_ID,
      customerName: CUSTOMER_NAME,
      authorName: "Worker <One>",
      messagePreview: "Please review <scope> & timing",
      appUrl: APP_URL,
      recipientRole: "worker",
    });

    expect(result.subject).toBe("New discussion message: Kitchen Renovation");
    expect(result.html).toContain("New Quote Discussion Message");
    expect(result.html).toContain("Worker &lt;One&gt;");
    expect(result.html).toContain("Please review &lt;scope&gt; &amp; timing");
    expect(result.html).toContain(`/worker/quotes/${QUOTE_ID}`);
  });

  it("renders project discussion email with a role-specific project link", () => {
    const result = renderProjectDiscussionMessageEmail({
      locale: "it",
      projectTitle: PROJECT_TITLE,
      projectId: PROJECT_ID,
      customerName: CUSTOMER_NAME,
      authorName: "Mario Rossi",
      messagePreview: "Aggiornamento progetto",
      appUrl: APP_URL,
      recipientRole: "customer",
    });

    expect(result.subject).toBe("Nuovo messaggio nel progetto: Kitchen Installation");
    expect(result.html).toContain("Nuovo Messaggio nella Discussione del Progetto");
    expect(result.html).toContain("Aggiornamento progetto");
    expect(result.html).toContain(`/customer/projects/${PROJECT_ID}`);
  });
});
