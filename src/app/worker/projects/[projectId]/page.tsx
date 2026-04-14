import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addProjectDiscussionMessageAction,
  loadProjectDiscussionAction,
  updateProjectDiscussionMessageAction,
} from "@/app/actions/projects";
import { ProjectDetailShell, ProjectDiscussionPanel, QuotesSectionCard } from "@/components/projects";
import { quotesSecondaryButtonClass } from "@/components/quotes";
import { requireRole } from "@/lib/auth";
import { localeTag, t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
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
  profiles: {
    full_name: string | null;
  } | null;
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
}

function totalUsedHours(entries: TimeEntryRow[]) {
  return entries.reduce((total, entry) => {
    if (!entry.ended_at) {
      return total;
    }

    return total + loggedHoursBetween(entry.started_at, entry.ended_at);
  }, 0);
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

  const [{ data: project }, { data: billingSummary }, { data: timeEntries }] = await Promise.all([
    supabase
      .from("projects")
      .select("id,name,description,assigned_hours,billing_mode,customer_id,profiles!projects_customer_id_fkey(full_name)")
      .eq("id", projectId)
      .maybeSingle<WorkerProjectRow>(),
    supabase.from("project_billing_summary").select("project_id,outstanding_debt_hours").eq("project_id", projectId).maybeSingle<BillingSummaryRow>(),
    supabase
      .from("time_entries")
      .select("id,started_at,ended_at,description,source")
      .eq("project_id", projectId)
      .eq("worker_id", profile.id)
      .order("started_at", { ascending: false })
      .limit(12),
  ]);

  if (!project) {
    notFound();
  }

  const discussionFormData = new FormData();
  discussionFormData.set("projectId", project.id);
  const messages = await loadProjectDiscussionAction(discussionFormData);
  const workerEntries = (timeEntries ?? []) as TimeEntryRow[];
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
        { label: t(locale, "Customer", "Cliente"), value: project.profiles?.full_name || t(locale, "Unknown", "Sconosciuto") },
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
