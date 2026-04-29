import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addProjectDiscussionMessageAction,
  loadProjectDiscussionAction,
  updateProjectDiscussionMessageAction,
} from "@/app/actions/projects";
import { createManualTimeEntryAction, startTimerAction, stopTimerAction } from "@/app/actions/time-entries";
import { ProjectDetailShell, ProjectDiscussionPanel, QuotesSectionCard } from "@/components/projects";
import { quotesSecondaryButtonClass } from "@/components/quotes";
import { SubtaskTimeControls } from "@/components/worker/subtask-time-controls";
import { SubtaskTimeControlsReveal } from "@/components/worker/subtask-time-controls-reveal";
import { requireRole } from "@/lib/auth";
import { env } from "@/lib/env";
import { localeTag, t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hoursToMinutesWithHoursDisplay, loggedHoursBetween } from "@/lib/time";

export const dynamic = "force-dynamic";

interface WorkerProjectRow {
  id: string;
  name: string;
  description: string | null;
  assigned_hours: number;
  billing_mode: string | null;
  customer_id: string;
}

interface ProjectCustomerDisplayRow {
  customer_id: string;
  full_name: string | null;
}

interface BillingSummaryRow {
  project_id: string;
  outstanding_debt_hours: number;
}

interface TimeEntryRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  description: string | null;
  source: "timer" | "manual";
  quote_subtask_id: string | null;
}

interface LinkedQuoteRow {
  id: string;
  title: string;
  total_estimated_hours: number | string | null;
  total_logged_hours: number | string | null;
}

interface QuoteSubtaskRow {
  id: string;
  title: string;
  description: string | null;
  estimated_hours: number | string | null;
  sort_order: number | null;
  created_at: string;
}

interface QuoteSubtaskTimeEntryRow {
  id: string;
  quote_subtask_id: string | null;
  started_at: string;
  ended_at: string | null;
}

function totalUsedHours(entries: TimeEntryRow[]) {
  return entries.reduce((total, entry) => {
    if (!entry.ended_at) {
      return total;
    }

    return total + loggedHoursBetween(entry.started_at, entry.ended_at);
  }, 0);
}

function parseHours(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCompactHours(hours: number) {
  return `${hours.toFixed(2)}h`;
}

function completedLoggedHours(entries: Array<{ started_at: string; ended_at: string | null }>) {
  return entries.reduce((total, entry) => {
    if (!entry.ended_at) {
      return total;
    }

    return total + loggedHoursBetween(entry.started_at, entry.ended_at);
  }, 0);
}

function progressPercent(loggedHours: number, estimatedHours: number) {
  if (estimatedHours <= 0) {
    return loggedHours > 0 ? 100 : 0;
  }

  return Math.min((loggedHours / estimatedHours) * 100, 100);
}

async function loadProjectCustomerDisplayName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  customerId: string,
) {
  const { data, error } = await supabase
    .rpc("get_project_customer_display_name", { p_project_id: projectId })
    .maybeSingle<ProjectCustomerDisplayRow>();

  if (data?.full_name?.trim()) {
    return data.full_name.trim();
  }

  const rpcUnavailable = error?.code === "42883"
    || error?.code === "PGRST202"
    || error?.message.includes("get_project_customer_display_name")
    || false;

  if (!rpcUnavailable || !env.supabaseServiceRoleKey) {
    return null;
  }

  const admin = createAdminClient();
  const { data: customerProfile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", customerId)
    .maybeSingle<{ full_name: string | null }>();

  return customerProfile?.full_name?.trim() || null;
}

export default async function WorkerProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }> | { projectId: string };
}) {
  const locale = await getLocale();
  const tag = localeTag(locale);
  const profile = await requireRole(["worker"]);
  const supabase = await createClient();
  const routeParams = await Promise.resolve(params);
  const projectId = routeParams.projectId?.trim();

  const { data: assignment } = await supabase
    .from("project_workers")
    .select("project_id")
    .eq("project_id", projectId)
    .eq("worker_id", profile.id)
    .maybeSingle<{ project_id: string }>();

  if (!assignment) {
    notFound();
  }

  const [{ data: project }, { data: billingSummary }, { data: timeEntries }, { data: runningFromDb }, { data: linkedQuoteFromDb }] = await Promise.all([
    supabase
      .from("projects")
      .select("id,name,description,assigned_hours,billing_mode,customer_id")
      .eq("id", projectId)
      .maybeSingle<WorkerProjectRow>(),
    supabase.from("project_billing_summary").select("project_id,outstanding_debt_hours").eq("project_id", projectId).maybeSingle<BillingSummaryRow>(),
    supabase
      .from("time_entries")
      .select("id,started_at,ended_at,description,source,quote_subtask_id")
      .eq("project_id", projectId)
      .eq("worker_id", profile.id)
      .order("started_at", { ascending: false })
      .limit(12),
    supabase
      .from("time_entries")
      .select("id,project_id,started_at,ended_at,description,source,quote_subtask_id")
      .eq("worker_id", profile.id)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle<TimeEntryRow>(),
    supabase
      .from("quotes")
      .select("id,title,total_estimated_hours,total_logged_hours")
      .eq("linked_project_id", projectId)
      .maybeSingle<LinkedQuoteRow>(),
  ]);

  if (!project) {
    notFound();
  }

  const customerDisplayName = await loadProjectCustomerDisplayName(supabase, project.id, project.customer_id);

  const discussionFormData = new FormData();
  discussionFormData.set("projectId", project.id);
  const messages = await loadProjectDiscussionAction(discussionFormData);
  const workerEntries = (timeEntries ?? []) as TimeEntryRow[];
  const linkedQuote = linkedQuoteFromDb as LinkedQuoteRow | null;
  let quoteSubtasks: QuoteSubtaskRow[] = [];
  let quoteSubtaskTimeEntries: QuoteSubtaskTimeEntryRow[] = [];

  if (linkedQuote) {
    const { data: quoteSubtasksFromDb } = await supabase
      .from("quote_subtasks")
      .select("id,title,description,estimated_hours,sort_order,created_at")
      .eq("quote_id", linkedQuote.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    quoteSubtasks = (quoteSubtasksFromDb ?? []) as QuoteSubtaskRow[];
    const subtaskIds = quoteSubtasks.map((subtask) => subtask.id);

    if (subtaskIds.length > 0) {
      const { data: directTimeEntries, error: directTimeEntriesError } = await supabase
        .from("time_entries")
        .select("id,quote_subtask_id,started_at,ended_at")
        .eq("project_id", project.id)
        .in("quote_subtask_id", subtaskIds);

      if (directTimeEntriesError) {
        const { data: generatedTimeEntries } = await supabase
          .from("time_entries")
          .select("id,started_at,ended_at,quote_subtask_entry_id,quote_subtask_entries(quote_subtask_id)")
          .eq("project_id", project.id)
          .not("quote_subtask_entry_id", "is", null);

        quoteSubtaskTimeEntries = (generatedTimeEntries ?? []).map((entry) => {
          const relatedEntry = entry.quote_subtask_entries as { quote_subtask_id?: string | null } | { quote_subtask_id?: string | null }[] | null;
          const related = Array.isArray(relatedEntry) ? relatedEntry[0] : relatedEntry;

          return {
            id: String(entry.id),
            started_at: String(entry.started_at),
            ended_at: typeof entry.ended_at === "string" ? entry.ended_at : null,
            quote_subtask_id: related?.quote_subtask_id ?? null,
          };
        }).filter((entry) => entry.quote_subtask_id && subtaskIds.includes(entry.quote_subtask_id));
      } else {
        quoteSubtaskTimeEntries = (directTimeEntries ?? []) as QuoteSubtaskTimeEntryRow[];
      }
    }
  }
  const quoteTimeEntriesBySubtask = new Map<string, QuoteSubtaskTimeEntryRow[]>();

  for (const entry of quoteSubtaskTimeEntries) {
    if (!entry.quote_subtask_id) {
      continue;
    }

    const entriesForSubtask = quoteTimeEntriesBySubtask.get(entry.quote_subtask_id) ?? [];
    entriesForSubtask.push(entry);
    quoteTimeEntriesBySubtask.set(entry.quote_subtask_id, entriesForSubtask);
  }

  const running = runningFromDb as TimeEntryRow | null;
  const usedHours = totalUsedHours(workerEntries);
  const assignedHours = Number(project.assigned_hours ?? 0);
  const outstandingDebt = Number(billingSummary?.outstanding_debt_hours ?? 0);

  return (
    <ProjectDetailShell
      backHref="/worker"
      backLabel={t(locale, "Back to dashboard", "Torna alla dashboard")}
      title={t(locale, "Project detail", "Dettaglio progetto")}
      description={t(locale, "Stay inside one assigned project, review your latest logged work, and keep the shared project thread moving.", "Resta dentro un singolo progetto assegnato, rivedi il tuo lavoro registrato più recente e mantieni attivo il thread condiviso del progetto.")}
      projectName={project.name}
      projectDescription={project.description || t(locale, "No project description provided yet.", "Nessuna descrizione progetto disponibile.")}
      badgeLabel={project.billing_mode === "postpaid" ? t(locale, "Post-paid", "Post-pagato") : t(locale, "Prepaid", "Prepagato")}
      badgeTone={project.billing_mode === "postpaid" ? "warning" : "info"}
      headerAction={<Link href={`/worker?projectId=${project.id}`} className={quotesSecondaryButtonClass}>{t(locale, "Filter dashboard to this project", "Filtra dashboard su questo progetto")}</Link>}
      meta={[
        { label: t(locale, "Customer", "Cliente"), value: customerDisplayName || t(locale, "Unknown", "Sconosciuto") },
        { label: t(locale, "Assigned hours", "Ore assegnate"), value: hoursToMinutesWithHoursDisplay(assignedHours), tone: "accent" },
        { label: t(locale, "My logged hours", "Le mie ore registrate"), value: hoursToMinutesWithHoursDisplay(usedHours) },
        project.billing_mode === "postpaid"
          ? {
              label: t(locale, "Project debt", "Debito progetto"),
              value: hoursToMinutesWithHoursDisplay(outstandingDebt),
              tone: outstandingDebt > 0 ? "danger" : "success",
            }
          : {
              label: t(locale, "Discussion messages", "Messaggi discussione"),
              value: String(messages.length),
            },
      ]}
      overview={(
        <div className="space-y-4">
          {linkedQuote ? (
            <QuotesSectionCard
              title={t(locale, "Subtasks", "Sottoattività")}
              description={t(locale, "Work directly from the quote breakdown: start a focused timer or log past work against each activity.", "Lavora direttamente dalla suddivisione del preventivo: avvia un timer mirato o registra lavoro passato su ogni attività.")}
              action={<Link href={`/worker/quotes/${linkedQuote.id}`} className={quotesSecondaryButtonClass}>{t(locale, "Open source quote", "Apri preventivo sorgente")}</Link>}
            >
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/70 bg-background/55 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t(locale, "Quote", "Preventivo")}</p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground" title={linkedQuote.title}>{linkedQuote.title}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/55 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t(locale, "Estimated", "Stimato")}</p>
                    <p className="mt-1 text-sm font-semibold text-brand-700 dark:text-brand-300">{formatCompactHours(parseHours(linkedQuote.total_estimated_hours))}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/55 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t(locale, "Tracked here", "Registrato qui")}</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{formatCompactHours(completedLoggedHours(quoteSubtaskTimeEntries))}</p>
                  </div>
                </div>

                {quoteSubtasks.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border/80 bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground">
                    {t(locale, "No quote subtasks are linked to this project yet.", "Nessuna sottoattività del preventivo è collegata a questo progetto.")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {quoteSubtasks.map((subtask) => {
                      const subtaskEntries = quoteTimeEntriesBySubtask.get(subtask.id) ?? [];
                      const loggedHours = completedLoggedHours(subtaskEntries);
                      const estimatedHours = parseHours(subtask.estimated_hours);
                      const remainingHours = Math.max(estimatedHours - loggedHours, 0);
                      const isOverEstimate = estimatedHours > 0 && loggedHours > estimatedHours;
                      const progress = progressPercent(loggedHours, estimatedHours);

                      return (
                        <article key={subtask.id} className="overflow-hidden rounded-xl border border-border/70 bg-background/55">
                          <div className="space-y-2 px-3 py-3">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-semibold text-foreground">{subtask.title}</h3>
                                {subtask.description ? <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">{subtask.description}</p> : null}
                              </div>
                              <div className="grid min-w-52 grid-cols-3 gap-2 text-right">
                                <div>
                                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t(locale, "Est.", "Stima")}</p>
                                  <p className="mt-1 text-xs font-semibold text-foreground">{formatCompactHours(estimatedHours)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t(locale, "Logged", "Registrato")}</p>
                                  <p className={`mt-1 text-xs font-semibold ${isOverEstimate ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`}>{formatCompactHours(loggedHours)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{isOverEstimate ? t(locale, "Over", "Extra") : t(locale, "Left", "Resta")}</p>
                                  <p className={`mt-1 text-xs font-semibold ${isOverEstimate ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>{formatCompactHours(isOverEstimate ? loggedHours - estimatedHours : remainingHours)}</p>
                                </div>
                              </div>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div className={`h-full rounded-full ${isOverEstimate ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                          <SubtaskTimeControlsReveal
                            showLabel={t(locale, "Log time", "Registra tempo")}
                            hideLabel={t(locale, "Hide controls", "Nascondi controlli")}
                            hint={t(locale, "Timer and manual logging stay hidden until needed.", "Timer e registrazione manuale restano nascosti finché servono.")}
                          >
                            <SubtaskTimeControls
                              projectId={project.id}
                              quoteSubtaskId={subtask.id}
                              startTimerAction={startTimerAction}
                              stopTimerAction={stopTimerAction}
                              createManualTimeEntryAction={createManualTimeEntryAction}
                              runningTimer={running ? { id: running.id, startedAt: running.started_at, quoteSubtaskId: running.quote_subtask_id } : null}
                              labels={{
                                startTimer: t(locale, "Start timer", "Avvia timer"),
                                stopTimer: t(locale, "Stop timer", "Ferma timer"),
                                manualLog: t(locale, "Manual log", "Registrazione manuale"),
                                note: t(locale, "Work note", "Nota lavoro"),
                                notePlaceholder: t(locale, "What did you complete for this activity?", "Cosa hai completato per questa attività?"),
                                startTime: t(locale, "Start", "Inizio"),
                                endTime: t(locale, "End", "Fine"),
                                saveManual: t(locale, "Log work", "Registra lavoro"),
                                saving: t(locale, "Saving…", "Salvataggio…"),
                                close: t(locale, "Close", "Chiudi"),
                                cancel: t(locale, "Review entry", "Rivedi voce"),
                                errorTitle: t(locale, "Unable to log work", "Impossibile registrare il lavoro"),
                                warningTitle: t(locale, "Estimate exceeded", "Stima superata"),
                                warningDescription: t(locale, "This work can still be registered after confirmation.", "Questo lavoro può comunque essere registrato dopo la conferma."),
                                estimate: t(locale, "Estimate", "Stima"),
                                alreadyLogged: t(locale, "Already logged", "Già registrato"),
                                newEntry: t(locale, "New entry", "Nuova voce"),
                                afterSave: t(locale, "After save", "Dopo salvataggio"),
                                overBy: t(locale, "Over by", "Oltre di"),
                                continueAnyway: t(locale, "Register anyway", "Registra comunque"),
                                elapsed: t(locale, "elapsed", "trascorso"),
                              }}
                            />
                          </SubtaskTimeControlsReveal>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </QuotesSectionCard>
          ) : null}

          <QuotesSectionCard
            title={t(locale, "My recent entries", "Le mie voci recenti")}
            description={t(locale, "The latest time you logged specifically against this project.", "Il tempo più recente che hai registrato specificamente su questo progetto.")}
          >
            <div className="space-y-3">
              {workerEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t(locale, "You have not logged time on this project yet.", "Non hai ancora registrato tempo su questo progetto.")}</p>
              ) : (
                workerEntries.map((entry) => {
                  const durationLabel = entry.ended_at
                    ? hoursToMinutesWithHoursDisplay(loggedHoursBetween(entry.started_at, entry.ended_at))
                    : t(locale, "Running", "In corso");

                  return (
                    <article key={entry.id} className="rounded-xl border border-border/70 bg-background/60 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{new Date(entry.started_at).toLocaleString(tag)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{entry.source === "timer" ? t(locale, "Timer", "Timer") : t(locale, "Manual", "Manuale")}</p>
                        </div>
                        <span className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">{durationLabel}</span>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">{entry.description || t(locale, "No description provided.", "Nessuna descrizione fornita.")}</p>
                    </article>
                  );
                })
              )}
            </div>
          </QuotesSectionCard>
        </div>
      )}
      secondary={(
        <QuotesSectionCard
          title={t(locale, "Project workflow", "Flusso progetto")}
          description={t(locale, "Use the main worker dashboard to start timers or add manual entries while keeping this project context visible.", "Usa la dashboard operatore principale per avviare timer o aggiungere voci manuali mantenendo visibile il contesto di questo progetto.")}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-background/60 px-4 py-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{t(locale, "How to use this page", "Come usare questa pagina")}</p>
              <p className="mt-2">{t(locale, "Keep the discussion open here for live coordination, then jump back to the dashboard whenever you need to start or correct tracked time.", "Tieni aperta qui la discussione per la coordinazione live, poi torna alla dashboard quando devi avviare o correggere il tempo registrato.")}</p>
            </div>
            <Link href={`/worker?projectId=${project.id}`} className={quotesSecondaryButtonClass}>
              {t(locale, "Open filtered recent activity", "Apri attività recenti filtrate")}
            </Link>
          </div>
        </QuotesSectionCard>
      )}
      discussion={(
        <ProjectDiscussionPanel
          title={t(locale, "Project discussion", "Discussione progetto")}
          description={t(locale, "Shared thread with admin and customer for day-to-day delivery coordination.", "Thread condiviso con admin e cliente per la coordinazione quotidiana della consegna.")}
          projectId={project.id}
          tag={tag}
          messages={messages}
          currentUserId={profile.id}
          currentUserRole="worker"
          canCompose={true}
          loadAction={loadProjectDiscussionAction}
          addAction={addProjectDiscussionMessageAction}
          updateAction={updateProjectDiscussionMessageAction}
          labels={{
            emptyMessage: t(locale, "No discussion messages yet.", "Nessun messaggio nella discussione ancora."),
            noMessageContent: t(locale, "No message content", "Nessun contenuto messaggio"),
            composerLabel: t(locale, "New message", "Nuovo messaggio"),
            composerPlaceholder: t(locale, "Share blockers, delivery notes, or implementation updates for this project.", "Condividi blocchi, note di consegna o aggiornamenti implementativi per questo progetto."),
            composerHelpText: t(locale, "Messages refresh automatically while this page stays open.", "I messaggi si aggiornano automaticamente mentre questa pagina resta aperta."),
            sendLabel: t(locale, "Send message", "Invia messaggio"),
            sendingLabel: t(locale, "Sending…", "Invio in corso…"),
            editLabel: t(locale, "Edit", "Modifica"),
            cancelEditLabel: t(locale, "Cancel", "Annulla"),
            saveEditLabel: t(locale, "Save changes", "Salva modifiche"),
            savingEditLabel: t(locale, "Saving…", "Salvataggio in corso…"),
            editedLabel: t(locale, "Edited", "Modificato"),
            originalContentLabel: t(locale, "View original message", "Visualizza messaggio originale"),
            originalContentHint: t(locale, "Original content stays available so later readers can understand what changed.", "Il contenuto originale resta disponibile così chi legge dopo può capire cosa è cambiato."),
            liveUpdatesLabel: t(locale, "Refresh now", "Aggiorna ora"),
            refreshingLabel: t(locale, "Refreshing…", "Aggiornamento…"),
            readOnlyLabel: t(locale, "Discussion is currently read-only.", "La discussione è attualmente in sola lettura."),
            errorFallbackMessage: t(locale, "Unable to update discussion right now.", "Impossibile aggiornare la discussione in questo momento."),
            roleLabels: {
              admin: t(locale, "Admin", "Admin"),
              customer: t(locale, "Customer", "Cliente"),
              worker: t(locale, "Worker", "Operatore"),
            },
          }}
        />
      )}
    />
  );
}
