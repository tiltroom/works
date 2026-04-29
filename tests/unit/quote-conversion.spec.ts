import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  it("copies logged quote subtask entries into project time entries idempotently", () => {
    const migrationSql = readFileSync(
      join(process.cwd(), "supabase", "2026-04-18-copy-quote-subtask-entries-to-project.sql"),
      "utf8",
    );

    expect(migrationSql).toContain("add column if not exists quote_subtask_entry_id uuid");
    expect(migrationSql).toContain("add constraint time_entries_quote_subtask_entry_id_fkey");
    expect(migrationSql).toContain("references public.quote_subtask_entries(id)");
    expect(migrationSql).toContain("on delete cascade");
    expect(migrationSql).toMatch(/unique \(quote_subtask_entry_id\)/);
    expect(migrationSql).toContain("create or replace function public.copy_quote_subtask_entries_to_project");
    expect(migrationSql).toMatch(/insert into public\.time_entries[\s\S]*quote_subtask_entry_id/);
    expect(migrationSql).toMatch(/from public\.quote_subtask_entries qse\s+join public\.quote_subtasks qs on qs\.id = qse\.quote_subtask_id/);
    expect(migrationSql).toContain("where qs.quote_id = p_quote_id");
    expect(migrationSql).toContain("and qse.worker_id is not null");
    expect(migrationSql).toContain("on conflict (quote_subtask_entry_id) do update");
    expect(migrationSql).toContain("set project_id = excluded.project_id");
    expect(migrationSql).toContain("started_at = excluded.started_at");
    expect(migrationSql).toContain("description = excluded.description");
  });

  it("keeps copied quote time entries write-protected from authenticated users", () => {
    const migrationSql = readFileSync(
      join(process.cwd(), "supabase", "2026-04-18-copy-quote-subtask-entries-to-project.sql"),
      "utf8",
    );

    const insertPolicyBlock = migrationSql.match(/create policy "time_entries_insert_worker_or_admin"[\s\S]*?\);/)?.[0];
    const updatePolicyBlock = migrationSql.match(/create policy "time_entries_update_owner_or_admin"[\s\S]*?\);/)?.[0];
    const deletePolicyBlock = migrationSql.match(/create policy "time_entries_delete_owner_or_admin"[\s\S]*?\);/)?.[0];

    expect(insertPolicyBlock).toContain("quote_subtask_entry_id is null");
    expect(updatePolicyBlock).toContain("quote_subtask_entry_id is null");
    expect(deletePolicyBlock).toContain("quote_subtask_entry_id is null");
    expect(migrationSql).toContain("revoke execute on function public.copy_quote_subtask_entries_to_project(uuid, uuid) from authenticated");
  });

  it("keeps the bootstrap schema aligned with quote-derived time entry safeguards", () => {
    const schemaSql = readFileSync(
      join(process.cwd(), "supabase", "schema.sql"),
      "utf8",
    );

    expect(schemaSql).toContain("quote_subtask_entry_id uuid");
    expect(schemaSql).toMatch(/constraint time_entries_quote_subtask_entry_unique unique \(quote_subtask_entry_id\)/);
    expect(schemaSql).toContain("idx_time_entries_quote_subtask_entry_id");
    expect(schemaSql).toMatch(/create policy "time_entries_insert_worker_or_admin"[\s\S]*quote_subtask_entry_id is null/);
    expect(schemaSql).toMatch(/create policy "time_entries_update_owner_or_admin"[\s\S]*quote_subtask_entry_id is null/);
    expect(schemaSql).toMatch(/create policy "time_entries_delete_owner_or_admin"[\s\S]*quote_subtask_entry_id is null/);
    expect(schemaSql).toMatch(/if new\.ended_at is null or new\.quote_subtask_entry_id is not null then/);
    expect(schemaSql).toContain("and te.quote_subtask_entry_id is null");
  });

  it("adds a direct quote subtask link for project time entries", () => {
    const migrationSql = readFileSync(
      join(process.cwd(), "supabase", "2026-04-24-link-time-entries-to-quote-subtasks.sql"),
      "utf8",
    );

    expect(migrationSql).toContain("add column if not exists quote_subtask_id uuid");
    expect(migrationSql).toContain("add constraint time_entries_quote_subtask_id_fkey");
    expect(migrationSql).toContain("references public.quote_subtasks(id)");
    expect(migrationSql).toContain("idx_time_entries_quote_subtask_id");
    expect(migrationSql).toMatch(/update public\.time_entries te[\s\S]*set quote_subtask_id = qse\.quote_subtask_id/);
    expect(migrationSql).toContain("create or replace function public.sync_time_entry_quote_subtask_id");
    expect(migrationSql).toMatch(/insert into public\.time_entries[\s\S]*quote_subtask_id,[\s\S]*quote_subtask_entry_id/);
    expect(migrationSql).toContain("quote_subtask_id = excluded.quote_subtask_id");
  });

  it("keeps the direct quote subtask link in a dated migration instead of the bootstrap schema", () => {
    const schemaSql = readFileSync(
      join(process.cwd(), "supabase", "schema.sql"),
      "utf8",
    );
    const migrationSql = readFileSync(
      join(process.cwd(), "supabase", "2026-04-24-link-time-entries-to-quote-subtasks.sql"),
      "utf8",
    );

    expect(schemaSql).not.toContain("quote_subtask_id uuid");
    expect(schemaSql).not.toContain("idx_time_entries_quote_subtask_id");
    expect(migrationSql).toContain("add column if not exists quote_subtask_id uuid");
    expect(migrationSql).toContain("idx_time_entries_quote_subtask_id");
  });

  it("runs quote subtask entry copying in every conversion entry point", () => {
    const migrationSql = readFileSync(
      join(process.cwd(), "supabase", "2026-04-18-copy-quote-subtask-entries-to-project.sql"),
      "utf8",
    );

    const prepaidConversionBlock = migrationSql.match(/create or replace function public\.convert_quote_to_project_core[\s\S]*?create or replace function public\.apply_postpaid_quote_conversion/)?.[0];
    const postpaidConversionBlock = migrationSql.match(/create or replace function public\.apply_postpaid_quote_conversion[\s\S]*?create or replace function public\.apply_quote_conversion_payment/)?.[0];
    const stripeConversionBlock = migrationSql.match(/create or replace function public\.apply_quote_conversion_payment[\s\S]*?create or replace function public\.apply_manual_quote_conversion/)?.[0];
    const manualConversionBlock = migrationSql.match(/create or replace function public\.apply_manual_quote_conversion[\s\S]*?revoke execute on function public\.copy_quote_subtask_entries_to_project/)?.[0];

    expect(prepaidConversionBlock).toBeDefined();
    expect(prepaidConversionBlock?.match(/perform public\.copy_quote_subtask_entries_to_project/g)).toHaveLength(2);
    expect(postpaidConversionBlock).toBeDefined();
    expect(postpaidConversionBlock?.match(/perform public\.copy_quote_subtask_entries_to_project/g)).toHaveLength(2);
    expect(stripeConversionBlock).toBeDefined();
    expect(stripeConversionBlock?.match(/perform public\.copy_quote_subtask_entries_to_project/g)).toHaveLength(3);
    expect(manualConversionBlock).toBeDefined();
    expect(manualConversionBlock?.match(/perform public\.copy_quote_subtask_entries_to_project/g)).toHaveLength(1);
  });
});
