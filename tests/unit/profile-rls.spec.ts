import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workerCanReadAssignedProjectCustomerPattern = /from public\.projects p\s+join public\.project_workers pw on pw\.project_id = p\.id\s+where p\.customer_id = profiles\.id\s+and pw\.worker_id = auth\.uid\(\)/;
const customerDisplayFunctionAccessPattern = /from public\.project_workers pw\s+where pw\.project_id = p\.id\s+and pw\.worker_id = auth\.uid\(\)/;
const customerCanReadRelatedWorkerPattern = /from public\.time_entries te\s+join public\.projects p on p\.id = te\.project_id\s+where te\.worker_id = profiles\.id\s+and p\.customer_id = auth\.uid\(\)/;

describe("profile RLS project relationships", () => {
  it("adds a scoped RPC for the customer display name on assigned worker projects", () => {
    const migrationSql = readFileSync(
      join(process.cwd(), "supabase", "2026-04-25-worker-customer-profile-rls.sql"),
      "utf8",
    );

    expect(migrationSql).toContain("create or replace function public.get_project_customer_display_name(p_project_id uuid)");
    expect(migrationSql).toContain("returns table");
    expect(migrationSql).toContain("security definer");
    expect(migrationSql).toContain("join public.profiles c on c.id = p.customer_id");
    expect(migrationSql).toMatch(customerDisplayFunctionAccessPattern);
    expect(migrationSql).toContain("grant execute on function public.get_project_customer_display_name(uuid) to authenticated;");
  });

  it("does not grant assigned workers broad profile row visibility", () => {
    const migrationSql = readFileSync(
      join(process.cwd(), "supabase", "2026-04-25-worker-customer-profile-rls.sql"),
      "utf8",
    );

    expect(migrationSql).toContain('create policy "profiles_select_self_admin_or_related_customer"');
    expect(migrationSql).toMatch(customerCanReadRelatedWorkerPattern);
    expect(migrationSql).not.toMatch(workerCanReadAssignedProjectCustomerPattern);
  });

  it("keeps the scoped customer display lookup in its dated migration instead of the bootstrap schema", () => {
    const schemaSql = readFileSync(
      join(process.cwd(), "supabase", "schema.sql"),
      "utf8",
    );
    const migrationSql = readFileSync(
      join(process.cwd(), "supabase", "2026-04-25-worker-customer-profile-rls.sql"),
      "utf8",
    );

    expect(schemaSql).toContain('create policy "profiles_select_self_or_admin"');
    expect(schemaSql).not.toContain('create policy "profiles_select_self_admin_or_related_customer"');
    expect(schemaSql).not.toMatch(workerCanReadAssignedProjectCustomerPattern);
    expect(schemaSql).not.toContain("create or replace function public.get_project_customer_display_name(p_project_id uuid)");
    expect(migrationSql).toContain('create policy "profiles_select_self_admin_or_related_customer"');
    expect(migrationSql).toMatch(customerCanReadRelatedWorkerPattern);
    expect(migrationSql).toContain("create or replace function public.get_project_customer_display_name(p_project_id uuid)");
    expect(migrationSql).toMatch(customerDisplayFunctionAccessPattern);
  });

  it("uses the scoped customer display RPC on the worker project detail page", () => {
    const pageContent = readFileSync(
      join(process.cwd(), "src/app/worker/projects/[projectId]/page.tsx"),
      "utf8",
    );

    expect(pageContent).not.toContain("profiles!projects_customer_id_fkey(full_name)");
    expect(pageContent).toContain('rpc("get_project_customer_display_name", { p_project_id: projectId })');
    expect(pageContent).toContain("loadProjectCustomerDisplayName(supabase, project.id, project.customer_id)");
    expect(pageContent).toContain("customerDisplayName || t(locale, \"Unknown\", \"Sconosciuto\")");
  });

  it("keeps a server-side fallback for environments before the RPC migration is applied", () => {
    const pageContent = readFileSync(
      join(process.cwd(), "src/app/worker/projects/[projectId]/page.tsx"),
      "utf8",
    );

    expect(pageContent).toContain('error?.message.includes("get_project_customer_display_name")');
    expect(pageContent).toContain("createAdminClient()");
    expect(pageContent).toContain('from("profiles")');
    expect(pageContent).toContain('eq("id", customerId)');
  });
});
