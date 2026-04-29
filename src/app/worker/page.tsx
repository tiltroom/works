import { createManualTimeEntryAction, deleteTimeEntryAction, startTimerAction, stopTimerAction, updateTimeEntryAction } from "@/app/actions/time-entries";
import { EditTimeEntryModal } from "@/components/worker/edit-time-entry-modal";
import { WorkerQueryToast } from "@/components/worker/worker-query-toast";
import { ModalActionForm } from "@/components/ui/modal-action-form";
import { LogoutButton } from "@/components/logout-button";
import Link from "next/link";
import { TimerCard } from "@/components/worker/timer-card";
import { ViewportModal, ViewportModalPanel } from "@/components/ui/viewport-modal";
import { StopTimerButton } from "@/components/worker/stop-timer-button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { localeTag, t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

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

interface LinkedQuoteRow {
  id: string;
  title: string;
  linked_project_id: string | null;
}

interface QuoteSubtaskRow {
  id: string;
  quote_id: string;
  title: string;
}

function formatForDatetimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - offset);
  return local.toISOString().slice(0, 16);
}

const panelClass = "rounded-2xl border border-border bg-card/80 backdrop-blur-sm";
const tableShellClass = "overflow-hidden rounded-xl border border-border/70 bg-background/45";
const tableHeadClass = "border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground";
const tableRowClass = "transition-colors hover:bg-accent/60";
const inputClass = "w-full rounded-lg border border-input bg-background/75 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all";
const compactInputClass = "w-full rounded-lg border border-input bg-background/75 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all";

export default async function WorkerPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string; from?: string; to?: string; editTimeEntryId?: string; deleteTimeEntryId?: string; toast?: string; toastMessage?: string }> | { projectId?: string; from?: string; to?: string; editTimeEntryId?: string; deleteTimeEntryId?: string; toast?: string; toastMessage?: string };
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
  const toastTypeParam = params.toast?.trim();
  const toastMessageParam = params.toastMessage?.trim();

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
  const assignedProjectIds = assignedProjects.map((row) => row.project_id);
  const { data: linkedQuotesForProjects } = assignedProjectIds.length > 0
    ? await supabase
        .from("quotes")
        .select("id,title,linked_project_id")
        .in("linked_project_id", assignedProjectIds)
    : { data: [] };
  const linkedQuotes = (linkedQuotesForProjects ?? []) as LinkedQuoteRow[];
  const linkedQuoteIds = linkedQuotes.map((quote) => quote.id);
  const { data: quoteSubtasksForProjects } = linkedQuoteIds.length > 0
    ? await supabase
        .from("quote_subtasks")
        .select("id,quote_id,title")
        .in("quote_id", linkedQuoteIds)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
    : { data: [] };
  const quoteProjectIdByQuoteId = new Map(linkedQuotes.map((quote) => [quote.id, quote.linked_project_id]));
  const subtaskOptionsByProjectId = new Map<string, QuoteSubtaskRow[]>();

  for (const subtask of (quoteSubtasksForProjects ?? []) as QuoteSubtaskRow[]) {
    const subtaskProjectId = quoteProjectIdByQuoteId.get(subtask.quote_id);
    if (!subtaskProjectId) {
      continue;
    }

    const subtasksForProject = subtaskOptionsByProjectId.get(subtaskProjectId) ?? [];
    subtasksForProject.push(subtask);
    subtaskOptionsByProjectId.set(subtaskProjectId, subtasksForProject);
  }

  const hasQuoteSubtaskOptions = subtaskOptionsByProjectId.size > 0;

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
  const toastVariant: "success" | "error" | null = toastTypeParam === "success"
    ? "success"
    : toastTypeParam === "error"
      ? "error"
      : null;
  const activeToast = toastVariant && toastMessageParam
    ? { variant: toastVariant, message: toastMessageParam }
    : null;
  const editProjectOptions = activeEditEntry
    ? assignedProjects
        .filter((row) => activeFilterProjectIds.has(row.project_id) || row.project_id === activeEditEntry.project_id)
        .map((row) => ({ id: row.project_id, name: row.projects?.name || row.project_id }))
    : [];

  return (
    <main className="w-full">
      {activeToast && (
        <WorkerQueryToast
          variant={activeToast.variant}
          message={activeToast.message}
          closeLabel={t(locale, "Close", "Chiudi")}
        />
      )}

      <header className="mb-8 flex flex-col justify-between gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
            <span className="p-2 bg-green-500/10 text-green-500 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            {t(locale, "Worker Station", "Postazione operatore")}
          </h1>
          <p className="mt-1 text-muted-foreground">{t(locale, "Track your time, manage active sessions, and log hours.", "Monitora il tuo tempo, gestisci le sessioni attive e registra le ore.")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/worker/quotes" className="rounded-lg border border-brand-500/30 bg-brand-500/10 px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-500/20 dark:text-brand-300">
            {t(locale, "Quotes", "Preventivi")}
          </Link>
          <LogoutButton />
        </div>
      </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 space-y-6">
          {running ? (
            <section className="relative overflow-hidden rounded-2xl border border-brand-500/30 bg-card/85 p-6 backdrop-blur-sm md:p-8">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand-400 to-purple-500"></div>
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center justify-between">
                <div className="flex-1 w-full">
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-brand-600 dark:text-brand-400">
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
                <div className="w-full md:w-auto shrink-0">
                  <StopTimerButton
                    timeEntryId={running.id}
                    stopTimerAction={stopTimerAction}
                    labels={{
                      stopTimer: t(locale, "Stop Timer", "Ferma timer"),
                      errorTitle: t(locale, "Error Stopping Timer", "Errore durante l'arresto del timer"),
                      close: t(locale, "Close", "Chiudi"),
                    }}
                  />
                </div>
              </div>
            </section>
          ) : (
            <section className={`${panelClass} p-6 md:p-8`}>
              <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold text-foreground">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t(locale, "Start New Timer", "Avvia nuovo timer")}
              </h2>
              <form action={startTimerAction} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label htmlFor="projectId" className="text-sm font-medium text-foreground">{t(locale, "Project", "Progetto")}</label>
                  <select id="projectId" name="projectId" required className={`${inputClass} appearance-none focus:ring-emerald-500`}>
                    <option value="" className="bg-background text-foreground">{t(locale, "Select project to work on", "Seleziona un progetto su cui lavorare")}</option>
                    {assignedProjects.map((row) => (
                      <option key={row.project_id} value={row.project_id} className="bg-background text-foreground">
                        {row.projects?.name || row.project_id}
                      </option>
                    ))}
                  </select>
                </div>
                {hasQuoteSubtaskOptions ? (
                  <div className="space-y-1.5 sm:col-span-2">
                    <label htmlFor="quoteSubtaskId" className="text-sm font-medium text-foreground">{t(locale, "Quote subtask", "Sottoattività preventivo")}</label>
                    <select id="quoteSubtaskId" name="quoteSubtaskId" className={`${inputClass} appearance-none focus:ring-emerald-500`}>
                      <option value="" className="bg-background text-foreground">{t(locale, "Optional: select an activity", "Opzionale: seleziona un'attività")}</option>
                      {assignedProjects.map((row) => {
                        const subtaskOptions = subtaskOptionsByProjectId.get(row.project_id) ?? [];
                        if (subtaskOptions.length === 0) {
                          return null;
                        }

                        return (
                          <optgroup key={row.project_id} label={row.projects?.name || row.project_id}>
                            {subtaskOptions.map((subtask) => (
                              <option key={subtask.id} value={subtask.id} className="bg-background text-foreground">
                                {subtask.title}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                    <p className="text-xs text-muted-foreground">{t(locale, "Selecting a subtask keeps this timer aligned with the project quote breakdown.", "Selezionare una sottoattività mantiene questo timer allineato alla suddivisione del preventivo.")}</p>
                  </div>
                ) : null}
                <div className="space-y-1.5 sm:col-span-2">
                  <label htmlFor="description" className="text-sm font-medium text-foreground">{t(locale, "Task Description", "Descrizione attività")}</label>
                  <input
                    id="description"
                    name="description"
                    placeholder={t(locale, "What are you working on?", "Su cosa stai lavorando?")}
                    className={`${inputClass} focus:ring-emerald-500`}
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

          <section className={`${panelClass} p-6`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-foreground">{t(locale, "Assigned projects", "Progetti assegnati")}</h2>
              <span className="text-xs text-muted-foreground">{assignedProjects.length} {t(locale, assignedProjects.length === 1 ? "project" : "projects", assignedProjects.length === 1 ? "progetto" : "progetti")}</span>
            </div>
            <div className="space-y-3">
              {assignedProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t(locale, "No assigned projects yet.", "Nessun progetto assegnato ancora.")}</p>
              ) : (
                assignedProjects.map((row) => (
                  <div key={row.project_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/60 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{row.projects?.name || row.project_id}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t(locale, "Open the dedicated detail view and live project discussion.", "Apri la vista di dettaglio dedicata e la discussione live del progetto.")}</p>
                    </div>
                    <Link href={`/worker/projects/${row.project_id}`} className="rounded-lg border border-border bg-background/70 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                      {t(locale, "Open detail", "Apri dettaglio")}
                    </Link>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className={`${panelClass} p-6`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
                <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                {t(locale, "Recent Activity", "Attività recenti")}
                </h2>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Link href="/worker" className="rounded-lg border border-border bg-background/60 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                    {t(locale, "Clear", "Pulisci")}
                  </Link>
                  <span className="text-xs text-muted-foreground">{t(locale, "Showing", "Mostrando")}: {entries.length}</span>
                </div>
            </div>

            <form className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" method="GET">
              <div className="space-y-1.5">
                <label htmlFor="projectId" className="text-xs font-medium text-muted-foreground">{t(locale, "Project", "Progetto")}</label>
                <select
                  id="projectId"
                  name="projectId"
                  defaultValue={projectIdFilter ?? ""}
                  className={`${compactInputClass} appearance-none`}
                >
                  <option value="" className="bg-background text-foreground">{t(locale, "All projects", "Tutti i progetti")}</option>
                  {assignedProjects.map((row) => (
                    <option key={row.project_id} value={row.project_id} className="bg-background text-foreground">
                      {row.projects?.name || row.project_id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="from" className="text-xs font-medium text-muted-foreground">{t(locale, "From", "Da")}</label>
                <input
                  id="from"
                  name="from"
                  type="datetime-local"
                  defaultValue={fromInputValue}
                  className={compactInputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="to" className="text-xs font-medium text-muted-foreground">{t(locale, "To", "A")}</label>
                <input
                  id="to"
                  name="to"
                  type="datetime-local"
                  defaultValue={toInputValue}
                  min={fromInputValue || undefined}
                  max={noDateText}
                  className={compactInputClass}
                />
              </div>
              <div className="space-y-1.5 lg:items-end flex lg:pt-6">
                <button className="w-full rounded-lg border border-border bg-background/70 px-4 py-2 text-xs font-medium text-foreground transition-all hover:bg-accent hover:text-accent-foreground">
                  {t(locale, "Apply Filters", "Applica filtri")}
                </button>
              </div>
            </form>
            
            <div className={tableShellClass}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className="px-4 py-3 font-medium">{t(locale, "Project", "Progetto")}</th>
                      <th className="px-4 py-3 font-medium">{t(locale, "Time Window", "Intervallo orario")}</th>
                      <th className="px-4 py-3 font-medium">{t(locale, "Type", "Tipo")}</th>
                      <th className="px-4 py-3 font-medium">{t(locale, "Description", "Descrizione")}</th>
                      <th className="px-4 py-3 font-medium text-right">{t(locale, "Actions", "Azioni")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {entries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t(locale, "No time entries recorded yet.", "Nessuna voce di tempo registrata.")}</td>
                      </tr>
                    ) : (
                      entries.map((entry) => {
                        const isRunning = !entry.ended_at;
                        const canModify = !isRunning;
                        return (
                          <tr key={entry.id} className={`${tableRowClass} ${isRunning ? 'bg-brand-500/10' : ''}`}>
                            <td className="px-4 py-3 font-medium text-foreground">{entry.projects?.name || t(locale, "Unknown", "Sconosciuto")}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className="text-foreground/90">{new Date(entry.started_at).toLocaleTimeString(tag, {hour: '2-digit', minute:'2-digit'})}</span>
                                <span className="text-xs text-muted-foreground">{new Date(entry.started_at).toLocaleDateString(tag)}</span>
                                <span className="mt-0.5 text-xs text-muted-foreground/80">{t(locale, "to", "a")}</span>
                                {isRunning ? (
                                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
                                    {t(locale, "Running Now", "In corso")}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    {entry.ended_at ? new Date(entry.ended_at).toLocaleTimeString(tag, {hour: '2-digit', minute:'2-digit'}) : "-"}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                                entry.source === 'timer' ? 'border border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'border border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300'
                              }`}>
                                {entry.source === "timer" ? t(locale, "timer", "timer") : t(locale, "manual", "manuale")}
                              </span>
                            </td>
                            <td className="max-w-xs truncate px-4 py-3 text-muted-foreground" title={entry.description || ""}>
                              {entry.description || <span className="italic text-muted-foreground/80">{t(locale, "No description", "Nessuna descrizione")}</span>}
                            </td>
                              <td className="px-4 py-3">
                                <div className="flex justify-end gap-2">
                                  {canModify ? (
                                    <Link
                                      href={withBaseFilterParams({ editTimeEntryId: entry.id })}
                                      className="rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                                    >
                                      {t(locale, "Edit", "Modifica")}
                                    </Link>
                                  ) : (
                                    <span className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground/70">
                                      {t(locale, "Edit", "Modifica")}
                                    </span>
                                  )}

                                  {canModify ? (
                                    <Link
                                      href={withBaseFilterParams({ deleteTimeEntryId: entry.id })}
                                      className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-500/10 dark:text-red-300"
                                    >
                                      {t(locale, "Delete", "Elimina")}
                                    </Link>
                                  ) : (
                                    <span className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground/70">
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
          <section className={`sticky top-6 ${panelClass} p-6`}>
            <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-foreground">
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {t(locale, "Manual Entry", "Inserimento manuale")}
            </h2>
            <form action={createManualTimeEntryAction} className="grid gap-4">
              <div className="space-y-1.5">
                <label htmlFor="manual-projectId" className="text-sm font-medium text-foreground">{t(locale, "Project", "Progetto")}</label>
                <select id="manual-projectId" name="projectId" required className={`${compactInputClass} appearance-none focus:ring-amber-500`}>
                  <option value="" className="bg-background text-foreground">{t(locale, "Select project", "Seleziona progetto")}</option>
                  {assignedProjects.map((row) => (
                    <option key={row.project_id} value={row.project_id} className="bg-background text-foreground">
                      {row.projects?.name || row.project_id}
                    </option>
                  ))}
                </select>
              </div>
              {hasQuoteSubtaskOptions ? (
                <div className="space-y-1.5">
                  <label htmlFor="manual-quoteSubtaskId" className="text-sm font-medium text-foreground">{t(locale, "Quote subtask", "Sottoattività preventivo")}</label>
                  <select id="manual-quoteSubtaskId" name="quoteSubtaskId" className={`${compactInputClass} appearance-none focus:ring-amber-500`}>
                    <option value="" className="bg-background text-foreground">{t(locale, "Optional activity", "Attività opzionale")}</option>
                    {assignedProjects.map((row) => {
                      const subtaskOptions = subtaskOptionsByProjectId.get(row.project_id) ?? [];
                      if (subtaskOptions.length === 0) {
                        return null;
                      }

                      return (
                        <optgroup key={row.project_id} label={row.projects?.name || row.project_id}>
                          {subtaskOptions.map((subtask) => (
                            <option key={subtask.id} value={subtask.id} className="bg-background text-foreground">
                              {subtask.title}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
              ) : null}
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="startedAt" className="text-xs font-medium text-muted-foreground">{t(locale, "Start Time", "Ora inizio")}</label>
                   <input id="startedAt" name="startedAt" type="datetime-local" required className={`${compactInputClass} focus:ring-amber-500`} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="endedAt" className="text-xs font-medium text-muted-foreground">{t(locale, "End Time", "Ora fine")}</label>
                   <input id="endedAt" name="endedAt" type="datetime-local" required className={`${compactInputClass} focus:ring-amber-500`} />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label htmlFor="manual-description" className="text-sm font-medium text-foreground">{t(locale, "Description", "Descrizione")}</label>
                <textarea
                  id="manual-description"
                  name="description"
                  placeholder={t(locale, "What did you do?", "Cosa hai fatto?")}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-input bg-background/75 px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                />
              </div>
              
              <button className="mt-2 w-full rounded-lg border border-border bg-background/70 px-4 py-3 font-medium text-foreground transition-all hover:bg-accent hover:text-accent-foreground">
                {t(locale, "Log Past Hours", "Registra ore passate")}
              </button>
            </form>
          </section>
        </div>

        {activeEditEntry && (
          <EditTimeEntryModal
            timeEntryId={activeEditEntry.id}
            projectId={activeEditEntry.project_id}
            startedAt={formatForDatetimeLocal(activeEditEntry.started_at)}
            endedAt={formatForDatetimeLocal(activeEditEntry.ended_at || noDateText)}
            maxEndedAt={noDateText}
            description={activeEditEntry.description ?? ""}
            projectOptions={editProjectOptions}
            closeHref={withBaseFilterParams({})}
            successRedirectHref={withBaseFilterParams({})}
            updateTimeEntryAction={updateTimeEntryAction}
            labels={{
              title: t(locale, "Edit Time Entry", "Modifica voce tempo"),
              close: t(locale, "Close", "Chiudi"),
              cancel: t(locale, "Cancel", "Annulla"),
              saveChanges: t(locale, "Save Changes", "Salva modifiche"),
              saving: t(locale, "Saving...", "Salvataggio..."),
              project: t(locale, "Project", "Progetto"),
              startTime: t(locale, "Start Time", "Ora inizio"),
              endTime: t(locale, "End Time", "Ora fine"),
              description: t(locale, "Description", "Descrizione"),
              successMessage: t(locale, "Time entry updated successfully", "Voce tempo aggiornata con successo"),
              genericErrorMessage: t(locale, "An error occurred while updating the time entry.", "Si è verificato un errore durante l'aggiornamento della voce tempo."),
            }}
          />
        )}

        {activeDeleteEntry && (
          <ViewportModal>
            <ViewportModalPanel className="max-w-md">
              <div className="border-b border-border px-5 py-4">
                <h3 className="text-lg font-semibold text-foreground">{t(locale, "Confirm Deletion", "Conferma eliminazione")}</h3>
              </div>

              <div className="space-y-4 px-5 py-4">
                <p className="text-sm text-muted-foreground">
                  {t(locale, "Are you sure you want to delete", "Sei sicuro di voler eliminare")} <span className="font-semibold text-foreground">{activeDeleteEntry.projects?.name || activeDeleteEntry.project_id}</span>? {t(locale, "This action cannot be undone.", "Questa azione non può essere annullata.")}
                </p>

                <div className="flex items-center justify-end gap-2">
                  <Link href={withBaseFilterParams({})} className="rounded-lg border border-border bg-background/60 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                    {t(locale, "Cancel", "Annulla")}
                  </Link>
                  <ModalActionForm
                    action={deleteTimeEntryAction}
                    successRedirectHref={withBaseFilterParams({})}
                    successMessage={t(locale, "Time entry deleted successfully", "Voce tempo eliminata con successo")}
                    closeLabel={t(locale, "Close", "Chiudi")}
                    genericErrorMessage={t(locale, "An error occurred while deleting the time entry.", "Si è verificato un errore durante l'eliminazione della voce tempo.")}
                  >
                    <input type="hidden" name="timeEntryId" value={activeDeleteEntry.id} />
                    <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors">
                      {t(locale, "Delete", "Elimina")}
                    </button>
                  </ModalActionForm>
                </div>
              </div>
            </ViewportModalPanel>
          </ViewportModal>
        )}
      </div>
    </main>
  );
}
