import { notFound } from "next/navigation";
import { createCheckoutForHoursAction } from "@/app/actions/billing";
import {
  addProjectDiscussionMessageAction,
  loadProjectDiscussionAction,
  updateProjectDiscussionMessageAction,
} from "@/app/actions/projects";
import { LocalDateTime } from "@/components/local-date-time";
import { ProjectDetailShell, ProjectDiscussionPanel, QuotesSectionCard } from "@/components/projects";
import { quotesPrimaryButtonClass } from "@/components/quotes";
import { requireRole } from "@/lib/auth";
import { localeTag, t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { hoursToMinutesWithHoursDisplay, loggedHoursBetween } from "@/lib/time";

export const dynamic = "force-dynamic";

interface CustomerProjectRow {
  id: string;
  name: string;
  description: string | null;
  assigned_hours: number;
  billing_mode: string | null;
  customer_id: string;
}

interface BillingSummaryRow {
  project_id: string;
  outstanding_debt_hours: number;
}

interface TimeEntryRow {
  id: string;
  worker_id: string;
  started_at: string;
  ended_at: string | null;
  description: string | null;
}

interface WorkerProfileRow {
  id: string;
  full_name: string | null;
}

interface PurchaseRow {
  id: string;
  hours_added: number;
  amount_cents: number | null;
  currency: string | null;
  payment_method: "stripe" | "manual";
  admin_comment: string | null;
  created_at: string;
}

function totalUsedHours(entries: TimeEntryRow[]) {
  return entries.reduce((total, entry) => {
    if (!entry.ended_at) {
      return total;
    }

    return total + loggedHoursBetween(entry.started_at, entry.ended_at);
  }, 0);
}

export default async function CustomerProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }> | { projectId: string };
}) {
  const locale = await getLocale();
  const tag = localeTag(locale);
  const profile = await requireRole(["customer"]);
  const supabase = await createClient();
  const routeParams = await Promise.resolve(params);
  const projectId = routeParams.projectId?.trim();

  const [{ data: project }, { data: billingSummary }, { data: timeEntries }, { data: purchases }] = await Promise.all([
    supabase
      .from("projects")
      .select("id,name,description,assigned_hours,billing_mode,customer_id")
      .eq("id", projectId)
      .eq("customer_id", profile.id)
      .maybeSingle<CustomerProjectRow>(),
    supabase.from("project_billing_summary").select("project_id,outstanding_debt_hours").eq("project_id", projectId).maybeSingle<BillingSummaryRow>(),
    supabase
      .from("time_entries")
      .select("id,worker_id,started_at,ended_at,description")
      .eq("project_id", projectId)
      .order("started_at", { ascending: false })
      .limit(12),
    supabase
      .from("hour_purchases")
      .select("id,hours_added,amount_cents,currency,payment_method,admin_comment,created_at")
      .eq("customer_id", profile.id)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  if (!project) {
    notFound();
  }

  const projectEntries = (timeEntries ?? []) as TimeEntryRow[];
  const workerIds = [...new Set(projectEntries.map((entry) => entry.worker_id).filter(Boolean))];
  const { data: workerProfiles } = workerIds.length > 0
    ? await supabase.from("profiles").select("id,full_name").in("id", workerIds)
    : { data: [] };

  const workerNameById = new Map(
    ((workerProfiles ?? []) as WorkerProfileRow[]).map((worker) => [worker.id, worker.full_name?.trim() || worker.id]),
  );

  const discussionFormData = new FormData();
  discussionFormData.set("projectId", project.id);
  const messages = await loadProjectDiscussionAction(discussionFormData);
  const usedHours = totalUsedHours(projectEntries);
  const assignedHours = Number(project.assigned_hours ?? 0);
  const remainingHours = Math.max(0, assignedHours - usedHours);
  const outstandingDebt = Number(billingSummary?.outstanding_debt_hours ?? 0);
  const projectPurchases = (purchases ?? []) as PurchaseRow[];

  return (
    <ProjectDetailShell
      backHref="/customer"
      backLabel={t(locale, "Back to dashboard", "Torna alla dashboard")}
      title={t(locale, "Project detail", "Dettaglio progetto")}
      description={t(locale, "Focus on one project at a time, review the latest delivery activity, and keep the shared project conversation in one place.", "Concentrati su un progetto alla volta, rivedi l'attività di consegna più recente e mantieni la conversazione condivisa del progetto in un unico posto.")}
      projectName={project.name}
      projectDescription={project.description || t(locale, "No project description provided yet.", "Nessuna descrizione progetto disponibile.")}
      badgeLabel={project.billing_mode === "postpaid" ? t(locale, "Post-paid", "Post-pagato") : t(locale, "Prepaid", "Prepagato")}
      badgeTone={project.billing_mode === "postpaid" ? "warning" : "info"}
      meta={[
        { label: t(locale, "Assigned hours", "Ore assegnate"), value: hoursToMinutesWithHoursDisplay(assignedHours), tone: "accent" },
        { label: t(locale, "Used hours", "Ore usate"), value: hoursToMinutesWithHoursDisplay(usedHours) },
        {
          label: project.billing_mode === "postpaid" ? t(locale, "Outstanding debt", "Debito residuo") : t(locale, "Remaining hours", "Ore rimanenti"),
          value: hoursToMinutesWithHoursDisplay(project.billing_mode === "postpaid" ? outstandingDebt : remainingHours),
          tone: project.billing_mode === "postpaid" && outstandingDebt > 0 ? "danger" : remainingHours > 0 ? "success" : "danger",
        },
        { label: t(locale, "Discussion messages", "Messaggi discussione"), value: String(messages.length) },
      ]}
      overview={(
        <QuotesSectionCard
          title={t(locale, "Recent activity", "Attività recenti")}
          description={t(locale, "Latest delivery updates recorded on this project.", "Ultimi aggiornamenti di consegna registrati su questo progetto.")}
        >
          <div className="space-y-3">
            {projectEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t(locale, "No activity recorded yet.", "Nessuna attività registrata ancora.")}</p>
            ) : (
              projectEntries.map((entry) => {
                const workerName = workerNameById.get(entry.worker_id) || t(locale, "Unknown worker", "Operatore sconosciuto");
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
          title={t(locale, "Capacity & history", "Capacità e storico")}
          description={t(locale, "Top up prepaid hours or review the latest project-specific purchases.", "Aggiungi ore prepagate o rivedi gli ultimi acquisti specifici del progetto.")}
        >
          <div className="space-y-4">
            <form action={createCheckoutForHoursAction} className="space-y-3 rounded-xl border border-border/70 bg-background/60 p-4">
              <input type="hidden" name="projectId" value={project.id} />
              <label htmlFor="project-hours-to-buy" className="text-sm font-medium text-foreground">{t(locale, "Add more hours", "Aggiungi altre ore")}</label>
              <div className="flex gap-2">
                <input
                  id="project-hours-to-buy"
                  type="number"
                  name="hoursToBuy"
                  min="1"
                  step="1"
                  defaultValue="10"
                  className="w-full rounded-lg border border-input bg-background/75 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button className={quotesPrimaryButtonClass}>{t(locale, "Buy", "Acquista")}</button>
              </div>
            </form>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t(locale, "Latest purchases", "Ultimi acquisti")}</p>
              {projectPurchases.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t(locale, "No purchases recorded for this project yet.", "Nessun acquisto registrato ancora per questo progetto.")}</p>
              ) : (
                projectPurchases.map((purchase) => {
                  const amountLabel = purchase.payment_method === "manual" || purchase.amount_cents == null || !purchase.currency
                    ? "—"
                    : `${(purchase.amount_cents / 100).toFixed(2)} ${purchase.currency.toUpperCase()}`;

                  return (
                    <article key={purchase.id} className="rounded-xl border border-border/70 bg-background/60 px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-foreground">{hoursToMinutesWithHoursDisplay(Math.abs(Number(purchase.hours_added ?? 0)))}</p>
                        <span className="text-xs text-muted-foreground"><LocalDateTime value={purchase.created_at} tag={tag} /></span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{amountLabel} • {purchase.payment_method === "manual" ? t(locale, "Manual", "Manuale") : t(locale, "Stripe", "Stripe")}</p>
                      {purchase.admin_comment ? <p className="mt-2 text-xs text-muted-foreground">{purchase.admin_comment}</p> : null}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </QuotesSectionCard>
      )}
      discussion={(
        <ProjectDiscussionPanel
          title={t(locale, "Project discussion", "Discussione progetto")}
          description={t(locale, "Shared thread with admin and assigned workers for this live project.", "Thread condiviso con admin e operatori assegnati per questo progetto attivo.")}
          projectId={project.id}
          tag={tag}
          messages={messages}
          currentUserId={profile.id}
          currentUserRole="customer"
          canCompose={true}
          loadAction={loadProjectDiscussionAction}
          addAction={addProjectDiscussionMessageAction}
          updateAction={updateProjectDiscussionMessageAction}
          labels={{
            emptyMessage: t(locale, "No discussion messages yet.", "Nessun messaggio nella discussione ancora."),
            noMessageContent: t(locale, "No message content", "Nessun contenuto messaggio"),
            composerLabel: t(locale, "New message", "Nuovo messaggio"),
            composerPlaceholder: t(locale, "Ask for updates, confirm priorities, or clarify delivery details for this project.", "Chiedi aggiornamenti, conferma priorità o chiarisci dettagli di consegna per questo progetto."),
            composerHelpText: t(locale, "Messages refresh automatically while this page stays open.", "I messaggi si aggiornano automaticamente mentre questa pagina resta aperta."),
            sendLabel: t(locale, "Send message", "Invia messaggio"),
            sendingLabel: t(locale, "Sending…", "Invio in corso…"),
            editLabel: t(locale, "Edit", "Modifica"),
            cancelEditLabel: t(locale, "Cancel", "Annulla"),
            saveEditLabel: t(locale, "Save changes", "Salva modifiche"),
            savingEditLabel: t(locale, "Saving…", "Salvataggio in corso…"),
            editedLabel: t(locale, "Edited", "Modificato"),
            originalContentLabel: t(locale, "View original message", "Visualizza messaggio originale"),
            originalContentHint: t(locale, "Original content remains available so you can compare the first version with the latest edit.", "Il contenuto originale resta disponibile così puoi confrontare la prima versione con l'ultima modifica."),
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
