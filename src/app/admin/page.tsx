import { createProjectAction, deleteProjectAction, updateProjectAction } from "@/app/actions/projects";
import { inviteUserAction } from "@/app/actions/invitations";
import { updateCustomerHourlyRateAction } from "@/app/actions/admin-users";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import Link from "next/link";
import { getLocale, t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type AdminTab = "overview" | "projects" | "users";

function tabStyles(isActive: boolean) {
  return isActive
    ? "bg-brand-600/20 text-brand-300 border-brand-500/40"
    : "bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:bg-zinc-800/60 hover:text-zinc-200";
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; editProjectId?: string; deleteProjectId?: string }> | { tab?: string; editProjectId?: string; deleteProjectId?: string };
}) {
  const locale = await getLocale();
  await requireRole(["admin"]);
  const supabase = await createClient();

  const params = await Promise.resolve(searchParams ?? {});
  const tabParam = params.tab;
  const editProjectIdParam = params.editProjectId;
  const deleteProjectIdParam = params.deleteProjectId;
  const activeTab: AdminTab = tabParam === "projects" || tabParam === "users" ? tabParam : "overview";

  const [{ data: customers }, { data: workers }, { data: admins }, { data: projects }, { data: invitations }] = await Promise.all([
    supabase.from("profiles").select("id,full_name,role,custom_hourly_rate_cents").eq("role", "customer"),
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

  const pendingInvitations = (invitations ?? []).filter((invitation) => !invitation.accepted_at);
  const totalAssignedHours = (projects ?? []).reduce((sum, project) => sum + Number(project.assigned_hours ?? 0), 0);
  const editingProject = (projects ?? []).find((project) => project.id === editProjectIdParam) ?? null;
  const deletingProject = (projects ?? []).find((project) => project.id === deleteProjectIdParam) ?? null;
  const editingProjectWorkerIds = editingProject
    ? ((editingProject.project_workers as { worker_id: string }[] | null) ?? []).map((assignment) => assignment.worker_id)
    : [];

  return (
    <main className="w-full">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span className="p-2 bg-red-500/10 text-red-500 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            {t(locale, "Admin Control Center", "Centro di controllo amministratore")}
          </h1>
          <p className="text-zinc-400 mt-1">{t(locale, "Overview first, then manage projects and users from focused tabs.", "Prima panoramica, poi gestione di progetti e utenti dalle schede dedicate.")}</p>
        </div>
        <LogoutButton />
      </header>

      <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
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
            <article className="glass-card rounded-2xl p-5 border border-zinc-800">
              <p className="text-xs uppercase tracking-wider text-zinc-500">{t(locale, "Projects", "Progetti")}</p>
              <p className="text-3xl font-bold text-white mt-2">{projects?.length ?? 0}</p>
            </article>
            <article className="glass-card rounded-2xl p-5 border border-zinc-800">
              <p className="text-xs uppercase tracking-wider text-zinc-500">{t(locale, "Customers", "Clienti")}</p>
              <p className="text-3xl font-bold text-white mt-2">{customers?.length ?? 0}</p>
            </article>
            <article className="glass-card rounded-2xl p-5 border border-zinc-800">
              <p className="text-xs uppercase tracking-wider text-zinc-500">{t(locale, "Workers", "Operatori")}</p>
              <p className="text-3xl font-bold text-white mt-2">{workers?.length ?? 0}</p>
            </article>
            <article className="glass-card rounded-2xl p-5 border border-zinc-800">
              <p className="text-xs uppercase tracking-wider text-zinc-500">{t(locale, "Assigned Hours", "Ore assegnate")}</p>
              <p className="text-3xl font-bold text-white mt-2">{totalAssignedHours.toFixed(2)}</p>
            </article>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="glass-card rounded-2xl p-6 border border-zinc-800 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">{t(locale, "Recent Projects", "Progetti recenti")}</h2>
                <Link href="/admin?tab=projects" className="text-sm text-brand-400 hover:text-brand-300">{t(locale, "Go to Projects", "Vai ai progetti")}</Link>
              </div>
              <div className="overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/20">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50 border-b border-zinc-800">
                      <tr>
                        <th className="px-4 py-3 font-medium">{t(locale, "Name", "Nome")}</th>
                        <th className="px-4 py-3 font-medium">{t(locale, "Customer", "Cliente")}</th>
                        <th className="px-4 py-3 font-medium text-right">{t(locale, "Hours", "Ore")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {(projects ?? []).slice(0, 5).length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">{t(locale, "No projects yet.", "Nessun progetto ancora.")}</td>
                        </tr>
                      ) : (
                        (projects ?? []).slice(0, 5).map((project) => (
                          <tr key={project.id} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-zinc-200">{project.name}</td>
                            <td className="px-4 py-3 text-zinc-400">{(project.profiles as { full_name?: string } | null)?.full_name || t(locale, "Unknown", "Sconosciuto")}</td>
                            <td className="px-4 py-3 text-right text-zinc-300">{Number(project.assigned_hours).toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="glass-card rounded-2xl p-6 border border-zinc-800">
              <h2 className="text-xl font-semibold text-white mb-4">{t(locale, "Team Snapshot", "Panoramica team")}</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                  <span className="text-zinc-400">{t(locale, "Admins", "Amministratori")}</span>
                  <span className="font-semibold text-white">{admins?.length ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                  <span className="text-zinc-400">{t(locale, "Customers", "Clienti")}</span>
                  <span className="font-semibold text-white">{customers?.length ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                  <span className="text-zinc-400">{t(locale, "Workers", "Operatori")}</span>
                  <span className="font-semibold text-white">{workers?.length ?? 0}</span>
                </div>
                <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-300">
                  {pendingInvitations.length} {t(locale, pendingInvitations.length === 1 ? "pending invitation" : "pending invitations", pendingInvitations.length === 1 ? "invito in attesa" : "inviti in attesa")}
                </div>
              </div>
              <Link href="/admin?tab=users" className="mt-4 inline-block text-sm text-brand-400 hover:text-brand-300">
                {t(locale, "Review users and invitations", "Controlla utenti e inviti")} →
              </Link>
            </section>
          </div>
        </section>
      )}

      {activeTab === "projects" && (
        <section className="space-y-6">
          <section className="glass-card rounded-2xl p-6 border border-zinc-800">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white">{t(locale, "Create Project", "Crea progetto")}</h2>
              <p className="text-sm text-zinc-400 mt-1">{t(locale, "Create a project and assign workers in one step.", "Crea un progetto e assegna operatori in un unico passaggio.")}</p>
            </div>

            <form action={createProjectAction} className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <div className="space-y-1.5">
                  <label htmlFor="name" className="text-sm font-medium text-zinc-300">{t(locale, "Project Name", "Nome progetto")}</label>
                  <input id="name" name="name" placeholder={t(locale, "Enter project name", "Inserisci nome progetto")} required className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="customerId" className="text-sm font-medium text-zinc-300">{t(locale, "Customer", "Cliente")}</label>
                    <select id="customerId" name="customerId" required className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all appearance-none">
                      <option value="" className="bg-zinc-900">{t(locale, "Select customer", "Seleziona cliente")}</option>
                      {(customers ?? []).map((customer) => (
                        <option key={customer.id} value={customer.id} className="bg-zinc-900">
                          {customer.full_name || customer.id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="assignedHours" className="text-sm font-medium text-zinc-300">{t(locale, "Assigned Hours", "Ore assegnate")}</label>
                    <input
                      id="assignedHours"
                      name="assignedHours"
                      type="number"
                      min="0"
                      step="0.25"
                      required
                      placeholder={t(locale, "e.g. 40", "es. 40")}
                      className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="description" className="text-sm font-medium text-zinc-300">{t(locale, "Description (Optional)", "Descrizione (opzionale)")}</label>
                  <textarea
                    id="description"
                    name="description"
                    rows={4}
                    placeholder={t(locale, "Brief project description", "Breve descrizione del progetto")}
                    className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all resize-none"
                  />
                </div>
              </div>

              <aside className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                <label htmlFor="workerIds" className="text-sm font-medium text-zinc-300">{t(locale, "Assign Workers (Optional)", "Assegna operatori (opzionale)")}</label>
                <p className="text-xs text-zinc-500 mt-1 mb-3">{t(locale, "Hold Ctrl/Cmd to pick multiple workers.", "Tieni premuto Ctrl/Cmd per selezionare più operatori.")}</p>
                <select
                  id="workerIds"
                  name="workerIds"
                  multiple
                  className="w-full min-h-48 rounded-lg bg-zinc-900/50 border border-zinc-800 px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                >
                  {(workers ?? []).map((worker) => (
                    <option key={worker.id} value={worker.id} className="bg-zinc-900 py-1">
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

          <section className="glass-card rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center justify-between mb-6">
               <h2 className="text-xl font-semibold text-white">{t(locale, "Active Projects", "Progetti attivi")}</h2>
               <span className="bg-blue-500/10 text-blue-400 text-xs font-bold px-2 py-1 rounded-md">{projects?.length || 0} {t(locale, "Total", "Totale")}</span>
             </div>

            <div className="overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/20">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50 border-b border-zinc-800">
                    <tr>
                       <th className="px-4 py-3 font-medium">{t(locale, "Name", "Nome")}</th>
                       <th className="px-4 py-3 font-medium">{t(locale, "Customer", "Cliente")}</th>
                       <th className="px-4 py-3 font-medium text-right">{t(locale, "Hours", "Ore")}</th>
                       <th className="px-4 py-3 font-medium text-right">{t(locale, "Actions", "Azioni")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {(projects ?? []).length === 0 ? (
                      <tr>
                         <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">{t(locale, "No projects found. Create one above.", "Nessun progetto trovato. Creane uno sopra.")}</td>
                      </tr>
                    ) : (
                      (projects ?? []).map((project) => (
                        <tr key={project.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-zinc-200">{project.name}</td>
                          <td className="px-4 py-3 text-zinc-400">{(project.profiles as { full_name?: string } | null)?.full_name || t(locale, "Unknown", "Sconosciuto")}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                              {Number(project.assigned_hours).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/admin?tab=projects&editProjectId=${project.id}`}
                                className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800/70 transition-colors"
                              >
                                 {t(locale, "Edit", "Modifica")}
                               </Link>
                              <Link
                                href={`/admin?tab=projects&deleteProjectId=${project.id}`}
                                className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/10 transition-colors"
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
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
                     <h3 className="text-lg font-semibold text-white">{t(locale, "Edit Project", "Modifica progetto")}</h3>
                    <Link href="/admin?tab=projects" className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800/70 transition-colors">
                       {t(locale, "Close", "Chiudi")}
                    </Link>
                  </div>

                  <form action={updateProjectAction} className="grid gap-4 p-5 md:grid-cols-2">
                    <input type="hidden" name="projectId" value={editingProject.id} />

                    <div className="space-y-1.5 md:col-span-2">
                       <label htmlFor="modal-project-name" className="text-sm font-medium text-zinc-300">{t(locale, "Name", "Nome")}</label>
                      <input
                        id="modal-project-name"
                        name="name"
                        defaultValue={editingProject.name}
                        required
                        className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                       <label htmlFor="modal-project-customer" className="text-sm font-medium text-zinc-300">{t(locale, "Customer", "Cliente")}</label>
                      <select
                        id="modal-project-customer"
                        name="customerId"
                        required
                        defaultValue={editingProject.customer_id}
                        className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                      >
                        {(customers ?? []).map((customer) => (
                          <option key={customer.id} value={customer.id} className="bg-zinc-900">
                            {customer.full_name || customer.id}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                       <label htmlFor="modal-project-description" className="text-sm font-medium text-zinc-300">{t(locale, "Description", "Descrizione")}</label>
                      <textarea
                        id="modal-project-description"
                        name="description"
                        defaultValue={editingProject.description ?? ""}
                        rows={4}
                        className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all resize-none"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                       <label htmlFor="modal-worker-ids" className="text-sm font-medium text-zinc-300">{t(locale, "Assigned Workers (Optional)", "Operatori assegnati (opzionale)")}</label>
                       <p className="text-xs text-zinc-500">{t(locale, "Hold Ctrl/Cmd to select multiple workers.", "Tieni premuto Ctrl/Cmd per selezionare più operatori.")}</p>
                      <select
                        id="modal-worker-ids"
                        name="workerIds"
                        multiple
                        defaultValue={editingProjectWorkerIds}
                        className="w-full min-h-40 rounded-lg bg-zinc-900/50 border border-zinc-800 px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                      >
                        {(workers ?? []).map((worker) => (
                          <option key={worker.id} value={worker.id} className="bg-zinc-900 py-1">
                            {worker.full_name || worker.id}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2 flex items-center justify-end gap-2">
                      <Link href="/admin?tab=projects" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/70 transition-colors">
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
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
                  <div className="border-b border-zinc-800 px-5 py-4">
                     <h3 className="text-lg font-semibold text-white">{t(locale, "Confirm Deletion", "Conferma eliminazione")}</h3>
                  </div>

                  <div className="space-y-4 px-5 py-4">
                    <p className="text-sm text-zinc-300">
                       {t(locale, "Are you sure you want to delete", "Sei sicuro di voler eliminare")} <span className="font-semibold text-white">{deletingProject.name}</span>? {t(locale, "This action cannot be undone.", "Questa azione non può essere annullata.")}
                    </p>

                    <div className="flex items-center justify-end gap-2">
                      <Link href="/admin?tab=projects" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/70 transition-colors">
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
            <article className="glass-card rounded-2xl p-5 border border-zinc-800">
               <p className="text-xs uppercase tracking-wider text-zinc-500">{t(locale, "Admins", "Amministratori")}</p>
              <p className="text-3xl font-bold text-white mt-2">{admins?.length ?? 0}</p>
            </article>
            <article className="glass-card rounded-2xl p-5 border border-zinc-800">
               <p className="text-xs uppercase tracking-wider text-zinc-500">{t(locale, "Customers", "Clienti")}</p>
              <p className="text-3xl font-bold text-white mt-2">{customers?.length ?? 0}</p>
            </article>
            <article className="glass-card rounded-2xl p-5 border border-zinc-800">
               <p className="text-xs uppercase tracking-wider text-zinc-500">{t(locale, "Workers", "Operatori")}</p>
              <p className="text-3xl font-bold text-white mt-2">{workers?.length ?? 0}</p>
            </article>
          </div>

          <section className="glass-card rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center justify-between mb-6">
               <h2 className="text-xl font-semibold text-white">{t(locale, "Customer Hourly Rates", "Tariffe orarie clienti")}</h2>
               <span className="bg-blue-500/10 text-blue-400 text-xs font-bold px-2 py-1 rounded-md">{t(locale, "Stripe Refill Pricing", "Prezzi ricarica Stripe")}</span>
             </div>

            <div className="overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/20 mb-8">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50 border-b border-zinc-800">
                    <tr>
                       <th className="px-4 py-3 font-medium">{t(locale, "Customer", "Cliente")}</th>
                       <th className="px-4 py-3 font-medium">{t(locale, "Custom Rate (USD/hour)", "Tariffa personalizzata (USD/ora)")}</th>
                       <th className="px-4 py-3 font-medium text-right">{t(locale, "Action", "Azione")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {(customers ?? []).length === 0 ? (
                      <tr>
                         <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">{t(locale, "No customers found.", "Nessun cliente trovato.")}</td>
                      </tr>
                    ) : (
                      (customers ?? []).map((customer) => {
                        const hourlyRateCents = (customer as { custom_hourly_rate_cents?: number | null }).custom_hourly_rate_cents;
                        const customHourlyRate = hourlyRateCents != null ? (hourlyRateCents / 100).toFixed(2) : "";

                        return (
                          <tr key={customer.id} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-medium text-zinc-200">{customer.full_name || customer.id}</span>
                                <span className="text-xs text-zinc-500">{customer.id}</span>
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
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                                  <input
                                    name="customHourlyRate"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    defaultValue={customHourlyRate}
                                     placeholder={t(locale, "Default", "Predefinito")}
                                    className="w-40 rounded-lg bg-zinc-900/50 border border-zinc-700 pl-7 pr-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                                  />
                                </div>
                                 <span className="text-xs text-zinc-500">{t(locale, "Leave empty = global default", "Lascia vuoto = valore globale")}</span>
                              </form>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="submit"
                                form={`customer-hourly-rate-${customer.id}`}
                                className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800/70 transition-colors"
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

             <h2 className="text-xl font-semibold text-white mb-6">{t(locale, "Invite User", "Invita utente")}</h2>
             <form action={inviteUserAction} className="grid gap-4 sm:grid-cols-2">
               <div className="space-y-1.5 sm:col-span-2">
                 <label htmlFor="invite-email" className="text-sm font-medium text-zinc-300">{t(locale, "Email Address", "Indirizzo email")}</label>
                <input
                  id="invite-email"
                  name="email"
                  type="email"
                  required
                   placeholder={t(locale, "user@example.com", "utente@esempio.com")}
                  className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="space-y-1.5">
                 <label htmlFor="fullName" className="text-sm font-medium text-zinc-300">{t(locale, "Full Name", "Nome completo")}</label>
                <input
                  id="fullName"
                  name="fullName"
                   placeholder={t(locale, "John Doe", "Mario Rossi")}
                  className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="space-y-1.5">
                 <label htmlFor="role" className="text-sm font-medium text-zinc-300">{t(locale, "Role", "Ruolo")}</label>
                <select id="role" name="role" className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all appearance-none">
                  <option value="worker" className="bg-zinc-900">{t(locale, "Worker", "Operatore")}</option>
                  <option value="customer" className="bg-zinc-900">{t(locale, "Customer", "Cliente")}</option>
                  <option value="admin" className="bg-zinc-900">{t(locale, "Admin", "Amministratore")}</option>
                </select>
              </div>

              <div className="sm:col-span-2 mt-2">
                <button className="w-full rounded-lg bg-zinc-800 px-4 py-3 font-medium text-white transition-all hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600">
                  {t(locale, "Send Invitation", "Invia invito")}
                </button>
              </div>
            </form>
          </section>

          <section className="glass-card rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center justify-between mb-6">
               <h2 className="text-xl font-semibold text-white">{t(locale, "Pending Invitations", "Inviti in attesa")}</h2>
               <span className="bg-amber-500/10 text-amber-400 text-xs font-bold px-2 py-1 rounded-md">{pendingInvitations.length} {t(locale, "Pending", "In attesa")}</span>
             </div>

            <div className="overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/20">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50 border-b border-zinc-800">
                    <tr>
                       <th className="px-4 py-3 font-medium">{t(locale, "User", "Utente")}</th>
                       <th className="px-4 py-3 font-medium">{t(locale, "Role", "Ruolo")}</th>
                       <th className="px-4 py-3 font-medium text-right">{t(locale, "Status", "Stato")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {(invitations ?? []).length === 0 ? (
                      <tr>
                         <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">{t(locale, "No invitations found.", "Nessun invito trovato.")}</td>
                      </tr>
                    ) : (
                      (invitations ?? []).map((invite) => (
                        <tr key={invite.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                               <span className="font-medium text-zinc-200">{invite.full_name || t(locale, "No name", "Senza nome")}</span>
                              <span className="text-xs text-zinc-500">{invite.email}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                              invite.role === "admin"
                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                : invite.role === "worker"
                                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                  : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            }`}>
                              {invite.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {invite.accepted_at ? (
                              <span className="inline-flex items-center gap-1.5 text-zinc-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
                                 {t(locale, "Accepted", "Accettato")}
                               </span>
                             ) : (
                               <span className="inline-flex items-center gap-1.5 text-amber-400">
                                 <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                 {t(locale, "Pending", "In attesa")}
                               </span>
                             )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </section>
      )}
    </main>
  );
}
