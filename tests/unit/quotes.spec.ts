import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatCurrencyAmount,
  formatQuoteStatus,
  isQuotesBackendMissingError,
  parseQuoteRecord,
  sumEstimatedHours,
  sumLoggedHours,
} from "@/lib/quotes";
import { createBillingScenarioFixture } from "../fixtures/billing";

const mockRequireRole = vi.fn();
const mockGetLocale = vi.fn();
const mockRevalidatePath = vi.fn();
const mockCreateClient = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockNotifyQuoteCreated = vi.fn();
const mockNotifyQuoteConverted = vi.fn();
const mockNotifyQuoteDiscussionMessage = vi.fn();
const mockNotifyQuoteReverted = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("next/server", () => ({
  after: (callback: () => void | Promise<void>) => {
    void callback();
  },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/i18n", () => ({
  getLocale: mockGetLocale,
  t: (locale: string, en: string, it: string) => {
    void locale;
    void it;
    return en;
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

vi.mock("@/lib/notifications", () => ({
  notifyQuoteCreated: mockNotifyQuoteCreated,
  notifyQuoteConverted: mockNotifyQuoteConverted,
  notifyQuoteDiscussionMessage: mockNotifyQuoteDiscussionMessage,
  notifyQuoteReverted: mockNotifyQuoteReverted,
}));

vi.mock("@/lib/i18n-server", () => ({
  getLocale: mockGetLocale,
}));

function createMockSupabaseForQuoteComments(
  quoteStatus: "draft" | "signed" | "converted",
  options?: { authorId?: string; authorRole?: "admin" | "customer" | "worker" },
) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  });

  const quoteData = {
    id: "quote-1",
    title: "Test quote",
    status: quoteStatus,
    customer_id: "customer-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    linked_project_id: quoteStatus === "converted" ? "project-1" : null,
    confirmed_at: quoteStatus === "signed" || quoteStatus === "converted" ? "2026-04-08T09:10:00.000Z" : null,
    conversion_requested_at: quoteStatus === "converted" ? "2026-04-08T10:00:00.000Z" : null,
    prepayment_requested_at: quoteStatus === "signed" ? "2026-04-08T09:15:00.000Z" : null,
  };

  return {
    insert,
    update,
    client: {
      from(table: string) {
        if (table === "quotes") {
          return {
            select(_columns: string, options?: { head?: boolean }) {
              if (options?.head) {
                return Promise.resolve({ data: null, error: null, count: 1 });
              }

              const filters = new Map<string, unknown>();

              return {
                eq(column: string, value: unknown) {
                  filters.set(column, value);
                  return this;
                },
                maybeSingle: vi.fn().mockImplementation(async () => ({
                  data: { ...quoteData, id: String(filters.get("id") ?? "quote-1") },
                  error: null,
                })),
              };
            },
          };
        }

        if (table === "quote_workers") {
          return {
            select() {
              return {
                eq() {
                  return this;
                },
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { quote_id: "quote-1" },
                  error: null,
                }),
              };
            },
          };
        }

        if (table === "quote_comments") {
          return {
            insert,
            update,
            select() {
              return {
                eq() {
                  return this;
                },
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "comment-1",
                    quote_id: "quote-1",
                    author_id: options?.authorId ?? "current-user",
                    author_role: options?.authorRole ?? "worker",
                    comment_html: "<p>Original comment</p>",
                    comment_json: null,
                    created_at: "2026-01-01T00:00:00Z",
                    updated_at: "2026-01-01T00:00:00Z",
                  },
                  error: null,
                }),
              };
            },
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    },
  };
}

function createMockSupabaseForRevertQuote(options?: {
  status?: "draft" | "signed" | "converted";
  linkedProjectId?: string | null;
  convertedAt?: string | null;
  confirmedAt?: string | null;
  conversionRequestedAt?: string | null;
  prepaymentRequestedAt?: string | null;
}) {
  const update = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });

  const quoteData = {
    id: "quote-revert-1",
    title: "Quote to revert",
    status: options?.status ?? "converted",
    billing_mode: "postpaid",
    customer_id: "customer-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    linked_project_id: options?.linkedProjectId ?? "project-1",
    converted_at: options?.convertedAt ?? "2026-04-10T00:00:00Z",
    signed_by_name: "Admin User",
    signed_at: "2026-04-08T09:10:00.000Z",
    signed_by_user_id: "admin-1",
    confirmed_at: options?.confirmedAt ?? "2026-04-08T09:10:00.000Z",
    conversion_requested_at: options?.conversionRequestedAt ?? "2026-04-09T10:00:00.000Z",
    prepayment_requested_at: options?.prepaymentRequestedAt ?? "2026-04-08T09:15:00.000Z",
  };

  const client = {
    from(table: string) {
      if (table === "quotes") {
        return {
          select(_columns: string, options?: { head?: boolean }) {
            if (options?.head) {
              return Promise.resolve({ data: null, error: null, count: 1 });
            }

            const filters = new Map<string, unknown>();
            return {
              eq(column: string, value: unknown) {
                filters.set(column, value);
                return this;
              },
              maybeSingle: vi.fn().mockImplementation(async () => ({
                data: { ...quoteData, id: String(filters.get("id") ?? quoteData.id) },
                error: null,
              })),
            };
          },
          update,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  return { client, update };
}

function createMockSupabaseForCustomerPostpaidConversion(options?: {
  signatureError?: { message: string } | null;
  rpcError?: { message: string } | null;
}) {
  const filters = new Map<string, unknown>();
  const update = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      is: vi.fn().mockResolvedValue({ error: options?.signatureError ?? null }),
    }),
  });
  const rpc = vi.fn().mockResolvedValue({ error: options?.rpcError ?? null });
  const quoteData = {
    id: "quote-postpaid-001",
    title: "Post-paid quote",
    status: "signed",
    billing_mode: "postpaid",
    customer_id: "customer-1",
    total_estimated_hours: 0,
    total_logged_hours: 0,
    signed_by_name: "Admin User",
    signed_at: "2026-04-08T09:10:00.000Z",
    signed_by_user_id: "admin-1",
    customer_signed_by_name: null,
    customer_signed_at: null,
    customer_signed_by_user_id: null,
    linked_project_id: null,
    converted_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  const browserClient = {
    from(table: string) {
      if (table !== "quotes") {
        throw new Error(`Unexpected browser table ${table}`);
      }

      return {
        select(_columns: string, selectOptions?: { head?: boolean }) {
          if (selectOptions?.head) {
            return Promise.resolve({ data: null, error: null, count: 1 });
          }

          return {
            eq(column: string, value: unknown) {
              filters.set(column, value);
              return this;
            },
            maybeSingle: vi.fn().mockImplementation(async () => ({
              data: { ...quoteData, id: String(filters.get("id") ?? quoteData.id) },
              error: null,
            })),
          };
        },
      };
    },
  };

  const adminClient = {
    from(table: string) {
      if (table !== "quotes") {
        throw new Error(`Unexpected admin table ${table}`);
      }

      return { update };
    },
    rpc,
  };

  return { browserClient, adminClient, update, rpc };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLocale.mockResolvedValue("en");
});

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

  it("allows worker quote comments on signed quotes (status gating removed)", async () => {
    mockRequireRole.mockResolvedValue({ id: "worker-1", role: "worker" });
    const { client, insert } = createMockSupabaseForQuoteComments("signed");
    mockCreateClient.mockResolvedValue(client);

    const { addQuoteCommentAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", "quote-1");
    formData.set("commentHtml", "<p>Allowed on signed quote</p>");

    await expect(addQuoteCommentAction(formData)).resolves.toBeUndefined();
    expect(insert).toHaveBeenCalledWith({
      author_id: "worker-1",
      author_role: "worker",
      comment_html: "<p>Allowed on signed quote</p>",
      comment_json: null,
      quote_id: "quote-1",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/worker/quotes/quote-1");
  });

  it("allows worker quote comments while the quote is still draft", async () => {
    mockRequireRole.mockResolvedValue({ id: "worker-1", role: "worker" });
    const { client, insert } = createMockSupabaseForQuoteComments("draft");
    mockCreateClient.mockResolvedValue(client);

    const { addQuoteCommentAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", "quote-1");
    formData.set("commentHtml", "<p>Allowed comment</p>");

    await expect(addQuoteCommentAction(formData)).resolves.toBeUndefined();
    expect(insert).toHaveBeenCalledWith({
      author_id: "worker-1",
      author_role: "worker",
      comment_html: "<p>Allowed comment</p>",
      comment_json: null,
      quote_id: "quote-1",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/worker/quotes/quote-1");
  });

  it("allows customer quote comments on signed quotes", async () => {
    mockRequireRole.mockResolvedValue({ id: "customer-1", role: "customer" });
    const { client, insert } = createMockSupabaseForQuoteComments("signed");
    mockCreateClient.mockResolvedValue(client);

    const { addQuoteCommentAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", "quote-1");
    formData.set("commentHtml", "<p>Customer comment on signed quote</p>");

    await expect(addQuoteCommentAction(formData)).resolves.toBeUndefined();
    expect(insert).toHaveBeenCalledWith({
      author_id: "customer-1",
      author_role: "customer",
      comment_html: "<p>Customer comment on signed quote</p>",
      comment_json: null,
      quote_id: "quote-1",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/customer/quotes/quote-1");
  });

  it("allows admin quote comments on signed quotes", async () => {
    mockRequireRole.mockResolvedValue({ id: "admin-1", role: "admin" });
    const { client, insert } = createMockSupabaseForQuoteComments("signed");
    mockCreateClient.mockResolvedValue(client);

    const { addQuoteCommentAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", "quote-1");
    formData.set("commentHtml", "<p>Admin comment on signed quote</p>");

    await expect(addQuoteCommentAction(formData)).resolves.toBeUndefined();
    expect(insert).toHaveBeenCalledWith({
      author_id: "admin-1",
      author_role: "admin",
      comment_html: "<p>Admin comment on signed quote</p>",
      comment_json: null,
      quote_id: "quote-1",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/quotes/quote-1");
  });

  it("allows customer quote comments on draft quotes", async () => {
    mockRequireRole.mockResolvedValue({ id: "customer-1", role: "customer" });
    const { client, insert } = createMockSupabaseForQuoteComments("draft");
    mockCreateClient.mockResolvedValue(client);

    const { addQuoteCommentAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", "quote-1");
    formData.set("commentHtml", "<p>Customer comment on draft</p>");

    await expect(addQuoteCommentAction(formData)).resolves.toBeUndefined();
    expect(insert).toHaveBeenCalledWith({
      author_id: "customer-1",
      author_role: "customer",
      comment_html: "<p>Customer comment on draft</p>",
      comment_json: null,
      quote_id: "quote-1",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/customer/quotes/quote-1");
  });

  it("allows admin quote comments on converted quotes (post-signature state)", async () => {
    mockRequireRole.mockResolvedValue({ id: "admin-1", role: "admin" });
    const { client, insert } = createMockSupabaseForQuoteComments("converted");
    mockCreateClient.mockResolvedValue(client);

    const { addQuoteCommentAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", "quote-1");
    formData.set("commentHtml", "<p>Admin comment on converted quote</p>");

    await expect(addQuoteCommentAction(formData)).resolves.toBeUndefined();
    expect(insert).toHaveBeenCalledWith({
      author_id: "admin-1",
      author_role: "admin",
      comment_html: "<p>Admin comment on converted quote</p>",
      comment_json: null,
      quote_id: "quote-1",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/quotes/quote-1");
  });

  it("allows worker to edit own comment on signed quotes", async () => {
    mockRequireRole.mockResolvedValue({ id: "worker-1", role: "worker" });
    const { client, update } = createMockSupabaseForQuoteComments("signed", { authorId: "worker-1", authorRole: "worker" });
    mockCreateClient.mockResolvedValue(client);

    const { updateQuoteCommentAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", "quote-1");
    formData.set("commentId", "comment-1");
    formData.set("commentHtml", "<p>Edited worker comment on signed quote</p>");

    await expect(updateQuoteCommentAction(formData)).resolves.toBeUndefined();
    expect(update).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/worker/quotes/quote-1");
  });

  it("allows worker to edit own comment on converted quotes (post-signature state)", async () => {
    mockRequireRole.mockResolvedValue({ id: "worker-1", role: "worker" });
    const { client, update } = createMockSupabaseForQuoteComments("converted", { authorId: "worker-1", authorRole: "worker" });
    mockCreateClient.mockResolvedValue(client);

    const { updateQuoteCommentAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", "quote-1");
    formData.set("commentId", "comment-1");
    formData.set("commentHtml", "<p>Edited worker comment on converted quote</p>");

    await expect(updateQuoteCommentAction(formData)).resolves.toBeUndefined();
    expect(update).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/worker/quotes/quote-1");
  });

  it("allows customer to edit own comment on signed quotes", async () => {
    mockRequireRole.mockResolvedValue({ id: "customer-1", role: "customer" });
    const { client, update } = createMockSupabaseForQuoteComments("signed", { authorId: "customer-1", authorRole: "customer" });
    mockCreateClient.mockResolvedValue(client);

    const { updateQuoteCommentAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", "quote-1");
    formData.set("commentId", "comment-1");
    formData.set("commentHtml", "<p>Edited customer comment</p>");

    await expect(updateQuoteCommentAction(formData)).resolves.toBeUndefined();
    expect(update).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/customer/quotes/quote-1");
  });

  it("allows admin to edit own comment on converted quotes (post-signature state)", async () => {
    mockRequireRole.mockResolvedValue({ id: "admin-1", role: "admin" });
    const { client, update } = createMockSupabaseForQuoteComments("converted", { authorId: "admin-1", authorRole: "admin" });
    mockCreateClient.mockResolvedValue(client);

    const { updateQuoteCommentAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", "quote-1");
    formData.set("commentId", "comment-1");
    formData.set("commentHtml", "<p>Admin edited comment on converted quote</p>");

    await expect(updateQuoteCommentAction(formData)).resolves.toBeUndefined();
    expect(update).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/quotes/quote-1");
  });

  it("prevents worker from editing another user's comment on signed quotes", async () => {
    mockRequireRole.mockResolvedValue({ id: "worker-1", role: "worker" });
    const { client } = createMockSupabaseForQuoteComments("signed");
    mockCreateClient.mockResolvedValue(client);

    const { updateQuoteCommentAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", "quote-1");
    formData.set("commentId", "comment-other");
    formData.set("commentHtml", "<p>Attempted edit</p>");

    await expect(updateQuoteCommentAction(formData)).rejects.toThrow("You can only edit your own comments");
  });

  it("rejects comment add when the quote does not exist or is not accessible to the caller", async () => {
    mockRequireRole.mockResolvedValue({ id: "worker-1", role: "worker" });
    const { client, insert } = createMockSupabaseForQuoteComments("signed");
    client.from = vi.fn((table: string) => {
      if (table === "quotes") {
        return {
          select() {
            return {
              eq() {
                return this;
              },
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116", message: "Query returned no rows" } }),
            };
          },
        };
      }
      if (table === "quote_workers") {
        return {
          select() {
            return {
              eq() {
                return this;
              },
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          },
        };
      }
      if (table === "quote_comments") {
        return { insert };
      }
      throw new Error(`Unexpected table ${table}`);
    }) as typeof client.from;
    mockCreateClient.mockResolvedValue(client);

    const { addQuoteCommentAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", "nonexistent-quote");
    formData.set("commentHtml", "<p>This should be rejected</p>");

    await expect(addQuoteCommentAction(formData)).rejects.toThrow();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects comment add when the caller has no worker assignment and is not admin", async () => {
    mockRequireRole.mockResolvedValue({ id: "worker-unassigned", role: "worker" });
    const { client, insert } = createMockSupabaseForQuoteComments("signed");
    client.from = vi.fn((table: string) => {
      if (table === "quotes") {
        return {
          select() {
            return {
              eq() {
                return this;
              },
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "quote-1",
                  title: "Test quote",
                  status: "signed",
                  customer_id: "customer-1",
                  created_at: "2026-01-01T00:00:00Z",
                  updated_at: "2026-01-01T00:00:00Z",
                  linked_project_id: null,
                  confirmed_at: "2026-04-08T09:10:00.000Z",
                  conversion_requested_at: null,
                  prepayment_requested_at: null,
                },
                error: null,
              }),
            };
          },
        };
      }
      if (table === "quote_workers") {
        return {
          select() {
            return {
              eq() {
                return this;
              },
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          },
        };
      }
      if (table === "quote_comments") {
        return { insert };
      }
      throw new Error(`Unexpected table ${table}`);
    }) as typeof client.from;
    mockCreateClient.mockResolvedValue(client);

    const { addQuoteCommentAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", "quote-1");
    formData.set("commentHtml", "<p>Unassigned worker attempting to comment</p>");

    await expect(addQuoteCommentAction(formData)).rejects.toThrow();
  });

  it("rejects customer comment add when the quote belongs to a different customer", async () => {
    mockRequireRole.mockResolvedValue({ id: "customer-other", role: "customer" });
    const { client, insert } = createMockSupabaseForQuoteComments("signed");
    client.from = vi.fn((table: string) => {
      if (table === "quotes") {
        return {
          select() {
            return {
              eq() {
                return this;
              },
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          },
        };
      }
      if (table === "quote_comments") {
        return { insert };
      }
      throw new Error(`Unexpected table ${table}`);
    }) as typeof client.from;
    mockCreateClient.mockResolvedValue(client);

    const { addQuoteCommentAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", "quote-1");
    formData.set("commentHtml", "<p>Unauthorized customer attempting to comment</p>");

    await expect(addQuoteCommentAction(formData)).rejects.toThrow();
    expect(insert).not.toHaveBeenCalled();
  });

  it("allows comment add on a quote in post-signature billing state with confirmedAt and prepaymentRequestedAt populated", async () => {
    const fixture = createBillingScenarioFixture({ quote: { status: "signed" } });
    mockRequireRole.mockResolvedValue({ id: "worker-1", role: "worker" });

    const { client, insert } = createMockSupabaseForQuoteComments("signed");
    client.from = vi.fn((table: string) => {
      if (table === "quotes") {
        return {
          select() {
            return {
              eq() {
                return this;
              },
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: fixture.quote.id,
                  title: fixture.quote.title,
                  status: fixture.quote.status,
                  billing_mode: fixture.quote.billingMode,
                  customer_id: fixture.quote.customerId,
                  created_at: fixture.quote.createdAt,
                  updated_at: fixture.quote.updatedAt,
                  linked_project_id: null,
                  confirmed_at: fixture.quote.confirmedAt,
                  conversion_requested_at: fixture.quote.conversionRequestedAt,
                  prepayment_requested_at: fixture.quote.prepaymentRequestedAt,
                },
                error: null,
              }),
            };
          },
        };
      }
      if (table === "quote_workers") {
        return {
          select() {
            return {
              eq() {
                return this;
              },
              maybeSingle: vi.fn().mockResolvedValue({
                data: { quote_id: fixture.quote.id },
                error: null,
              }),
            };
          },
        };
      }
      if (table === "quote_comments") {
        return { insert };
      }
      throw new Error(`Unexpected table ${table}`);
    }) as typeof client.from;
    mockCreateClient.mockResolvedValue(client);

    const { addQuoteCommentAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", fixture.quote.id);
    formData.set("commentHtml", "<p>Comment on post-signature quote with confirmedAt</p>");

    await expect(addQuoteCommentAction(formData)).resolves.toBeUndefined();
    expect(insert).toHaveBeenCalledWith({
      author_id: "worker-1",
      author_role: "worker",
      comment_html: "<p>Comment on post-signature quote with confirmedAt</p>",
      comment_json: null,
      quote_id: fixture.quote.id,
    });
  });

  it("allows comment add on a converted quote with linkedProjectId set (postpay converted state)", async () => {
    mockRequireRole.mockResolvedValue({ id: "admin-1", role: "admin" });
    const { client, insert } = createMockSupabaseForQuoteComments("converted");
    client.from = vi.fn((table: string) => {
      if (table === "quotes") {
        return {
          select() {
            return {
              eq() {
                return this;
              },
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "quote-converted-001",
                  title: "Converted postpaid quote",
                  status: "converted",
                  billing_mode: "postpaid",
                  customer_id: "customer-1",
                  created_at: "2026-04-01T00:00:00Z",
                  updated_at: "2026-04-10T00:00:00Z",
                  linked_project_id: "project-001",
                  confirmed_at: "2026-04-08T09:10:00.000Z",
                  conversion_requested_at: "2026-04-09T10:00:00.000Z",
                  prepayment_requested_at: null,
                  converted_at: "2026-04-10T00:00:00Z",
                },
                error: null,
              }),
            };
          },
        };
      }
      if (table === "quote_comments") {
        return { insert };
      }
      throw new Error(`Unexpected table ${table}`);
    }) as typeof client.from;
    mockCreateClient.mockResolvedValue(client);

    const { addQuoteCommentAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", "quote-converted-001");
    formData.set("commentHtml", "<p>Comment on converted postpaid quote</p>");

    await expect(addQuoteCommentAction(formData)).resolves.toBeUndefined();
    expect(insert).toHaveBeenCalledWith({
      author_id: "admin-1",
      author_role: "admin",
      comment_html: "<p>Comment on converted postpaid quote</p>",
      comment_json: null,
      quote_id: "quote-converted-001",
    });
  });

  it("allows admin to edit a worker's comment on a quote (admin override is permitted)", async () => {
    mockRequireRole.mockResolvedValue({ id: "admin-1", role: "admin" });
    const { client, update } = createMockSupabaseForQuoteComments("signed", { authorId: "worker-1", authorRole: "worker" });
    mockCreateClient.mockResolvedValue(client);

    const { updateQuoteCommentAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", "quote-1");
    formData.set("commentId", "comment-1");
    formData.set("commentHtml", "<p>Admin editing worker comment</p>");

    await expect(updateQuoteCommentAction(formData)).resolves.toBeUndefined();
    expect(update).toHaveBeenCalled();
  });

  describe("page wiring: discussion compose is not gated on quote.status === draft", () => {
    it("customer quote detail page passes canCompose={true} to QuoteDiscussionPanel", () => {
      const pageContent = readFileSync(
        join(process.cwd(), "src/app/customer/quotes/[quoteId]/page.tsx"),
        "utf8",
      );
      expect(pageContent).not.toMatch(/canCompose\s*=\s*[^=]*quote\.status\s*===\s*["']draft["']/);
      const discussionPanelMatch = pageContent.match(/QuoteDiscussionPanel[\s\S]*?canCompose\s*=\s*(\{[^}]+\}|true)/);
      expect(discussionPanelMatch?.[0]).toMatch(/canCompose\s*=\s*\{?true\}?/);
    });

    it("admin quote detail page passes canCompose={true} to QuoteDiscussionPanel", () => {
      const pageContent = readFileSync(
        join(process.cwd(), "src/app/admin/quotes/[quoteId]/page.tsx"),
        "utf8",
      );
      expect(pageContent).not.toMatch(/canCompose\s*=\s*[^=]*quote\.status\s*===\s*["']draft["']/);
      const discussionPanelMatch = pageContent.match(/QuoteDiscussionPanel[\s\S]*?canCompose\s*=\s*(\{[^}]+\}|true)/);
      expect(discussionPanelMatch?.[0]).toMatch(/canCompose\s*=\s*\{?true\}?/);
    });

    it("worker quote detail page discussion does not use canMutate for canCompose", () => {
      const pageContent = readFileSync(
        join(process.cwd(), "src/app/worker/quotes/[quoteId]/page.tsx"),
        "utf8",
      );
      const workerDiscussionSection = pageContent.match(/QuoteDiscussionPanel[\s\S]*?(?=QuoteActionModal|<\/section>)/)?.[0];
      expect(workerDiscussionSection).toBeDefined();
      expect(workerDiscussionSection).not.toMatch(/canCompose\s*=\s*[^=]*canMutate/);
      expect(workerDiscussionSection).toMatch(/canCompose\s*=\s*\{?true\}?/);
    });

  it("worker quote detail page still uses canMutate for non-discussion controls", () => {
      const pageContent = readFileSync(
        join(process.cwd(), "src/app/worker/quotes/[quoteId]/page.tsx"),
        "utf8",
      );
      const headerActionPattern = /QuotesHeader[\s\S]*?action[\s\S]*?canMutate/;
      expect(pageContent).toMatch(headerActionPattern);
      expect(pageContent).toMatch(/activeSubtaskQuote\s*=\s*canMutate/);
    expect(pageContent).toMatch(/activeEntryQuote\s*=\s*canMutate/);
  });

  it("admin quote detail only shows revert to draft for non-draft quotes", () => {
    const pageContent = readFileSync(
      join(process.cwd(), "src/app/admin/quotes/[quoteId]/page.tsx"),
      "utf8",
    );

    expect(pageContent).toMatch(/const canRevertToDraft = quote\.status !== "draft";/);
  });

  it("latest quote conversion migration reuses an already linked project before creating one", () => {
    const migrationSql = readFileSync(
      join(process.cwd(), "supabase", "2026-04-15-reuse-linked-project-during-quote-conversion.sql"),
      "utf8",
    );

    expect(migrationSql).toContain("new_project_id := quote_row.linked_project_id;");
    expect(migrationSql).toMatch(/if new_project_id is null then\s+insert into public\.projects/);
    expect(migrationSql).toMatch(/else\s+update public\.projects p\s+set name = quote_row\.title,[\s\S]*billing_mode = 'postpaid'/);
  });

  it("adds customer signature fields and requires them before converted quote state", () => {
    const migrationSql = readFileSync(
      join(process.cwd(), "supabase", "2026-04-16-add-customer-quote-signature.sql"),
      "utf8",
    );

    expect(migrationSql).toContain("customer_signed_by_name text");
    expect(migrationSql).toContain("customer_signed_at timestamptz");
    expect(migrationSql).toContain("customer_signed_by_user_id uuid");
    expect(migrationSql).toMatch(/status = 'converted'[\s\S]*customer_signed_by_name[\s\S]*customer_signed_at[\s\S]*customer_signed_by_user_id/);
  });

  it("requires customer signature in the latest quote conversion functions", () => {
    const migrationSql = readFileSync(
      join(process.cwd(), "supabase", "2026-04-16-require-customer-signature-for-quote-conversion.sql"),
      "utf8",
    );

    expect(migrationSql).toContain("quote_not_customer_signed");
    expect(migrationSql).toMatch(/convert_quote_to_project_core[\s\S]*customer_signed_at is null/);
    expect(migrationSql).toMatch(/apply_postpaid_quote_conversion[\s\S]*customer_signed_at is null/);
  });

  it("allows a signed quote to carry the customer's second signature before conversion", () => {
    const migrationSql = readFileSync(
      join(process.cwd(), "supabase", "2026-04-17-allow-customer-signature-on-admin-signed-quotes.sql"),
      "utf8",
    );

    const signedStateBlock = migrationSql.match(/status = 'signed'[\s\S]*?status = 'converted'/)?.[0];
    expect(signedStateBlock).toBeDefined();
    expect(signedStateBlock).toMatch(/customer_signed_by_name is null[\s\S]*customer_signed_at is null[\s\S]*customer_signed_by_user_id is null/);
    expect(signedStateBlock).toMatch(/nullif\(btrim\(coalesce\(customer_signed_by_name, ''\)\), ''\) is not null[\s\S]*customer_signed_at is not null[\s\S]*customer_signed_by_user_id is not null/);
  });

  it("uses the admin client to customer-sign postpaid quotes before RPC conversion", async () => {
    vi.resetModules();
    mockGetLocale.mockResolvedValue("en");
    mockRequireRole.mockResolvedValue({ id: "customer-1", role: "customer", full_name: "Customer User" });
    const { browserClient, adminClient, update, rpc } = createMockSupabaseForCustomerPostpaidConversion();
    mockCreateClient.mockResolvedValue(browserClient);
    mockCreateAdminClient.mockReturnValue(adminClient);

    const { startQuoteConversionCheckoutAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", "quote-postpaid-001");

    await startQuoteConversionCheckoutAction(formData);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      customer_signed_by_name: "Customer User",
      customer_signed_by_user_id: "customer-1",
      customer_signed_at: expect.any(String),
    }));
    expect(rpc).toHaveBeenCalledWith("apply_postpaid_quote_conversion", {
      p_quote_id: "quote-postpaid-001",
      p_admin_comment: null,
    });
  });

  it("admin sign modal asks for prepaid or post-paid billing mode", () => {
    const pageContent = readFileSync(
      join(process.cwd(), "src/app/admin/quotes/[quoteId]/page.tsx"),
      "utf8",
    );

    expect(pageContent).toContain('t(locale, "Send for signature", "Manda in firma")');
    expect(pageContent).toContain('title={t(locale, "Send quote for signature", "Manda in firma")}');
    expect(pageContent).toContain('submittingLabel={t(locale, "Sending…", "Invio in corso…")}');
    expect(pageContent).toContain('successMessage={t(locale, "Quote sent for signature", "Preventivo mandato in firma")}');
    expect(pageContent).toContain('name="billingMode" value="prepaid"');
    expect(pageContent).toContain('name="billingMode" value="postpaid"');
    expect(pageContent).toContain('const canSwitchToPostpaid = false;');
    expect(pageContent).toContain('const canMarkAsPaid = false;');
  });

  it("allows admins to detach a converted quote back to draft while clearing quote-side conversion state", async () => {
    mockRequireRole.mockResolvedValue({ id: "admin-1", role: "admin" });
    const { client, update } = createMockSupabaseForRevertQuote();
    mockCreateClient.mockResolvedValue(client);

    const { revertQuoteToDraftAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", "quote-revert-1");

    await expect(revertQuoteToDraftAction(formData)).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: "draft",
      billing_mode: "prepaid",
      signed_by_name: null,
      signed_by_user_id: null,
      signed_at: null,
      customer_signed_by_name: null,
      customer_signed_by_user_id: null,
      customer_signed_at: null,
      linked_project_id: null,
      converted_at: null,
    }));
    expect(mockRevalidatePath).toHaveBeenCalled();
  });

  it("rejects revert to draft when the quote is already draft", async () => {
    mockRequireRole.mockResolvedValue({ id: "admin-1", role: "admin" });
    const { client, update } = createMockSupabaseForRevertQuote({
      status: "draft",
      linkedProjectId: null,
      convertedAt: null,
      confirmedAt: null,
      conversionRequestedAt: null,
      prepaymentRequestedAt: null,
    });
    mockCreateClient.mockResolvedValue(client);

    const { revertQuoteToDraftAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", "quote-revert-1");

    await expect(revertQuoteToDraftAction(formData)).rejects.toThrow("Quote is already in draft");
    expect(update).not.toHaveBeenCalled();
  });
});

  it("requires current project access in the project discussion update and delete policies", () => {
    const migrationSql = readFileSync(
      join(process.cwd(), "supabase", "2026-04-10-add-project-and-quote-discussion-messages.sql"),
      "utf8",
    );

    const updatePolicyBlock = migrationSql.match(
      /create policy "project_discussion_messages_update_owner_or_admin"[\s\S]*?drop policy if exists "project_discussion_messages_delete_owner_or_admin"/,
    )?.[0];
    const deletePolicyBlock = migrationSql.match(
      /create policy "project_discussion_messages_delete_owner_or_admin"[\s\S]*?drop policy if exists "project_discussion_message_edits_select_related"/,
    )?.[0];

    expect(updatePolicyBlock).toBeDefined();
    expect(updatePolicyBlock).toContain("(public.is_admin(auth.uid()) or author_id = auth.uid())");
    expect(updatePolicyBlock?.match(/public\.can_access_project_discussion\(auth\.uid\(\), project_id\)/g)).toHaveLength(2);

    expect(deletePolicyBlock).toBeDefined();
    expect(deletePolicyBlock).toContain("(public.is_admin(auth.uid()) or author_id = auth.uid())");
    expect(deletePolicyBlock).toContain("public.can_access_project_discussion(auth.uid(), project_id)");
  });

  it("requires current quote access in the quote comment update and delete policies", () => {
    const migrationSql = readFileSync(
      join(process.cwd(), "supabase", "2026-04-10-add-project-and-quote-discussion-messages.sql"),
      "utf8",
    );

    const updatePolicyBlock = migrationSql.match(
      /create policy "quote_comments_update_owner_or_admin"\s+on public\.quote_comments for update[\s\S]*?^\s*\)\s*with check[\s\S]*?^\s*\);/m,
    )?.[0];
    const deletePolicyBlock = migrationSql.match(
      /create policy "quote_comments_delete_owner_or_admin"\s+on public\.quote_comments for delete[\s\S]*?^\s*\);/m,
    )?.[0];

    expect(updatePolicyBlock).toBeDefined();
    expect(updatePolicyBlock).toContain("(public.is_admin(auth.uid()) or author_id = auth.uid())");
    expect(updatePolicyBlock).toMatch(/or\s+exists\s*\(\s*select 1\s+from public\.quotes p\s+where p\.id = quote_id/);

    expect(deletePolicyBlock).toBeDefined();
    expect(deletePolicyBlock).toContain("(public.is_admin(auth.uid()) or author_id = auth.uid())");
    expect(deletePolicyBlock).toMatch(/or\s+exists\s*\(\s*select 1\s+from public\.quotes p\s+where p\.id = quote_id/);
  });
});
