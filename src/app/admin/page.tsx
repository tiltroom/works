import { createProjectAction, deleteProjectAction, updateProjectAction } from "@/app/actions/projects";
import { deleteInvitationAction, inviteUserAction } from "@/app/actions/invitations";
import { deletePlatformUserAction, updateCustomerHourlyRateAction } from "@/app/actions/admin-users";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

type AdminTab = "overview" | "projects" | "users";

type AdminCustomer = {
  id: string;
  full_name: string | null;
  role: "customer";
  custom_hourly_rate_cents: number | null;
};

type CustomerRateRow = {
  id: string;
  custom_hourly_rate_cents: number | null;
};

type AdminListedUser = {
  id: string;
  full_name: string | null;
  role: "admin" | "customer" | "worker";
};

function tabStyles(isActive: boolean) {
  return isActive
    ? "border-brand-500/40 bg-brand-500/15 text-brand-700 dark:text-brand-300"
    : "border-border bg-card/60 text-muted-foreground hover:bg-accent hover:text-accent-foreground";
}

const panelClass = "rounded-2xl border border-border bg-card/80 backdrop-blur-sm";
const tableShellClass = "overflow-hidden rounded-xl border border-border/70 bg-background/45";
const tableHeadClass = "border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground";
const tableRowClass = "transition-colors hover:bg-accent/60";
const inputClass = "w-full rounded-lg border border-input bg-background/75 px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all";
const multiSelectClass = "w-full rounded-lg border border-input bg-background/75 px-3 py-2.5 text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all";

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; editProjectId?: string; deleteProjectId?: string; deleteInvitationId?: string; deleteUserId?: string }> | { tab?: string; editProjectId?: string; deleteProjectId?: string; deleteInvitationId?: string; deleteUserId?: string };
}) {
  const locale = await getLocale();
  await requireRole(["admin"]);
  const supabase = await createClient();

  const params = await Promise.resolve(searchParams ?? {});
  const tabParam = params.tab;
  const editProjectIdParam = params.editProjectId;
  const deleteProjectIdParam = params.deleteProjectId;
  const deleteInvitationIdParam = params.deleteInvitationId;
  const deleteUserIdParam = params.deleteUserId;
  const activeTab: AdminTab = tabParam === "projects" || tabParam === "users" ? tabParam : "overview";

  const [{ data: customerProfiles }, { data: customerRates, error: customerRatesError }, { data: workers }, { data: admins }, { data: projects }, { data: invitations }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,role").eq("role", "customer"),
    supabase.from("profiles").select("id,custom_hourly_rate_cents").eq("role", "customer"),
    supabase.from("profiles").select("id,full_name,role").eq("role", "worker"),
    supabase.from("profiles").select("id,full_name,role").eq("role", "admin"),
    supabase
      .from("projects")
      .select("id,name,description,assigned_hours,customer_id,profiles!projects_customer_id_fkey(full_name),project_workers(worker_id)"),
    supabase
      .from("invitations")
      .select("id,email,role,full_name,created_at,accepted_at")
      .order("created_at", { ascending: false }),
  ]);

  const missingCustomerRateColumn = customerRatesError?.code === "PGRST204"
    || customerRatesError?.code === "42703"
    || customerRatesError?.message.includes("custom_hourly_rate_cents")
    || false;

  if (customerRatesError && !missingCustomerRateColumn) {
    throw new Error(customerRatesError.message);
  }

  const customerRatesById = new Map(
    ((customerRates ?? []) as CustomerRateRow[]).map((customerRate) => [customerRate.id, customerRate.custom_hourly_rate_cents]),
  );

  const customers: AdminCustomer[] = ((customerProfiles ?? []) as Array<{ id: string; full_name: string | null; role: "customer" }>).map((customer) => ({
    ...customer,
    custom_hourly_rate_cents: customerRatesById.get(customer.id) ?? null,
  }));
  const allUsers: AdminListedUser[] = [
    ...((admins ?? []) as AdminListedUser[]),
    ...customers.map((customer) => ({
      id: customer.id,
      full_name: customer.full_name,
      role: customer.role,
    })),
    ...((workers ?? []) as AdminListedUser[]),
  ].sort((left, right) => {
    const leftLabel = (left.full_name || left.id).toLocaleLowerCase();
    const rightLabel = (right.full_name || right.id).toLocaleLowerCase();

    return leftLabel.localeCompare(rightLabel);
  });

  const pendingInvitations = (invitations ?? []).filter((invitation) => !invitation.accepted_at);
  const totalAssignedHours = (projects ?? []).reduce((sum, project) => sum + Number(project.assigned_hours ?? 0), 0);
  const editingProject = (projects ?? []).find((project) => project.id === editProjectIdParam) ?? null;
  const deletingProject = (projects ?? []).find((project) => project.id === deleteProjectIdParam) ?? null;
  const deletingInvitation = pendingInvitations.find((invitation) => invitation.id === deleteInvitationIdParam) ?? null;
  const deletingUser = allUsers.find((user) => user.id === deleteUserIdParam) ?? null;
  const editingProjectWorkerIds = editingProject
    ? ((editingProject.project_workers as { worker_id: string }[] | null) ?? []).map((assignment) => assignment.worker_id)
    : [];

  return (
    <main className="w-full">
      <header className="mb-8 flex flex-col justify-between gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
            <span className="p-2 bg-red-500/10 text-red-500 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            {t(locale, "Admin Control Center", "Centro di controllo amministratore")}
          </h1>
          <p className="mt-1 text-muted-foreground">{t(locale, "Overview first, then manage projects and users from focused tabs.", "Prima panoramica, poi gestione di progetti e utenti dalle schede dedicate.")}</p>
        </div>
        <LogoutButton />
      </header>

      <div className="mb-8 grid grid-cols-1 gap-2 rounded-2xl border border-border bg-card/60 p-2 sm:grid-cols-3">
        <Link href="/admin" className={`rounded-xl border px-4 py-3 text-sm font-semibold text-center transition-all ${tabStyles(activeTab === "overview")}`}>
          {t(locale, "Overview", "Panoramica")}
        </Link>
        <Link href="/admin?tab=projects" className={`rounded-xl border px-4 py-3 text-sm font-semibold text-center transition-all ${tabStyles(activeTab === "projects")}`}>
          {t(locale, "Projects", "Progetti")}
        </Link>
        <Link href="/admin?tab=users" className={`rounded-xl border px-4 py-3 text-sm font-semibold text-center transition-all ${tabStyles(activeTab === "users")}`}>
          {t(locale, "Users", "Utenti")}
        </Link>
      </div>

      {activeTab === "overview" && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <article className={`${panelClass} p-5`}>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{t(locale, "Projects", "Progetti")}</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{projects?.length ?? 0}</p>
            </article>
            <article className={`${panelClass} p-5`}>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{t(locale, "Customers", "Clienti")}</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{customers?.length ?? 0}</p>
            </article>
            <article className={`${panelClass} p-5`}>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{t(locale, "Workers", "Operatori")}</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{workers?.length ?? 0}</p>
            </article>
            <article className={`${panelClass} p-5`}>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{t(locale, "Assigned Hours", "Ore assegnate")}</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{totalAssignedHours.toFixed(2)}</p>
            </article>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className={`lg:col-span-2 ${panelClass} p-6`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">{t(locale, "Recent Projects", "Progetti recenti")}</h2>
                <Link href="/admin?tab=projects" className="text-sm text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300">{t(locale, "Go to Projects", "Vai ai progetti")}</Link>
              </div>
              <div className={tableShellClass}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className={tableHeadClass}>
                      <tr>
                        <th className="px-4 py-3 font-medium">{t(locale, "Name", "Nome")}</th>
                        <th className="px-4 py-3 font-medium">{t(locale, "Customer", "Cliente")}</th>
                        <th className="px-4 py-3 font-medium text-right">{t(locale, "Hours", "Ore")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {(projects ?? []).slice(0, 5).length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">{t(locale, "No projects yet.", "Nessun progetto ancora.")}</td>
                        </tr>
                      ) : (
                        (projects ?? []).slice(0, 5).map((project) => (
                          <tr key={project.id} className={tableRowClass}>
                            <td className="px-4 py-3 font-medium text-foreground">{project.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{(project.profiles as { full_name?: string } | null)?.full_name || t(locale, "Unknown", "Sconosciuto")}</td>
                            <td className="px-4 py-3 text-right text-foreground/85">{Number(project.assigned_hours).toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className={`${panelClass} p-6`}>
              <h2 className="mb-4 text-xl font-semibold text-foreground">{t(locale, "Team Snapshot", "Panoramica team")}</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2">
                  <span className="text-muted-foreground">{t(locale, "Admins", "Amministratori")}</span>
                  <span className="font-semibold text-foreground">{admins?.length ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2">
                  <span className="text-muted-foreground">{t(locale, "Customers", "Clienti")}</span>
                  <span className="font-semibold text-foreground">{customers?.length ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2">
                  <span className="text-muted-foreground">{t(locale, "Workers", "Operatori")}</span>
                  <span className="font-semibold text-foreground">{workers?.length ?? 0}</span>
                </div>
                <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                  {pendingInvitations.length} {t(locale, pendingInvitations.length === 1 ? "pending invitation" : "pending invitations", pendingInvitations.length === 1 ? "invito in attesa" : "inviti in attesa")}
                </div>
              </div>
              <Link href="/admin?tab=users" className="mt-4 inline-block text-sm text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300">
                {t(locale, "Review users and invitations", "Controlla utenti e inviti")} →
              </Link>
            </section>
          </div>
        </section>
      )}

      {activeTab === "projects" && (
        <section className="space-y-6">
          <section className={`${panelClass} p-6`}>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground">{t(locale, "Create Project", "Crea progetto")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t(locale, "Create a project and assign workers in one step.", "Crea un progetto e assegna operatori in un unico passaggio.")}</p>
            </div>

            <form action={createProjectAction} className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <div className="space-y-1.5">
                  <label htmlFor="name" className="text-sm font-medium text-foreground">{t(locale, "Project Name", "Nome progetto")}</label>
                  <input id="name" name="name" placeholder={t(locale, "Enter project name", "Inserisci nome progetto")} required className={inputClass} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="customerId" className="text-sm font-medium text-foreground">{t(locale, "Customer", "Cliente")}</label>
                    <select id="customerId" name="customerId" required className={`${inputClass} appearance-none`}>
                      <option value="" className="bg-background text-foreground">{t(locale, "Select customer", "Seleziona cliente")}</option>
                      {(customers ?? []).map((customer) => (
                        <option key={customer.id} value={customer.id} className="bg-background text-foreground">
                          {customer.full_name || customer.id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="assignedHours" className="text-sm font-medium text-foreground">{t(locale, "Assigned Hours", "Ore assegnate")}</label>
                    <input
                      id="assignedHours"
                      name="assignedHours"
                      type="number"
                      min="0"
                      step="0.25"
                      required
                      placeholder={t(locale, "e.g. 40", "es. 40")}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="description" className="text-sm font-medium text-foreground">{t(locale, "Description (Optional)", "Descrizione (opzionale)")}</label>
                  <textarea
                    id="description"
                    name="description"
                    rows={4}
                    placeholder={t(locale, "Brief project description", "Breve descrizione del progetto")}
                    className="w-full resize-none rounded-lg border border-input bg-background/75 px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                  />
                </div>
              </div>

              <aside className="rounded-xl border border-border bg-background/55 p-4">
                <label htmlFor="workerIds" className="text-sm font-medium text-foreground">{t(locale, "Assign Workers (Optional)", "Assegna operatori (opzionale)")}</label>
                <p className="mb-3 mt-1 text-xs text-muted-foreground">{t(locale, "Hold Ctrl/Cmd to pick multiple workers.", "Tieni premuto Ctrl/Cmd per selezionare più operatori.")}</p>
                <select
                  id="workerIds"
                  name="workerIds"
                  multiple
                  className={`${multiSelectClass} min-h-48`}
                >
                  {(workers ?? []).map((worker) => (
                    <option key={worker.id} value={worker.id} className="bg-background py-1 text-foreground">
                      {worker.full_name || worker.id}
                    </option>
                  ))}
                </select>
              </aside>

              <div className="lg:col-span-3">
                <button className="w-full sm:w-auto rounded-lg bg-brand-600 px-5 py-3 font-medium text-white transition-all hover:bg-brand-500 hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] border border-brand-400/20">
                  {t(locale, "Create Project", "Crea progetto")}
                </button>
              </div>
            </form>
          </section>

          <section className={`${panelClass} p-6`}>
            <div className="flex items-center justify-between mb-6">
               <h2 className="text-xl font-semibold text-foreground">{t(locale, "Active Projects", "Progetti attivi")}</h2>
               <span className="rounded-md bg-blue-500/10 px-2 py-1 text-xs font-bold text-blue-700 dark:text-blue-300">{projects?.length || 0} {t(locale, "Total", "Totale")}</span>
             </div>

            <div className={tableShellClass}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className={tableHeadClass}>
                    <tr>
                       <th className="px-4 py-3 font-medium">{t(locale, "Name", "Nome")}</th>
                       <th className="px-4 py-3 font-medium">{t(locale, "Customer", "Cliente")}</th>
                       <th className="px-4 py-3 font-medium text-right">{t(locale, "Hours", "Ore")}</th>
                       <th className="px-4 py-3 font-medium text-right">{t(locale, "Actions", "Azioni")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {(projects ?? []).length === 0 ? (
                      <tr>
                         <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">{t(locale, "No projects found. Create one above.", "Nessun progetto trovato. Creane uno sopra.")}</td>
                      </tr>
                    ) : (
                      (projects ?? []).map((project) => (
                        <tr key={project.id} className={tableRowClass}>
                          <td className="px-4 py-3 font-medium text-foreground">{project.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{(project.profiles as { full_name?: string } | null)?.full_name || t(locale, "Unknown", "Sconosciuto")}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center rounded border border-border bg-background/65 px-2 py-0.5 text-xs font-medium text-foreground">
                              {Number(project.assigned_hours).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/admin?tab=projects&editProjectId=${project.id}`}
                                className="rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                              >
                                 {t(locale, "Edit", "Modifica")}
                               </Link>
                              <Link
                                href={`/admin?tab=projects&deleteProjectId=${project.id}`}
                                className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-500/10 dark:text-red-300"
                              >
                                 {t(locale, "Delete", "Elimina")}
                               </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {editingProject && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
                <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl">
                  <div className="flex items-center justify-between border-b border-border px-5 py-4">
                     <h3 className="text-lg font-semibold text-foreground">{t(locale, "Edit Project", "Modifica progetto")}</h3>
                    <Link href="/admin?tab=projects" className="rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                       {t(locale, "Close", "Chiudi")}
                    </Link>
                  </div>

                  <form action={updateProjectAction} className="grid gap-4 p-5 md:grid-cols-2">
                    <input type="hidden" name="projectId" value={editingProject.id} />

                    <div className="space-y-1.5 md:col-span-2">
                       <label htmlFor="modal-project-name" className="text-sm font-medium text-foreground">{t(locale, "Name", "Nome")}</label>
                      <input
                        id="modal-project-name"
                        name="name"
                        defaultValue={editingProject.name}
                        required
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-1.5">
                       <label htmlFor="modal-project-customer" className="text-sm font-medium text-foreground">{t(locale, "Customer", "Cliente")}</label>
                      <select
                        id="modal-project-customer"
                        name="customerId"
                        required
                        defaultValue={editingProject.customer_id}
                        className={inputClass}
                      >
                        {(customers ?? []).map((customer) => (
                          <option key={customer.id} value={customer.id} className="bg-background text-foreground">
                            {customer.full_name || customer.id}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                       <label htmlFor="modal-project-description" className="text-sm font-medium text-foreground">{t(locale, "Description", "Descrizione")}</label>
                      <textarea
                        id="modal-project-description"
                        name="description"
                        defaultValue={editingProject.description ?? ""}
                        rows={4}
                        className="w-full resize-none rounded-lg border border-input bg-background/75 px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                       <label htmlFor="modal-worker-ids" className="text-sm font-medium text-foreground">{t(locale, "Assigned Workers (Optional)", "Operatori assegnati (opzionale)")}</label>
                       <p className="text-xs text-muted-foreground">{t(locale, "Hold Ctrl/Cmd to select multiple workers.", "Tieni premuto Ctrl/Cmd per selezionare più operatori.")}</p>
                      <select
                        id="modal-worker-ids"
                        name="workerIds"
                        multiple
                        defaultValue={editingProjectWorkerIds}
                        className={`${multiSelectClass} min-h-40`}
                      >
                        {(workers ?? []).map((worker) => (
                          <option key={worker.id} value={worker.id} className="bg-background py-1 text-foreground">
                            {worker.full_name || worker.id}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2 flex items-center justify-end gap-2">
                      <Link href="/admin?tab=projects" className="rounded-lg border border-border bg-background/60 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                         {t(locale, "Cancel", "Annulla")}
                       </Link>
                      <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition-colors">
                         {t(locale, "Save Changes", "Salva modifiche")}
                       </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {deletingProject && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
                  <div className="border-b border-border px-5 py-4">
                     <h3 className="text-lg font-semibold text-foreground">{t(locale, "Confirm Deletion", "Conferma eliminazione")}</h3>
                  </div>

                  <div className="space-y-4 px-5 py-4">
                    <p className="text-sm text-muted-foreground">
                       {t(locale, "Are you sure you want to delete", "Sei sicuro di voler eliminare")} <span className="font-semibold text-foreground">{deletingProject.name}</span>? {t(locale, "This action cannot be undone.", "Questa azione non può essere annullata.")}
                    </p>

                    <div className="flex items-center justify-end gap-2">
                      <Link href="/admin?tab=projects" className="rounded-lg border border-border bg-background/60 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                         {t(locale, "Cancel", "Annulla")}
                       </Link>
                      <form action={deleteProjectAction}>
                        <input type="hidden" name="projectId" value={deletingProject.id} />
                        <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors">
                           {t(locale, "Delete Project", "Elimina progetto")}
                         </button>
                       </form>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </section>
      )}

      {activeTab === "users" && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <article className={`${panelClass} p-5`}>
               <p className="text-xs uppercase tracking-wider text-muted-foreground">{t(locale, "Admins", "Amministratori")}</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{admins?.length ?? 0}</p>
            </article>
            <article className={`${panelClass} p-5`}>
               <p className="text-xs uppercase tracking-wider text-muted-foreground">{t(locale, "Customers", "Clienti")}</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{customers?.length ?? 0}</p>
            </article>
            <article className={`${panelClass} p-5`}>
               <p className="text-xs uppercase tracking-wider text-muted-foreground">{t(locale, "Workers", "Operatori")}</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{workers?.length ?? 0}</p>
            </article>
          </div>

          <section className={`${panelClass} p-6`}>
            <div className="flex items-center justify-between mb-6">
               <h2 className="text-xl font-semibold text-foreground">{t(locale, "Customer Hourly Rates", "Tariffe orarie clienti")}</h2>
               <span className="rounded-md bg-blue-500/10 px-2 py-1 text-xs font-bold text-blue-700 dark:text-blue-300">{t(locale, "Stripe Refill Pricing", "Prezzi ricarica Stripe")}</span>
             </div>

            <div className={tableShellClass}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className={tableHeadClass}>
                    <tr>
                       <th className="px-4 py-3 font-medium">{t(locale, "Customer", "Cliente")}</th>
                       <th className="px-4 py-3 font-medium">{t(locale, "Custom Rate (EUR/hour)", "Tariffa personalizzata (EUR/ora)")}</th>
                       <th className="px-4 py-3 font-medium text-right">{t(locale, "Action", "Azione")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {(customers ?? []).length === 0 ? (
                      <tr>
                         <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">{t(locale, "No customers found.", "Nessun cliente trovato.")}</td>
                      </tr>
                    ) : (
                      (customers ?? []).map((customer) => {
                        const hourlyRateCents = (customer as { custom_hourly_rate_cents?: number | null }).custom_hourly_rate_cents;
                        const customHourlyRate = hourlyRateCents != null ? (hourlyRateCents / 100).toFixed(2) : "";

                        return (
                          <tr key={customer.id} className={tableRowClass}>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">{customer.full_name || customer.id}</span>
                                <span className="text-xs text-muted-foreground">{customer.id}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <form
                                id={`customer-hourly-rate-${customer.id}`}
                                action={updateCustomerHourlyRateAction}
                                className="flex items-center gap-2"
                              >
                                <input type="hidden" name="customerId" value={customer.id} />
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                                  <input
                                    name="customHourlyRate"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    defaultValue={customHourlyRate}
                                     placeholder={t(locale, "Default", "Predefinito")}
                                     className="w-40 rounded-lg border border-input bg-background/75 py-2 pl-7 pr-3 text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                   />
                                 </div>
                                 <span className="text-xs text-muted-foreground">{t(locale, "Leave empty = global default", "Lascia vuoto = valore globale")}</span>
                               </form>
                             </td>
                             <td className="px-4 py-3 text-right">
                               <button
                                 type="submit"
                                 form={`customer-hourly-rate-${customer.id}`}
                                 className="rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                               >
                                 {t(locale, "Save Rate", "Salva tariffa")}
                               </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className={`${panelClass} p-6`}>
             <h2 className="mb-6 text-xl font-semibold text-foreground">{t(locale, "Invite User", "Invita utente")}</h2>
             <form action={inviteUserAction} className="grid gap-4 sm:grid-cols-2">
               <div className="space-y-1.5 sm:col-span-2">
                 <label htmlFor="invite-email" className="text-sm font-medium text-foreground">{t(locale, "Email Address", "Indirizzo email")}</label>
                <input
                  id="invite-email"
                  name="email"
                  type="email"
                  required
                   placeholder={t(locale, "user@example.com", "utente@esempio.com")}
                   className={inputClass}
                 />
               </div>

               <div className="space-y-1.5">
                 <label htmlFor="fullName" className="text-sm font-medium text-foreground">{t(locale, "Full Name", "Nome completo")}</label>
                <input
                  id="fullName"
                  name="fullName"
                   placeholder={t(locale, "John Doe", "Mario Rossi")}
                   className={inputClass}
                 />
               </div>

               <div className="space-y-1.5">
                 <label htmlFor="role" className="text-sm font-medium text-foreground">{t(locale, "Role", "Ruolo")}</label>
                <select id="role" name="role" className={`${inputClass} appearance-none`}>
                  <option value="worker" className="bg-background text-foreground">{t(locale, "Worker", "Operatore")}</option>
                  <option value="customer" className="bg-background text-foreground">{t(locale, "Customer", "Cliente")}</option>
                  <option value="admin" className="bg-background text-foreground">{t(locale, "Admin", "Amministratore")}</option>
                </select>
              </div>

              <div className="sm:col-span-2 mt-2">
               <button className="w-full rounded-lg border border-border bg-background/70 px-4 py-3 font-medium text-foreground transition-all hover:bg-accent hover:text-accent-foreground">
                  {t(locale, "Send Invitation", "Invia invito")}
                </button>
              </div>
            </form>
          </section>

          <section className={`${panelClass} p-6`}>
            <div className="flex items-center justify-between mb-6">
               <h2 className="text-xl font-semibold text-foreground">{t(locale, "All Users", "Tutti gli utenti")}</h2>
               <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">{allUsers.length} {t(locale, "Active", "Attivi")}</span>
             </div>

            <div className={tableShellClass}>
              <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead className={tableHeadClass}>
                     <tr>
                        <th className="px-4 py-3 font-medium">{t(locale, "User", "Utente")}</th>
                        <th className="px-4 py-3 font-medium">{t(locale, "Role", "Ruolo")}</th>
                        <th className="px-4 py-3 font-medium text-right">{t(locale, "Status", "Stato")}</th>
                        <th className="px-4 py-3 font-medium text-right">{t(locale, "Actions", "Azioni")}</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-border/70">
                    {allUsers.length === 0 ? (
                       <tr>
                         <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">{t(locale, "No users found.", "Nessun utente trovato.")}</td>
                       </tr>
                     ) : (
                       allUsers.map((user) => (
                        <tr key={user.id} className={tableRowClass}>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                               <span className="font-medium text-foreground">{user.full_name || t(locale, "No name", "Senza nome")}</span>
                              <span className="text-xs text-muted-foreground">{user.id}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                              user.role === "admin"
                                ? "border border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300"
                                : user.role === "worker"
                                  ? "border border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300"
                                  : "border border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              {t(locale, "Active", "Attivo")}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/admin?tab=users&deleteUserId=${user.id}`}
                                className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-500/10 dark:text-red-300"
                              >
                                {t(locale, "Delete", "Elimina")}
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {deletingUser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
                  <div className="border-b border-border px-5 py-4">
                    <h3 className="text-lg font-semibold text-foreground">{t(locale, "Confirm Deletion", "Conferma eliminazione")}</h3>
                  </div>

                  <div className="space-y-4 px-5 py-4">
                    <p className="text-sm text-muted-foreground">
                      {t(locale, "Are you sure you want to delete this user", "Sei sicuro di voler eliminare questo utente")} <span className="font-semibold text-foreground">{deletingUser.full_name || deletingUser.id}</span>? {t(locale, "This will cascade and remove all related data for this account. This action cannot be undone.", "Questo eliminerà a cascata tutti i dati collegati a questo account. Questa azione non può essere annullata.")}
                    </p>

                    <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-xs text-red-700 dark:text-red-200">
                      <p className="font-medium text-red-700 dark:text-red-300">{t(locale, "Role", "Ruolo")}</p>
                      <p className="mt-1 capitalize">{deletingUser.role}</p>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <Link href="/admin?tab=users" className="rounded-lg border border-border bg-background/60 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                        {t(locale, "Cancel", "Annulla")}
                      </Link>
                      <form action={deletePlatformUserAction}>
                        <input type="hidden" name="userId" value={deletingUser.id} />
                        <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors">
                          {t(locale, "Delete User", "Elimina utente")}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className={`${panelClass} p-6`}>
            <div className="flex items-center justify-between mb-6">
               <h2 className="text-xl font-semibold text-foreground">{t(locale, "Pending Invitations", "Inviti in attesa")}</h2>
               <span className="rounded-md bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">{pendingInvitations.length} {t(locale, "Pending", "In attesa")}</span>
             </div>

            <div className={tableShellClass}>
              <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead className={tableHeadClass}>
                     <tr>
                        <th className="px-4 py-3 font-medium">{t(locale, "User", "Utente")}</th>
                        <th className="px-4 py-3 font-medium">{t(locale, "Role", "Ruolo")}</th>
                        <th className="px-4 py-3 font-medium text-right">{t(locale, "Status", "Stato")}</th>
                        <th className="px-4 py-3 font-medium text-right">{t(locale, "Actions", "Azioni")}</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-border/70">
                    {pendingInvitations.length === 0 ? (
                       <tr>
                         <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">{t(locale, "No pending invitations found.", "Nessun invito in attesa trovato.")}</td>
                       </tr>
                     ) : (
                       pendingInvitations.map((invite) => (
                        <tr key={invite.id} className={tableRowClass}>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                               <span className="font-medium text-foreground">{invite.full_name || t(locale, "No name", "Senza nome")}</span>
                              <span className="text-xs text-muted-foreground">{invite.email}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                              invite.role === "admin"
                                ? "border border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300"
                                : invite.role === "worker"
                                  ? "border border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300"
                                  : "border border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                            }`}>
                              {invite.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              {t(locale, "Pending", "In attesa")}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/admin?tab=users&deleteInvitationId=${invite.id}`}
                                className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-500/10 dark:text-red-300"
                              >
                                {t(locale, "Delete", "Elimina")}
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {deletingInvitation && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
                  <div className="border-b border-border px-5 py-4">
                    <h3 className="text-lg font-semibold text-foreground">{t(locale, "Confirm Deletion", "Conferma eliminazione")}</h3>
                  </div>

                  <div className="space-y-4 px-5 py-4">
                    <p className="text-sm text-muted-foreground">
                      {t(locale, "Are you sure you want to delete the pending user", "Sei sicuro di voler eliminare l'utente in attesa")} <span className="font-semibold text-foreground">{deletingInvitation.full_name || deletingInvitation.email}</span>? {t(locale, "This will also remove everything related to this user and cannot be undone.", "Questo rimuoverà anche tutto ciò che è collegato a questo utente e non può essere annullato.")}
                    </p>

                    <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-xs text-red-700 dark:text-red-200">
                      <p className="font-medium text-red-700 dark:text-red-300">{t(locale, "Email", "Email")}</p>
                      <p className="mt-1 break-all">{deletingInvitation.email}</p>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <Link href="/admin?tab=users" className="rounded-lg border border-border bg-background/60 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                        {t(locale, "Cancel", "Annulla")}
                      </Link>
                      <form action={deleteInvitationAction}>
                        <input type="hidden" name="invitationId" value={deletingInvitation.id} />
                        <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors">
                          {t(locale, "Delete User", "Elimina utente")}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </section>
      )}
    </main>
  );
}
