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

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/i18n-server", () => ({
  getLocale: mockGetLocale,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

function createMockSupabaseForQuoteComments(quoteStatus: "draft" | "signed" | "converted") {
  const insert = vi.fn().mockResolvedValue({ error: null });

  return {
    insert,
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
                  data: {
                    id: String(filters.get("id") ?? "quote-1"),
                    title: "Test quote",
                    status: quoteStatus,
                    customer_id: "customer-1",
                    created_at: "2026-01-01T00:00:00Z",
                    updated_at: "2026-01-01T00:00:00Z",
                  },
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
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
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

  it("blocks worker quote comments once the quote leaves draft", async () => {
    const { client, insert } = createMockSupabaseForQuoteComments("signed");
    mockRequireRole.mockResolvedValue({ id: "worker-1", role: "worker" });
    mockCreateClient.mockResolvedValue(client);

    const { addQuoteCommentAction } = await import("@/app/actions/quotes");
    const formData = new FormData();
    formData.set("quoteId", "quote-1");
    formData.set("commentHtml", "<p>Blocked comment</p>");

    await expect(addQuoteCommentAction(formData)).rejects.toThrow("Comments can only be added while the quote is in draft");
    expect(insert).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("allows worker quote comments while the quote is still draft", async () => {
    const { client, insert } = createMockSupabaseForQuoteComments("draft");
    mockRequireRole.mockResolvedValue({ id: "worker-1", role: "worker" });
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
