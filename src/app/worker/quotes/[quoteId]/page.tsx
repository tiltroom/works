import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addQuoteCommentAction,
  addQuoteSubtaskAction,
  addQuoteSubtaskEntryAction,
  loadQuoteDiscussionAction,
  loadQuotesPageData,
  updateQuoteCommentAction,
} from "@/app/actions/quotes";
import { LocalDateTime } from "@/components/local-date-time";
import { LogoutButton } from "@/components/logout-button";
import {
  QuoteActionModal,
  QuoteDiscussionPanel,
  QuotesHeader,
  QuotesRichTextContent,
  QuotesSectionCard,
  QuotesSubtaskCard,
  QuotesSubtaskForm,
  QuotesWorkerEntriesCard,
  QuotesWorkerEntryForm,
  quotesInputClass,
  quotesSecondaryButtonClass,
} from "@/components/quotes";
import { QueryToast } from "@/components/ui/query-toast";
import { requireRole } from "@/lib/auth";
import { localeTag, t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import {
  formatQuoteHours,
  formatQuoteStatus,
  getQuoteStatusTone,
} from "@/lib/quotes";
import type { QueryToastVariant } from "@/lib/query-toast";

export const dynamic = "force-dynamic";

export default async function WorkerQuoteViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }> | { quoteId: string };
  searchParams?: Promise<{ subtaskQuoteId?: string; entryQuoteId?: string; toast?: string; toastMessage?: string }> | { subtaskQuoteId?: string; entryQuoteId?: string; toast?: string; toastMessage?: string };
}) {
  const locale = await getLocale();
  const tag = localeTag(locale);
  const profile = await requireRole(["worker"]);
  const routeParams = await Promise.resolve(params);
  const quoteId = routeParams.quoteId?.trim();
  const detailHref = `/worker/quotes/${quoteId}`;
  const paramsValue = await Promise.resolve(searchParams ?? {});
  const subtaskQuoteId = paramsValue.subtaskQuoteId?.trim();
  const entryQuoteId = paramsValue.entryQuoteId?.trim();
  const toastTypeParam = paramsValue.toast?.trim();
  const toastMessageParam = paramsValue.toastMessage?.trim();
  const activeToast = (toastTypeParam === "success" || toastTypeParam === "error") && toastMessageParam
    ? { variant: toastTypeParam as QueryToastVariant, message: toastMessageParam }
    : null;

  const quotesData = await loadQuotesPageData("worker", profile.id);
  const quote = quotesData.quotes.find((entry) => entry.id === quoteId) ?? null;

  if (!quote) {
    notFound();
  }

  const assignedWorkers = quotesData.workers.filter((assignment) => assignment.quoteId === quote.id);
  const subtasks = quotesData.subtasks.filter((subtask) => subtask.quoteId === quote.id);
  const subtaskIds = new Set(subtasks.map((subtask) => subtask.id));
  const entries = quotesData.subtaskEntries.filter((entry) => subtaskIds.has(entry.quoteSubtaskId));
  const comments = quotesData.comments.filter((comment) => comment.quoteId === quote.id);
  const canMutate = quote.status === "draft";
  const activeSubtaskQuote = canMutate && subtaskQuoteId === quote.id ? quote : null;
  const activeEntryQuote = canMutate && entryQuoteId === quote.id ? quote : null;

  return (
    <main className="w-full">
      {activeToast ? <QueryToast variant={activeToast.variant} message={activeToast.message} closeLabel={t(locale, "Close", "Chiudi")} /> : null}

      <header className="mb-8 flex flex-col justify-between gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-center">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link href="/worker/quotes" className="rounded-full border border-border/70 bg-background/60 px-3 py-1 transition-colors hover:bg-accent hover:text-accent-foreground">
              ← {t(locale, "Back to quotes", "Torna ai preventivi")}
            </Link>
          </div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
            <span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h6m0 0l-3-3m3 3l-3 3M5 19h6a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
            {t(locale, "Worker quote review", "Revisione preventivo operatore")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t(locale, "Review one assigned quote at a time, keep notes visible to the workflow, and log draft work from the dedicated worker detail page.", "Rivedi un preventivo assegnato alla volta, mantieni visibili le note nel flusso e registra il lavoro in bozza dalla pagina dedicata all'operatore.")}
          </p>
        </div>
        <LogoutButton />
      </header>

      <section className="space-y-4">
        <QuotesHeader
          title={quote.title}
          statusLabel={formatQuoteStatus(locale, quote.status)}
          statusTone={getQuoteStatusTone(quote.status)}
          description={quote.description || t(locale, "No summary provided yet.", "Nessuna sintesi fornita.")}
          action={canMutate ? (
            <div className="flex flex-wrap gap-2">
              <Link href={`${detailHref}?subtaskQuoteId=${quote.id}`} className={quotesSecondaryButtonClass}>{t(locale, "Add subtask", "Aggiungi sottoattività")}</Link>
              <Link href={`${detailHref}?entryQuoteId=${quote.id}`} className={quotesSecondaryButtonClass}>{t(locale, "Log hours", "Registra ore")}</Link>
            </div>
          ) : null}
          meta={[
            { label: t(locale, "Customer", "Cliente"), value: quote.customerName || t(locale, "Unknown", "Sconosciuto") },
            { label: t(locale, "Estimated", "Stimato"), value: formatQuoteHours(quote.totalEstimatedHours), tone: "accent" },
            { label: t(locale, "Logged", "Registrato"), value: formatQuoteHours(quote.totalLoggedHours) },
            { label: t(locale, "Updated", "Aggiornato"), value: <LocalDateTime value={quote.updatedAt} tag={tag} /> },
          ]}
        />

        <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
          <QuotesSectionCard title={t(locale, "Customer brief", "Brief del cliente")}>
            <QuotesRichTextContent
              html={quote.contentHtml ?? ""}
              emptyMessage={t(locale, "No rich text body provided yet.", "Nessun corpo rich text ancora fornito.")}
            />
          </QuotesSectionCard>

          <QuotesSectionCard title={t(locale, "Assigned collaborators", "Collaboratori assegnati")}>
            <div className="space-y-2">
              {assignedWorkers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t(locale, "No workers assigned yet.", "Nessun operatore assegnato.")}</p>
              ) : (
                assignedWorkers.map((assignment) => (
                  <div key={`${assignment.quoteId}:${assignment.workerId}`} className="rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-sm">
                    <p className="font-medium text-foreground">{assignment.workerName || assignment.workerId}</p>
                    <p className="mt-1 text-xs text-muted-foreground"><LocalDateTime value={assignment.assignedAt} tag={tag} /></p>
                  </div>
                ))
              )}
            </div>
          </QuotesSectionCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <QuotesSubtaskCard
            title={t(locale, "Subtasks", "Sottoattività")}
            description={t(locale, "Add and refine the effort breakdown while the quote is draft.", "Aggiungi e rifinisci la suddivisione dello sforzo mentre il preventivo è in bozza.")}
            items={subtasks.map((subtask) => ({
              id: subtask.id,
              title: subtask.title,
              description: subtask.description,
              estimateLabel: formatQuoteHours(subtask.estimatedHours),
              loggedLabel: formatQuoteHours(entries.filter((entry) => entry.quoteSubtaskId === subtask.id).reduce((total, entry) => total + entry.loggedHours, 0)),
            }))}
            emptyMessage={t(locale, "No subtasks yet.", "Nessuna sottoattività ancora.")}
          />

          <QuotesWorkerEntriesCard
            title={t(locale, "Logged entries", "Voci registrate")}
            description={t(locale, "Capture the actual work spent on specific subtasks.", "Registra il lavoro effettivamente svolto sulle specifiche sottoattività.")}
            items={entries.map((entry) => ({
              id: entry.id,
              workerName: entry.workerName || t(locale, "Worker", "Operatore"),
              subtaskTitle: subtasks.find((subtask) => subtask.id === entry.quoteSubtaskId)?.title ?? t(locale, "Unknown subtask", "Sottoattività sconosciuta"),
              loggedLabel: formatQuoteHours(entry.loggedHours),
              note: entry.note,
              metaLabel: <LocalDateTime value={entry.createdAt} tag={tag} />,
            }))}
            emptyMessage={t(locale, "No logged entries yet.", "Nessuna voce registrata ancora.")}
          />
        </div>

        <QuoteDiscussionPanel
          title={t(locale, "Discussion", "Discussione")}
          description={t(locale, "Keep blockers, assumptions, and implementation notes visible to the whole quotes workflow.", "Mantieni visibili blocchi, assunzioni e note implementative lungo tutto il flusso dei preventivi.")}
          quoteId={quote.id}
          tag={tag}
          comments={comments}
          currentUserId={profile.id}
          currentUserRole="worker"
          canCompose={true}
          loadAction={loadQuoteDiscussionAction}
          addAction={addQuoteCommentAction}
          updateAction={updateQuoteCommentAction}
          labels={{
            emptyMessage: t(locale, "No comments yet.", "Nessun commento ancora."),
            noCommentContent: t(locale, "No comment content", "Nessun contenuto commento"),
            composerLabel: t(locale, "New message", "Nuovo messaggio"),
            composerPlaceholder: t(locale, "Describe blockers, implementation assumptions, or client-facing notes.", "Descrivi blocchi, assunzioni implementative o note per il cliente."),
            composerHelpText: t(locale, "Messages refresh automatically while you keep the quote open.", "I messaggi si aggiornano automaticamente mentre tieni aperto il preventivo."),
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
             readOnlyLabel: t(locale, "Discussion is currently not available for new messages.", "La discussione non è attualmente disponibile per nuovi messaggi."),
            errorFallbackMessage: t(locale, "Unable to update discussion right now.", "Impossibile aggiornare la discussione in questo momento."),
            roleLabels: {
              admin: t(locale, "Admin", "Admin"),
              customer: t(locale, "Customer", "Cliente"),
              worker: t(locale, "Worker", "Operatore"),
            },
          }}
        />
      </section>

      {activeSubtaskQuote ? (
        <QuoteActionModal
          title={t(locale, "Add subtask estimate", "Aggiungi stima sottoattività")}
          closeHref={detailHref}
          successRedirectHref={detailHref}
          action={addQuoteSubtaskAction}
          closeLabel={t(locale, "Close", "Chiudi")}
          cancelLabel={t(locale, "Cancel", "Annulla")}
          submitLabel={t(locale, "Save subtask", "Salva sottoattività")}
          submittingLabel={t(locale, "Saving…", "Salvataggio in corso…")}
          successMessage={t(locale, "Subtask saved", "Sottoattività salvata")}
          genericErrorMessage={t(locale, "Unable to save subtask", "Impossibile salvare la sottoattività")}
        >
          <input type="hidden" name="quoteId" value={activeSubtaskQuote.id} />
          <QuotesSubtaskForm
            titleLabel={t(locale, "Subtask title", "Titolo sottoattività")}
            descriptionLabel={t(locale, "Description", "Descrizione")}
            estimateLabel={t(locale, "Estimated hours", "Ore stimate")}
            submitLabel={t(locale, "Save subtask", "Salva sottoattività")}
            showSubmitButton={false}
          />
        </QuoteActionModal>
      ) : null}

      {activeEntryQuote ? (
        <QuoteActionModal
          title={t(locale, "Add logged hours", "Aggiungi ore registrate")}
          closeHref={detailHref}
          successRedirectHref={detailHref}
          action={addQuoteSubtaskEntryAction}
          closeLabel={t(locale, "Close", "Chiudi")}
          cancelLabel={t(locale, "Cancel", "Annulla")}
          submitLabel={t(locale, "Save entry", "Salva voce")}
          submittingLabel={t(locale, "Saving…", "Salvataggio in corso…")}
          successMessage={t(locale, "Logged entry saved", "Voce registrata salvata")}
          genericErrorMessage={t(locale, "Unable to save logged entry", "Impossibile salvare la voce registrata")}
        >
          <input type="hidden" name="quoteId" value={activeEntryQuote.id} />
          <div className="space-y-1.5">
            <label htmlFor="worker-quote-subtask-id" className="text-sm font-medium text-foreground">{t(locale, "Subtask", "Sottoattività")}</label>
            <select id="worker-quote-subtask-id" name="quoteSubtaskId" required className={quotesInputClass} defaultValue="">
              <option value="">{t(locale, "Select subtask", "Seleziona sottoattività")}</option>
              {subtasks.map((subtask) => (
                <option key={subtask.id} value={subtask.id}>{subtask.title}</option>
              ))}
            </select>
          </div>
          <QuotesWorkerEntryForm
            estimateLabel={t(locale, "Logged hours", "Ore registrate")}
            estimateName="loggedHours"
            estimateId="worker-quote-entry-hours"
            noteLabel={t(locale, "Note", "Nota")}
            submitLabel={t(locale, "Save entry", "Salva voce")}
            showSubmitButton={false}
          />
        </QuoteActionModal>
      ) : null}
    </main>
  );
}
