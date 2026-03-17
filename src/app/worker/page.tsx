import { createManualTimeEntryAction, deleteTimeEntryAction, startTimerAction, stopTimerAction, updateTimeEntryAction } from "@/app/actions/time-entries";
import { LogoutButton } from "@/components/logout-button";
import Link from "next/link";
import { TimerCard } from "@/components/worker/timer-card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLocale, localeTag, t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface WorkerProjectRow {
  project_id: string;
  projects: {
    id: string;
    name: string;
  } | null;
}

interface TimeEntryRow {
  id: string;
  project_id: string;
  started_at: string;
  ended_at: string | null;
  description: string | null;
  source: "timer" | "manual";
  projects: {
    name: string;
  } | null;
}

function formatForDatetimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - offset);
  return local.toISOString().slice(0, 16);
}

export default async function WorkerPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string; from?: string; to?: string; editTimeEntryId?: string; deleteTimeEntryId?: string }> | { projectId?: string; from?: string; to?: string; editTimeEntryId?: string; deleteTimeEntryId?: string };
}) {
  const locale = await getLocale();
  const tag = localeTag(locale);
  const profile = await requireRole(["worker"]);
  const supabase = await createClient();

  const params = await Promise.resolve(searchParams ?? {});
  const projectIdFilter = params.projectId?.trim();
  const fromParam = params.from?.trim();
  const toParam = params.to?.trim();
  const editTimeEntryIdParam = params.editTimeEntryId;
  const deleteTimeEntryIdParam = params.deleteTimeEntryId;

  const fromDate = fromParam ? new Date(fromParam) : null;
  const toDate = toParam ? new Date(toParam) : null;
  const validFromDate = fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : null;
  const validToDate = toDate && !Number.isNaN(toDate.getTime()) ? toDate : null;

  let timeEntriesQuery = supabase
    .from("time_entries")
    .select("id,project_id,started_at,ended_at,description,source,projects(name)")
    .eq("worker_id", profile.id)
    .order("started_at", { ascending: false });

  if (projectIdFilter) {
    timeEntriesQuery = timeEntriesQuery.eq("project_id", projectIdFilter);
  }

  if (validFromDate) {
    timeEntriesQuery = timeEntriesQuery.gte("started_at", validFromDate.toISOString());
  }

  if (validToDate) {
    timeEntriesQuery = timeEntriesQuery.lte("started_at", validToDate.toISOString());
  }

  const [
    { data: assignedRows },
    { data: timeEntries },
    { data: runningFromDb },
    { data: editingEntryFromDb },
    { data: deletingEntryFromDb },
  ] = await Promise.all([
    supabase
      .from("project_workers")
      .select("project_id,projects(id,name)")
      .eq("worker_id", profile.id),
    timeEntriesQuery.limit(20),
    supabase
      .from("time_entries")
      .select("id,project_id,started_at,ended_at,description,source,projects(name)")
      .eq("worker_id", profile.id)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle<TimeEntryRow>(),
      editTimeEntryIdParam
      ? supabase
          .from("time_entries")
          .select("id,project_id,started_at,ended_at,description,source,projects(name)")
          .eq("worker_id", profile.id)
          .eq("id", editTimeEntryIdParam)
          .maybeSingle<TimeEntryRow>()
      : Promise.resolve({ data: null }),
      deleteTimeEntryIdParam
      ? supabase
          .from("time_entries")
          .select("id,project_id,started_at,ended_at,description,source,projects(name)")
          .eq("worker_id", profile.id)
          .eq("id", deleteTimeEntryIdParam)
          .maybeSingle<TimeEntryRow>()
      : Promise.resolve({ data: null }),
  ]);

  const assignedProjects = (assignedRows ?? []) as unknown as WorkerProjectRow[];
  const entries = (timeEntries ?? []) as unknown as TimeEntryRow[];
  const running = runningFromDb;

  const activeFilterProjectIds = new Set(assignedProjects.map((row) => row.project_id));

  const baseFilterParams = {
    ...(projectIdFilter ? { projectId: projectIdFilter } : {}),
    ...(fromParam ? { from: fromParam } : {}),
    ...(toParam ? { to: toParam } : {}),
  };

  const withBaseFilterParams = (extra: Partial<Record<string, string>>) => {
    const merged = { ...baseFilterParams, ...extra };
    const query = new URLSearchParams(merged);
    const suffix = query.toString();
    return suffix ? `/worker?${suffix}` : "/worker";
  };

  const noDateText = formatForDatetimeLocal(new Date().toISOString());
  const fromInputValue = validFromDate ? formatForDatetimeLocal(validFromDate.toISOString()) : "";
  const toInputValue = validToDate ? formatForDatetimeLocal(validToDate.toISOString()) : "";
  const editingTimeEntry = (editingEntryFromDb ?? null) as TimeEntryRow | null;
  const deletingTimeEntry = (deletingEntryFromDb ?? null) as TimeEntryRow | null;
  const activeEditEntry = editingTimeEntry && !editingTimeEntry.ended_at ? null : editingTimeEntry;
  const activeDeleteEntry = deletingTimeEntry && !deletingTimeEntry.ended_at ? null : deletingTimeEntry;

  return (
    <main className="w-full">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span className="p-2 bg-green-500/10 text-green-500 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            {t(locale, "Worker Station", "Postazione operatore")}
          </h1>
          <p className="text-zinc-400 mt-1">{t(locale, "Track your time, manage active sessions, and log hours.", "Monitora il tuo tempo, gestisci le sessioni attive e registra le ore.")}</p>
        </div>
        <LogoutButton />
      </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 space-y-6">
          {running ? (
            <section className="glass-card rounded-2xl p-6 md:p-8 border border-brand-500/30 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand-400 to-purple-500"></div>
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center justify-between">
                <div className="flex-1 w-full">
                  <h2 className="text-sm font-medium text-brand-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse"></span>
                    {t(locale, "Active Timer", "Timer attivo")}
                  </h2>
                  <TimerCard
                    startedAt={running.started_at}
                    projectName={running.projects?.name || t(locale, "Unknown project", "Progetto sconosciuto")}
                    description={running.description}
                    elapsedLabel={t(locale, "elapsed", "trascorso")}
                    noDescriptionLabel={t(locale, "No description provided", "Nessuna descrizione fornita")}
                  />
                </div>
                <form action={stopTimerAction} className="w-full md:w-auto shrink-0">
                  <input type="hidden" name="timeEntryId" value={running.id} />
                  <button className="w-full md:w-auto rounded-xl bg-red-500/10 text-red-500 px-6 py-4 font-bold transition-all hover:bg-red-500 hover:text-white border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.15)] hover:shadow-[0_0_30px_rgba(239,68,68,0.3)] flex items-center justify-center gap-2">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                    {t(locale, "Stop Timer", "Ferma timer")}
                  </button>
                </form>
              </div>
            </section>
          ) : (
            <section className="glass-card rounded-2xl p-6 md:p-8 border border-zinc-800">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t(locale, "Start New Timer", "Avvia nuovo timer")}
              </h2>
              <form action={startTimerAction} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label htmlFor="projectId" className="text-sm font-medium text-zinc-300">{t(locale, "Project", "Progetto")}</label>
                  <select id="projectId" name="projectId" required className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none">
                    <option value="" className="bg-zinc-900">{t(locale, "Select project to work on", "Seleziona un progetto su cui lavorare")}</option>
                    {assignedProjects.map((row) => (
                      <option key={row.project_id} value={row.project_id} className="bg-zinc-900">
                        {row.projects?.name || row.project_id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label htmlFor="description" className="text-sm font-medium text-zinc-300">{t(locale, "Task Description", "Descrizione attività")}</label>
                  <input
                    id="description"
                    name="description"
                    placeholder={t(locale, "What are you working on?", "Su cosa stai lavorando?")}
                    className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
                <div className="sm:col-span-2 mt-2">
                  <button className="w-full rounded-lg bg-emerald-600 px-4 py-4 font-bold text-white transition-all hover:bg-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-emerald-400/20 flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    {t(locale, "Start Timer", "Avvia timer")}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="glass-card rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                {t(locale, "Recent Activity", "Attività recenti")}
                </h2>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Link href="/worker" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800/70 transition-colors">
                    {t(locale, "Clear", "Pulisci")}
                  </Link>
                  <span className="text-xs text-zinc-500">{t(locale, "Showing", "Mostrando")}: {entries.length}</span>
                </div>
            </div>

            <form className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" method="GET">
              <div className="space-y-1.5">
                <label htmlFor="projectId" className="text-xs font-medium text-zinc-400">{t(locale, "Project", "Progetto")}</label>
                <select
                  id="projectId"
                  name="projectId"
                  defaultValue={projectIdFilter ?? ""}
                  className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all appearance-none"
                >
                  <option value="" className="bg-zinc-900">{t(locale, "All projects", "Tutti i progetti")}</option>
                  {assignedProjects.map((row) => (
                    <option key={row.project_id} value={row.project_id} className="bg-zinc-900">
                      {row.projects?.name || row.project_id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="from" className="text-xs font-medium text-zinc-400">{t(locale, "From", "Da")}</label>
                <input
                  id="from"
                  name="from"
                  type="datetime-local"
                  defaultValue={fromInputValue}
                  className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all [color-scheme:dark]"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="to" className="text-xs font-medium text-zinc-400">{t(locale, "To", "A")}</label>
                <input
                  id="to"
                  name="to"
                  type="datetime-local"
                  defaultValue={toInputValue}
                  min={fromInputValue || undefined}
                  max={noDateText}
                  className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all [color-scheme:dark]"
                />
              </div>
              <div className="space-y-1.5 lg:items-end flex lg:pt-6">
                <button className="w-full rounded-lg bg-zinc-800 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-zinc-700 hover:border-zinc-600 border border-zinc-700">
                  {t(locale, "Apply Filters", "Applica filtri")}
                </button>
              </div>
            </form>
            
            <div className="overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/20">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50 border-b border-zinc-800">
                    <tr>
                      <th className="px-4 py-3 font-medium">{t(locale, "Project", "Progetto")}</th>
                      <th className="px-4 py-3 font-medium">{t(locale, "Time Window", "Intervallo orario")}</th>
                      <th className="px-4 py-3 font-medium">{t(locale, "Type", "Tipo")}</th>
                      <th className="px-4 py-3 font-medium">{t(locale, "Description", "Descrizione")}</th>
                      <th className="px-4 py-3 font-medium text-right">{t(locale, "Actions", "Azioni")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {entries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">{t(locale, "No time entries recorded yet.", "Nessuna voce di tempo registrata.")}</td>
                      </tr>
                    ) : (
                      entries.map((entry) => {
                        const isRunning = !entry.ended_at;
                        const canModify = !isRunning;
                        return (
                          <tr key={entry.id} className={`hover:bg-zinc-800/30 transition-colors ${isRunning ? 'bg-brand-900/10' : ''}`}>
                            <td className="px-4 py-3 font-medium text-zinc-200">{entry.projects?.name || t(locale, "Unknown", "Sconosciuto")}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className="text-zinc-300">{new Date(entry.started_at).toLocaleTimeString(tag, {hour: '2-digit', minute:'2-digit'})}</span>
                                <span className="text-xs text-zinc-500">{new Date(entry.started_at).toLocaleDateString(tag)}</span>
                                <span className="text-zinc-600 text-xs mt-0.5">{t(locale, "to", "a")}</span>
                                {isRunning ? (
                                  <span className="inline-flex items-center gap-1.5 text-brand-400 text-xs font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
                                    {t(locale, "Running Now", "In corso")}
                                  </span>
                                ) : (
                                  <span className="text-zinc-400">
                                    {entry.ended_at ? new Date(entry.ended_at).toLocaleTimeString(tag, {hour: '2-digit', minute:'2-digit'}) : "-"}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                                entry.source === 'timer' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              }`}>
                                {entry.source === "timer" ? t(locale, "timer", "timer") : t(locale, "manual", "manuale")}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-zinc-400 max-w-xs truncate" title={entry.description || ""}>
                              {entry.description || <span className="text-zinc-600 italic">{t(locale, "No description", "Nessuna descrizione")}</span>}
                            </td>
                              <td className="px-4 py-3">
                                <div className="flex justify-end gap-2">
                                  {canModify ? (
                                    <Link
                                      href={withBaseFilterParams({ editTimeEntryId: entry.id })}
                                      className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800/70"
                                    >
                                      {t(locale, "Edit", "Modifica")}
                                    </Link>
                                  ) : (
                                    <span className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-600">
                                      {t(locale, "Edit", "Modifica")}
                                    </span>
                                  )}

                                  {canModify ? (
                                    <Link
                                      href={withBaseFilterParams({ deleteTimeEntryId: entry.id })}
                                      className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10"
                                    >
                                      {t(locale, "Delete", "Elimina")}
                                    </Link>
                                  ) : (
                                    <span className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-600">
                                      {t(locale, "Delete", "Elimina")}
                                    </span>
                                  )}
                                </div>
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
        </div>

        <div className="lg:col-span-1">
          <section className="glass-card rounded-2xl p-6 border border-zinc-800 sticky top-6">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {t(locale, "Manual Entry", "Inserimento manuale")}
            </h2>
            <form action={createManualTimeEntryAction} className="grid gap-4">
              <div className="space-y-1.5">
                <label htmlFor="manual-projectId" className="text-sm font-medium text-zinc-300">{t(locale, "Project", "Progetto")}</label>
                <select id="manual-projectId" name="projectId" required className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all appearance-none">
                  <option value="" className="bg-zinc-900">{t(locale, "Select project", "Seleziona progetto")}</option>
                  {assignedProjects.map((row) => (
                    <option key={row.project_id} value={row.project_id} className="bg-zinc-900">
                      {row.projects?.name || row.project_id}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="startedAt" className="text-xs font-medium text-zinc-400">{t(locale, "Start Time", "Ora inizio")}</label>
                  <input id="startedAt" name="startedAt" type="datetime-local" required className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-2.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all [color-scheme:dark]" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="endedAt" className="text-xs font-medium text-zinc-400">{t(locale, "End Time", "Ora fine")}</label>
                  <input id="endedAt" name="endedAt" type="datetime-local" required className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-2.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all [color-scheme:dark]" />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label htmlFor="manual-description" className="text-sm font-medium text-zinc-300">{t(locale, "Description", "Descrizione")}</label>
                <textarea
                  id="manual-description"
                  name="description"
                  placeholder={t(locale, "What did you do?", "Cosa hai fatto?")}
                  rows={3}
                  className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all resize-none"
                />
              </div>
              
              <button className="w-full rounded-lg bg-zinc-800 px-4 py-3 font-medium text-white transition-all hover:bg-zinc-700 hover:text-white border border-zinc-700 hover:border-zinc-600 mt-2">
                {t(locale, "Log Past Hours", "Registra ore passate")}
              </button>
            </form>
          </section>
        </div>

        {activeEditEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
                <h3 className="text-lg font-semibold text-white">{t(locale, "Edit Time Entry", "Modifica voce tempo")}</h3>
                <Link href={withBaseFilterParams({})} className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800/70 transition-colors">
                  {t(locale, "Close", "Chiudi")}
                </Link>
              </div>

              <form action={updateTimeEntryAction} className="grid gap-4 p-5 md:grid-cols-2">
                <input type="hidden" name="timeEntryId" value={activeEditEntry.id} />

                <div className="space-y-1.5 md:col-span-2">
                  <label htmlFor="modal-time-project" className="text-sm font-medium text-zinc-300">{t(locale, "Project", "Progetto")}</label>
                  <select
                    id="modal-time-project"
                    name="projectId"
                    required
                    defaultValue={activeEditEntry.project_id}
                    className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                  >
                    {assignedProjects.filter((row) => activeFilterProjectIds.has(row.project_id) || row.project_id === activeEditEntry.project_id).map((row) => (
                      <option key={row.project_id} value={row.project_id} className="bg-zinc-900">
                        {row.projects?.name || row.project_id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="modal-time-started" className="text-sm font-medium text-zinc-300">{t(locale, "Start Time", "Ora inizio")}</label>
                  <input
                    id="modal-time-started"
                    name="startedAt"
                    type="datetime-local"
                    required
                    defaultValue={formatForDatetimeLocal(activeEditEntry.started_at)}
                    className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all [color-scheme:dark]"
                    />
                  </div>

                <div className="space-y-1.5">
                  <label htmlFor="modal-time-ended" className="text-sm font-medium text-zinc-300">{t(locale, "End Time", "Ora fine")}</label>
                    <input
                      id="modal-time-ended"
                      name="endedAt"
                      type="datetime-local"
                      required
                      defaultValue={formatForDatetimeLocal(activeEditEntry.ended_at || noDateText)}
                      min={activeEditEntry.started_at ? formatForDatetimeLocal(activeEditEntry.started_at) : undefined}
                      max={noDateText}
                      className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all [color-scheme:dark]"
                    />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label htmlFor="modal-time-description" className="text-sm font-medium text-zinc-300">{t(locale, "Description", "Descrizione")}</label>
                  <textarea
                    id="modal-time-description"
                    name="description"
                    defaultValue={activeEditEntry.description ?? ""}
                    rows={4}
                    className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all resize-none"
                  />
                </div>

                <div className="md:col-span-2 flex items-center justify-end gap-2">
                  <Link href={withBaseFilterParams({})} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/70 transition-colors">
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

        {activeDeleteEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
              <div className="border-b border-zinc-800 px-5 py-4">
                <h3 className="text-lg font-semibold text-white">{t(locale, "Confirm Deletion", "Conferma eliminazione")}</h3>
              </div>

              <div className="space-y-4 px-5 py-4">
                <p className="text-sm text-zinc-300">
                  {t(locale, "Are you sure you want to delete", "Sei sicuro di voler eliminare")} <span className="font-semibold text-white">{activeDeleteEntry.projects?.name || activeDeleteEntry.project_id}</span>? {t(locale, "This action cannot be undone.", "Questa azione non può essere annullata.")}
                </p>

                <div className="flex items-center justify-end gap-2">
                  <Link href={withBaseFilterParams({})} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800/70 transition-colors">
                    {t(locale, "Cancel", "Annulla")}
                  </Link>
                  <form action={deleteTimeEntryAction}>
                    <input type="hidden" name="timeEntryId" value={activeDeleteEntry.id} />
                    <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors">
                      {t(locale, "Delete", "Elimina")}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
