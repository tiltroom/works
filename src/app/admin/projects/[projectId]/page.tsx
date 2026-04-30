import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addProjectDiscussionMessageAction,
  loadProjectDiscussionAction,
  updateProjectDiscussionMessageAction,
} from "@/app/actions/projects";
import { LocalDateTime } from "@/components/local-date-time";
import { ProjectDetailShell, ProjectDiscussionPanel, QuotesSectionCard, type ProjectDetailMetaItem } from "@/components/projects";
import { quotesSecondaryButtonClass } from "@/components/quotes";
import { requireRole } from "@/lib/auth";
import { localeTag, t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { assignedHoursFromQuoteEstimateOrSubtasks, outstandingDebtFromBilledHours, sumPurchasedHours } from "@/lib/project-hours";
import { createClient } from "@/lib/supabase/server";
import { hoursToMinutesWithHoursDisplay, loggedHoursBetween } from "@/lib/time";

export const dynamic = "force-dynamic";

interface AdminProjectRow {
  id: string;
  name: string;
  description: string | null;
  billing_mode: string | null;
  customer_id: string;
  profiles: {
    full_name: string | null;
  } | null;
  project_workers: Array<{
    worker_id: string;
  }> | null;
}

interface TimeEntryRow {
  id: string;
  worker_id: string;
  started_at: string;
  ended_at: string | null;
  description: string | null;
  source: "timer" | "manual";
}

interface WorkerProfileRow {
  id: string;
  full_name: string | null;
}

interface LinkedQuoteRow {
  id: string;
  total_estimated_hours: number | string | null;
}

interface QuoteSubtaskEstimateRow {
  estimated_hours: number | string | null;
}

interface PurchaseHoursRow {
  hours_added: number | string | null;
}

function totalUsedHours(entries: TimeEntryRow[]) {
  return entries.reduce((total, entry) => {
    if (!entry.ended_at) {
      return total;
    }

    return total + loggedHoursBetween(entry.started_at, entry.ended_at);
  }, 0);
}

export default async function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }> | { projectId: string };
}) {
  const locale = await getLocale();
  const tag = localeTag(locale);
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const routeParams = await Promise.resolve(params);
  const projectId = routeParams.projectId?.trim();

  const [{ data: project }, { data: timeEntries }, { data: linkedQuoteFromDb }, { data: purchases }] = await Promise.all([
    supabase
      .from("projects")
      .select("id,name,description,billing_mode,customer_id,profiles!projects_customer_id_fkey(full_name),project_workers(worker_id)")
      .eq("id", projectId)
      .maybeSingle<AdminProjectRow>(),
    supabase
      .from("time_entries")
      .select("id,worker_id,started_at,ended_at,description,source")
      .eq("project_id", projectId)
      .order("started_at", { ascending: false }),
    supabase
      .from("quotes")
      .select("id,total_estimated_hours")
      .eq("linked_project_id", projectId)
      .maybeSingle<LinkedQuoteRow>(),
    supabase
      .from("hour_purchases")
      .select("hours_added")
      .eq("project_id", projectId),
  ]);

  if (!project) {
    notFound();
  }

  const workerIds = [...new Set((project.project_workers ?? []).map((assignment) => assignment.worker_id))];
  const { data: workerProfiles } = workerIds.length > 0
    ? await supabase.from("profiles").select("id,full_name").in("id", workerIds)
    : { data: [] };

  const workerNameById = new Map(
    ((workerProfiles ?? []) as WorkerProfileRow[]).map((worker) => [worker.id, worker.full_name?.trim() || worker.id]),
  );

  const discussionFormData = new FormData();
  discussionFormData.set("projectId", project.id);
  const messages = await loadProjectDiscussionAction(discussionFormData);
  const projectEntries = (timeEntries ?? []) as TimeEntryRow[];
  const projectPurchases = (purchases ?? []) as PurchaseHoursRow[];
  const linkedQuote = linkedQuoteFromDb as LinkedQuoteRow | null;
  const { data: quoteSubtasksFromDb } = linkedQuote
    ? await supabase
        .from("quote_subtasks")
        .select("estimated_hours")
        .eq("quote_id", linkedQuote.id)
    : { data: [] };
  const quoteSubtasks = (quoteSubtasksFromDb ?? []) as QuoteSubtaskEstimateRow[];
  const usedHours = totalUsedHours(projectEntries);
  const assignedHours = assignedHoursFromQuoteEstimateOrSubtasks(linkedQuote, quoteSubtasks);
  const billedHours = sumPurchasedHours(projectPurchases);
  const remainingHours = Math.max(0, assignedHours - usedHours);
  const isPostPaidProject = project.billing_mode === "postpaid";
  const outstandingDebt = outstandingDebtFromBilledHours(usedHours, billedHours);
  const workerNames = workerIds.map((workerId) => workerNameById.get(workerId) ?? workerId);
  const projectMeta: ProjectDetailMetaItem[] = [
    { label: t(locale, "Customer", "Cliente"), value: project.profiles?.full_name || t(locale, "Unknown", "Sconosciuto") },
    { label: t(locale, "Assigned hours", "Ore assegnate"), value: hoursToMinutesWithHoursDisplay(assignedHours), tone: "accent" },
    { label: t(locale, "Used hours", "Ore usate"), value: hoursToMinutesWithHoursDisplay(usedHours) },
    {
      label: t(locale, "Remaining hours", "Ore rimanenti"),
      value: hoursToMinutesWithHoursDisplay(remainingHours),
      tone: "success",
    },
  ];

  if (isPostPaidProject) {
    projectMeta.push({
      label: t(locale, "Outstanding debt", "Debito residuo"),
      value: hoursToMinutesWithHoursDisplay(outstandingDebt),
      tone: outstandingDebt > 0 ? "danger" : "success",
    });
  }

  return (
    <ProjectDetailShell
      backHref="/admin?tab=projects"
      backLabel={t(locale, "Back to projects", "Torna ai progetti")}
      title={t(locale, "Project detail", "Dettaglio progetto")}
      description={t(locale, "Track one project in context, review the latest activity, and keep the delivery discussion moving without leaving the admin workspace.", "Monitora un progetto nel suo contesto, rivedi l'attività più recente e mantieni viva la discussione di consegna senza uscire dall'area admin.")}
      projectName={project.name}
      projectDescription={project.description || t(locale, "No project description provided yet.", "Nessuna descrizione progetto disponibile.")}
      badgeLabel={isPostPaidProject ? t(locale, "Post-paid", "Post-pagato") : t(locale, "Prepaid", "Prepagato")}
      badgeTone={isPostPaidProject ? "warning" : "info"}
      headerAction={<Link href={`/admin?tab=projects&editProjectId=${project.id}`} className={quotesSecondaryButtonClass}>{t(locale, "Edit project", "Modifica progetto")}</Link>}
      meta={projectMeta}
      overview={(
        <QuotesSectionCard
          title={t(locale, "Latest tracked work", "Ultimo lavoro registrato")}
          description={t(locale, "Recent time entries on this project across assigned workers.", "Ultime voci di tempo del progetto per gli operatori assegnati.")}
        >
          <div className="space-y-3">
            {projectEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t(locale, "No time entries on this project yet.", "Nessuna voce di tempo ancora registrata su questo progetto.")}</p>
            ) : (
              projectEntries.map((entry) => {
                const workerName = workerNameById.get(entry.worker_id) || entry.worker_id;
                const durationLabel = entry.ended_at
                  ? hoursToMinutesWithHoursDisplay(loggedHoursBetween(entry.started_at, entry.ended_at))
                  : t(locale, "Running", "In corso");

                return (
                  <article key={entry.id} className="rounded-xl border border-border/70 bg-background/60 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{workerName}</p>
                        <p className="mt-1 text-xs text-muted-foreground"><LocalDateTime value={entry.started_at} tag={tag} /></p>
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
          title={t(locale, "Assignments", "Assegnazioni")}
          description={t(locale, "Customer ownership plus the workers currently attached to this project.", "Cliente proprietario e operatori attualmente associati a questo progetto.")}
        >
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t(locale, "Assigned workers", "Operatori assegnati")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {workerNames.length === 0 ? (
                  <span className="text-sm text-muted-foreground">{t(locale, "No workers assigned yet.", "Nessun operatore assegnato ancora.")}</span>
                ) : (
                  workerNames.map((workerName) => (
                    <span key={workerName} className="rounded-full border border-border bg-background/70 px-3 py-1 text-sm text-foreground">
                      {workerName}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/60 px-4 py-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{t(locale, "Billing state", "Stato fatturazione")}</p>
              <p className="mt-2">
                {isPostPaidProject
                  ? t(locale, "Post-paid projects continue accruing work and surface debt separately from assigned-hour credit.", "I progetti post-pagati continuano ad accumulare lavoro e mostrano il debito separatamente dal credito ore assegnato.")
                  : t(locale, "Prepaid projects consume assigned hours directly, so remaining capacity is the main delivery signal.", "I progetti prepagati consumano direttamente le ore assegnate, quindi la capacità residua è il segnale principale di consegna.")}
              </p>
            </div>
          </div>
        </QuotesSectionCard>
      )}
      discussion={(
        <ProjectDiscussionPanel
          title={t(locale, "Project discussion", "Discussione progetto")}
          description={t(locale, "Live project thread shared with the customer and assigned workers.", "Thread live del progetto condiviso con il cliente e gli operatori assegnati.")}
          projectId={project.id}
          tag={tag}
          messages={messages}
          currentUserId={profile.id}
          currentUserRole="admin"
          canCompose={true}
          loadAction={loadProjectDiscussionAction}
          addAction={addProjectDiscussionMessageAction}
          updateAction={updateProjectDiscussionMessageAction}
          labels={{
            emptyMessage: t(locale, "No discussion messages yet.", "Nessun messaggio nella discussione ancora."),
            noMessageContent: t(locale, "No message content", "Nessun contenuto messaggio"),
            composerLabel: t(locale, "New message", "Nuovo messaggio"),
            composerPlaceholder: t(locale, "Share delivery updates, clarify scope changes, or unblock the next step.", "Condividi aggiornamenti di consegna, chiarisci cambi di scope o sblocca il prossimo passo."),
            composerHelpText: t(locale, "The thread refreshes automatically every few seconds while this page stays open.", "Il thread si aggiorna automaticamente ogni pochi secondi mentre questa pagina resta aperta."),
            sendLabel: t(locale, "Send message", "Invia messaggio"),
            sendingLabel: t(locale, "Sending…", "Invio in corso…"),
            editLabel: t(locale, "Edit", "Modifica"),
            cancelEditLabel: t(locale, "Cancel", "Annulla"),
            saveEditLabel: t(locale, "Save changes", "Salva modifiche"),
            savingEditLabel: t(locale, "Saving…", "Salvataggio in corso…"),
            editedLabel: t(locale, "Edited", "Modificato"),
            originalContentLabel: t(locale, "View original message", "Visualizza messaggio originale"),
            originalContentHint: t(locale, "Original content stays available so edits remain easy to audit later.", "Il contenuto originale resta disponibile così le modifiche restano facili da verificare in seguito."),
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
