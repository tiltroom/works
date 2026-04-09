import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addQuoteSubtaskAction,
  addQuoteSubtaskEntryAction,
  assignQuoteWorkersAction,
  deleteQuoteSubtaskAction,
  deleteQuoteSubtaskEntryAction,
  loadQuotesPageData,
  markQuoteAsPaidAction,
  revertQuoteToDraftAction,
  signQuoteAction,
  switchQuoteToPostpaidAction,
  updateQuoteSubtaskAction,
  updateQuoteSubtaskEntryAction,
} from "@/app/actions/quotes";
import { LogoutButton } from "@/components/logout-button";
import {
  QuotesCommentsList,
  QuotesHeader,
  QuoteActionModal,
  QuotesRichTextContent,
  QuotesSectionCard,
  QuotesSignatureSummary,
  QuotesSubtaskCard,
  QuotesSubtaskForm,
  QuotesWorkerEntriesCard,
  QuotesWorkerEntryForm,
  quotesInputClass,
  quotesPrimaryButtonClass,
  quotesSecondaryButtonClass,
} from "@/components/quotes";
import { QueryToast } from "@/components/ui/query-toast";
import { requireRole } from "@/lib/auth";
import { localeTag, t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import {
  formatCurrencyAmount,
  formatQuoteHours,
  formatQuoteStatus,
  getQuoteStatusTone,
} from "@/lib/quotes";
import { createClient } from "@/lib/supabase/server";
import type { QueryToastVariant } from "@/lib/query-toast";

export const dynamic = "force-dynamic";

function formatDateTime(tag: string, value: string | null) {
  return value ? new Date(value).toLocaleString(tag) : "—";
}

export default async function AdminQuoteViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }> | { quoteId: string };
  searchParams?: Promise<{ assignWorkersId?: string; signQuoteId?: string; revertQuoteId?: string; switchToPostpaidQuoteId?: string; markPaidQuoteId?: string; addSubtaskQuoteId?: string; editSubtaskId?: string; deleteSubtaskId?: string; entryQuoteId?: string; editEntryId?: string; deleteEntryId?: string; toast?: string; toastMessage?: string }> | { assignWorkersId?: string; signQuoteId?: string; revertQuoteId?: string; switchToPostpaidQuoteId?: string; markPaidQuoteId?: string; addSubtaskQuoteId?: string; editSubtaskId?: string; deleteSubtaskId?: string; entryQuoteId?: string; editEntryId?: string; deleteEntryId?: string; toast?: string; toastMessage?: string };
}) {
  const locale = await getLocale();
  const tag = localeTag(locale);
  await requireRole(["admin"]);
  const supabase = await createClient();
  const routeParams = await Promise.resolve(params);
  const quoteId = routeParams.quoteId?.trim();
  const detailHref = `/admin/quotes/${quoteId}`;
  const paramsValue = await Promise.resolve(searchParams ?? {});
  const assignWorkersId = paramsValue.assignWorkersId?.trim();
  const signQuoteId = paramsValue.signQuoteId?.trim();
  const revertQuoteId = paramsValue.revertQuoteId?.trim();
  const switchToPostpaidQuoteId = paramsValue.switchToPostpaidQuoteId?.trim();
  const markPaidQuoteId = paramsValue.markPaidQuoteId?.trim();
  const addSubtaskQuoteId = paramsValue.addSubtaskQuoteId?.trim();
  const editSubtaskId = paramsValue.editSubtaskId?.trim();
  const deleteSubtaskId = paramsValue.deleteSubtaskId?.trim();
  const entryQuoteId = paramsValue.entryQuoteId?.trim();
  const editEntryId = paramsValue.editEntryId?.trim();
  const deleteEntryId = paramsValue.deleteEntryId?.trim();
  const toastTypeParam = paramsValue.toast?.trim();
  const toastMessageParam = paramsValue.toastMessage?.trim();
  const activeToast = (toastTypeParam === "success" || toastTypeParam === "error") && toastMessageParam
    ? { variant: toastTypeParam as QueryToastVariant, message: toastMessageParam }
    : null;

  const [{ data: workersFromDb }, quotesData] = await Promise.all([
    supabase.from("profiles").select("id,full_name").eq("role", "worker").order("full_name", { ascending: true }),
    loadQuotesPageData("admin", ""),
  ]);

  const quote = quotesData.quotes.find((entry) => entry.id === quoteId) ?? null;
  if (!quote) {
    notFound();
  }

  const workerOptions = (workersFromDb ?? []).map((worker) => ({ id: String(worker.id), name: worker.full_name?.trim() || String(worker.id) }));
  const assignedWorkers = quotesData.workers.filter((assignment) => assignment.quoteId === quote.id);
  const subtasks = quotesData.subtasks.filter((subtask) => subtask.quoteId === quote.id);
  const subtaskById = new Map(subtasks.map((subtask) => [subtask.id, subtask]));
  const subtaskIds = new Set(subtasks.map((subtask) => subtask.id));
  const entries = quotesData.subtaskEntries.filter((entry) => subtaskIds.has(entry.quoteSubtaskId));
  const comments = quotesData.comments.filter((comment) => comment.quoteId === quote.id);
  const quotePrepaymentSessions = quotesData.prepaymentSessions.filter((session) => session.quoteId === quote.id);
  const latestPrepayment = quotesData.prepaymentSessions.find((session) => session.quoteId === quote.id) ?? null;
  const hasPrepaymentActivity = quotePrepaymentSessions.some((session) => session.status === "pending" || session.status === "paid");
  const isPostPaid = quote.billingMode === "postpaid";
  const canAssignWorkers = quote.status === "draft";
  const canSign = quote.status === "draft";
  const canRevertToDraft = quote.status === "signed";
  const canSwitchToPostpaid = quote.status === "signed" && !quote.linkedProjectName && !isPostPaid && !hasPrepaymentActivity;
  const canMarkAsPaid = quote.status === "signed" && !quote.linkedProjectName && (isPostPaid || !hasPrepaymentActivity);
  const canManageSubtasks = quote.status === "draft";
  const canManageEntries = quote.status === "draft";
  const activeAssignQuote = canAssignWorkers && assignWorkersId === quote.id ? quote : null;
  const activeSignQuote = signQuoteId === quote.id ? quote : null;
  const activeRevertQuote = canRevertToDraft && revertQuoteId === quote.id ? quote : null;
  const activeSwitchToPostpaidQuote = canSwitchToPostpaid && switchToPostpaidQuoteId === quote.id ? quote : null;
  const activeMarkPaidQuote = canMarkAsPaid && markPaidQuoteId === quote.id ? quote : null;
  const activeAddSubtaskQuote = addSubtaskQuoteId === quote.id ? quote : null;
  const activeEditSubtask = subtasks.find((subtask) => subtask.id === editSubtaskId) ?? null;
  const activeDeleteSubtask = subtasks.find((subtask) => subtask.id === deleteSubtaskId) ?? null;
  const activeEntryQuote = entryQuoteId === quote.id ? quote : null;
  const activeEditEntry = entries.find((entry) => entry.id === editEntryId) ?? null;
  const activeDeleteEntry = entries.find((entry) => entry.id === deleteEntryId) ?? null;
  const activeEditEntrySubtask = activeEditEntry ? subtaskById.get(activeEditEntry.quoteSubtaskId) ?? null : null;
  const activeDeleteEntrySubtask = activeDeleteEntry ? subtaskById.get(activeDeleteEntry.quoteSubtaskId) ?? null : null;

  return (
    <main className="w-full">
      {activeToast ? <QueryToast variant={activeToast.variant} message={activeToast.message} closeLabel={t(locale, "Close", "Chiudi")} /> : null}

      <header className="mb-8 flex flex-col justify-between gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-center">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link href="/admin/quotes" className="rounded-full border border-border/70 bg-background/60 px-3 py-1 transition-colors hover:bg-accent hover:text-accent-foreground">
              ← {t(locale, "Back to quotes", "Torna ai preventivi")}
            </Link>
          </div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
            <span className="rounded-lg bg-red-500/10 p-2 text-red-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
              </svg>
            </span>
            {t(locale, "Quote review", "Revisione preventivo")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t(locale, "Review one quote at a time, keep worker staffing aligned, and complete sign-off from the dedicated admin detail page.", "Rivedi un preventivo alla volta, mantieni allineata l'assegnazione operatori e completa la firma dalla pagina dedicata di dettaglio admin.")}
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
          action={(
            <div className="flex flex-wrap items-center gap-2">
              {canAssignWorkers ? <Link href={`${detailHref}?assignWorkersId=${quote.id}`} className={quotesSecondaryButtonClass}>{t(locale, "Assign workers", "Assegna operatori")}</Link> : null}
              {canSign ? <Link href={`${detailHref}?signQuoteId=${quote.id}`} className={quotesPrimaryButtonClass}>{t(locale, "Sign", "Firma")}</Link> : null}
              {canRevertToDraft ? <Link href={`${detailHref}?revertQuoteId=${quote.id}`} className={quotesSecondaryButtonClass}>{t(locale, "Back to draft", "Torna in bozza")}</Link> : null}
              {canSwitchToPostpaid ? <Link href={`${detailHref}?switchToPostpaidQuoteId=${quote.id}`} className={quotesSecondaryButtonClass}>{t(locale, "Switch to post-paid", "Converti in post-pagato")}</Link> : null}
              {canMarkAsPaid ? <Link href={`${detailHref}?markPaidQuoteId=${quote.id}`} className={quotesPrimaryButtonClass}>{quote.billingMode === "postpaid" ? t(locale, "Convert (post-paid)", "Converti (post-pagato)") : t(locale, "Mark as (pre)paid", "Segna come (pre) pagato")}</Link> : null}
            </div>
          )}
          meta={[
            { label: t(locale, "Customer", "Cliente"), value: quote.customerName || t(locale, "Unknown", "Sconosciuto") },
            { label: t(locale, "Billing", "Fatturazione"), value: quote.billingMode === "postpaid" ? t(locale, "Post-paid", "Post-pagato") : t(locale, "Prepaid", "Prepagato") },
            { label: t(locale, "Estimated", "Stimato"), value: formatQuoteHours(quote.totalEstimatedHours), tone: "accent" },
            { label: t(locale, "Logged", "Registrato"), value: formatQuoteHours(quote.totalLoggedHours) },
            { label: t(locale, "Updated", "Aggiornato"), value: formatDateTime(tag, quote.updatedAt) },
          ]}
        />

        <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
          <QuotesSectionCard title={t(locale, "Quote content", "Contenuto del preventivo")}>
            <QuotesRichTextContent html={quote.contentHtml ?? ""} emptyMessage={t(locale, "No rich text body provided yet.", "Nessun corpo rich text ancora fornito.")} />
          </QuotesSectionCard>

          <QuotesSignatureSummary
            title={t(locale, "Signature", "Firma")}
            signerLabel={t(locale, "Signer", "Firmatario")}
            signedAtTitle={t(locale, "Signed at", "Firmato il")}
            signerName={quote.signedByName}
            signedAtLabel={formatDateTime(tag, quote.signedAt)}
            emptyMessage={t(locale, "Not signed yet.", "Non ancora firmato.")}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <QuotesSectionCard title={t(locale, "Assigned workers", "Operatori assegnati")}>
            <div className="space-y-2">
              {assignedWorkers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t(locale, "No workers assigned yet.", "Nessun operatore assegnato.")}</p>
              ) : (
                assignedWorkers.map((assignment) => (
                  <div key={`${assignment.quoteId}:${assignment.workerId}`} className="rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-sm">
                    <p className="font-medium text-foreground">{assignment.workerName || assignment.workerId}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(tag, assignment.assignedAt)}</p>
                  </div>
                ))
              )}
            </div>
          </QuotesSectionCard>

          <QuotesSectionCard title={t(locale, "Prepayment / conversion", "Prepagamento / conversione")}>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>{quote.linkedProjectName ? t(locale, "Converted into project", "Convertito nel progetto") : isPostPaid ? t(locale, "Awaiting admin conversion after sign-off.", "In attesa della conversione admin dopo la firma.") : t(locale, "Awaiting checkout conversion after sign-off.", "In attesa del checkout di conversione dopo la firma.")}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t(locale, "Latest prepayment", "Ultimo prepagamento")}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{latestPrepayment ? formatCurrencyAmount(latestPrepayment.amountCents, latestPrepayment.currency) : "—"}</p>
                  {latestPrepayment ? <p className="mt-1 text-xs text-muted-foreground">{latestPrepayment.status === "paid" ? t(locale, "Paid", "Pagato") : t(locale, "Pending", "In attesa")}</p> : null}
                </div>
                <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t(locale, "Linked project", "Progetto collegato")}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{quote.linkedProjectName || "—"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(tag, quote.convertedAt)}</p>
                </div>
              </div>
            </div>
          </QuotesSectionCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <QuotesSubtaskCard
            title={t(locale, "Subtasks", "Sottoattività")}
            description={t(locale, "Review the breakdown produced by workers before signing.", "Rivedi la scomposizione prodotta dagli operatori prima della firma.")}
            action={canManageSubtasks ? <Link href={`${detailHref}?addSubtaskQuoteId=${quote.id}#manage-subtask`} className={quotesSecondaryButtonClass}>{t(locale, "Add subtask", "Aggiungi sottoattività")}</Link> : null}
            items={subtasks.map((subtask) => ({
              id: subtask.id,
              title: subtask.title,
              description: subtask.description,
              estimateLabel: formatQuoteHours(subtask.estimatedHours),
              loggedLabel: formatQuoteHours(entries.filter((entry) => entry.quoteSubtaskId === subtask.id).reduce((total, entry) => total + entry.loggedHours, 0)),
              footer: canManageSubtasks ? (
                <div className="flex flex-wrap gap-2">
                  <Link href={`${detailHref}?editSubtaskId=${subtask.id}#manage-subtask`} className={quotesSecondaryButtonClass}>{t(locale, "Edit", "Modifica")}</Link>
                  <Link href={`${detailHref}?deleteSubtaskId=${subtask.id}#manage-subtask`} className={quotesSecondaryButtonClass}>{t(locale, "Delete", "Elimina")}</Link>
                </div>
              ) : null,
            }))}
            emptyMessage={t(locale, "No subtasks yet.", "Nessuna sottoattività ancora.")}
          />

          <QuotesWorkerEntriesCard
            title={t(locale, "Logged entries", "Voci registrate")}
            description={t(locale, "Actual work captured against subtasks during draft stage.", "Lavoro effettivo registrato sulle sottoattività durante la fase di bozza.")}
            action={canManageEntries ? <Link href={`${detailHref}?entryQuoteId=${quote.id}#manage-entry`} className={quotesSecondaryButtonClass}>{t(locale, "Add entry", "Aggiungi voce")}</Link> : null}
            items={entries.map((entry) => ({
              id: entry.id,
              workerName: entry.workerName || t(locale, "Worker", "Operatore"),
              subtaskTitle: subtasks.find((subtask) => subtask.id === entry.quoteSubtaskId)?.title ?? t(locale, "Unknown subtask", "Sottoattività sconosciuta"),
              loggedLabel: formatQuoteHours(entry.loggedHours),
              note: entry.note,
              metaLabel: formatDateTime(tag, entry.createdAt),
              action: canManageEntries ? (
                <div className="flex flex-wrap gap-2">
                  <Link href={`${detailHref}?editEntryId=${entry.id}#manage-entry`} className={quotesSecondaryButtonClass}>{t(locale, "Edit", "Modifica")}</Link>
                  <Link href={`${detailHref}?deleteEntryId=${entry.id}#manage-entry`} className={quotesSecondaryButtonClass}>{t(locale, "Delete", "Elimina")}</Link>
                </div>
              ) : null,
            }))}
            emptyMessage={t(locale, "No logged entries yet.", "Nessuna voce registrata ancora.")}
          />
        </div>

        <QuotesCommentsList
          title={t(locale, "Discussion", "Discussione")}
          description={t(locale, "Review customer and worker notes before sign-off.", "Rivedi note cliente e operatori prima della firma.")}
          comments={comments.map((comment) => ({
            id: comment.id,
            authorName: comment.authorName || t(locale, comment.authorRole === "admin" ? "Admin" : comment.authorRole === "customer" ? "Customer" : "Worker", comment.authorRole === "admin" ? "Admin" : comment.authorRole === "customer" ? "Cliente" : "Operatore"),
            createdAtLabel: formatDateTime(tag, comment.createdAt),
            metaLabel: comment.authorRole,
            body: <QuotesRichTextContent html={comment.commentHtml ?? ""} emptyMessage={t(locale, "No comment content", "Nessun contenuto commento")} />,
          }))}
          emptyMessage={t(locale, "No comments yet.", "Nessun commento ancora.")}
        />
      </section>

      {activeAssignQuote ? (
        <QuoteActionModal
          title={t(locale, "Assign workers", "Assegna operatori")}
          closeHref={detailHref}
          successRedirectHref={detailHref}
          action={assignQuoteWorkersAction}
          closeLabel={t(locale, "Close", "Chiudi")}
          cancelLabel={t(locale, "Cancel", "Annulla")}
          submitLabel={t(locale, "Save assignments", "Salva assegnazioni")}
          submittingLabel={t(locale, "Saving…", "Salvataggio in corso…")}
          successMessage={t(locale, "Assignments saved", "Assegnazioni salvate")}
          genericErrorMessage={t(locale, "Unable to save assignments", "Impossibile salvare le assegnazioni")}
        >
          <input type="hidden" name="quoteId" value={activeAssignQuote.id} />
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">{t(locale, "Only draft quotes can be staffed before the worker collaboration phase starts.", "Solo i preventivi in bozza possono essere assegnati prima che inizi la collaborazione degli operatori.")}</p>
            <label htmlFor="assign-worker-select" className="text-sm font-medium text-foreground">{t(locale, "Workers", "Operatori")}</label>
            <select id="assign-worker-select" name="workerIds" multiple className={`${quotesInputClass} min-h-40`} defaultValue={assignedWorkers.map((assignment) => assignment.workerId)}>
              {workerOptions.map((worker) => (
                <option key={worker.id} value={worker.id}>{worker.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t(locale, "Hold Command/Ctrl to select multiple workers.", "Tieni premuto Command/Ctrl per selezionare più operatori.")}</p>
          </div>
        </QuoteActionModal>
      ) : null}

      {activeEntryQuote ? (
        <QuoteActionModal
          title={t(locale, "Add logged entry", "Aggiungi voce registrata")}
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
            <label htmlFor="admin-quote-subtask-id" className="text-sm font-medium text-foreground">{t(locale, "Subtask", "Sottoattività")}</label>
            <select id="admin-quote-subtask-id" name="quoteSubtaskId" required className={quotesInputClass} defaultValue="">
              <option value="">{t(locale, "Select subtask", "Seleziona sottoattività")}</option>
              {subtasks.map((subtask) => (
                <option key={subtask.id} value={subtask.id}>{subtask.title}</option>
              ))}
            </select>
          </div>
          <QuotesWorkerEntryForm
            estimateLabel={t(locale, "Logged hours", "Ore registrate")}
            estimateName="loggedHours"
            estimateId="admin-quote-entry-hours"
            noteLabel={t(locale, "Note", "Nota")}
            submitLabel={t(locale, "Save entry", "Salva voce")}
            showSubmitButton={false}
          />
        </QuoteActionModal>
      ) : null}

      {activeAddSubtaskQuote ? (
        <QuoteActionModal
          title={t(locale, "Add subtask", "Aggiungi sottoattività")}
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
          <input type="hidden" name="quoteId" value={activeAddSubtaskQuote.id} />
          <QuotesSubtaskForm
            titleLabel={t(locale, "Title", "Titolo")}
            titleId="admin-add-quote-subtask-title"
            descriptionLabel={t(locale, "Description", "Descrizione")}
            descriptionId="admin-add-quote-subtask-description"
            estimateLabel={t(locale, "Estimated hours", "Ore stimate")}
            estimateId="admin-add-quote-subtask-hours"
            submitLabel={t(locale, "Save subtask", "Salva sottoattività")}
            showSubmitButton={false}
          />
        </QuoteActionModal>
      ) : null}

      {activeEditSubtask ? (
        <QuoteActionModal
          title={t(locale, "Edit subtask", "Modifica sottoattività")}
          closeHref={detailHref}
          successRedirectHref={detailHref}
          action={updateQuoteSubtaskAction}
          closeLabel={t(locale, "Close", "Chiudi")}
          cancelLabel={t(locale, "Cancel", "Annulla")}
          submitLabel={t(locale, "Update subtask", "Aggiorna sottoattività")}
          submittingLabel={t(locale, "Updating…", "Aggiornamento in corso…")}
          successMessage={t(locale, "Subtask updated", "Sottoattività aggiornata")}
          genericErrorMessage={t(locale, "Unable to update subtask", "Impossibile aggiornare la sottoattività")}
        >
          <input type="hidden" name="quoteId" value={quote.id} />
          <input type="hidden" name="subtaskId" value={activeEditSubtask.id} />
          <QuotesSubtaskForm
            titleLabel={t(locale, "Title", "Titolo")}
            titleId="admin-edit-quote-subtask-title"
            titleDefaultValue={activeEditSubtask.title}
            descriptionLabel={t(locale, "Description", "Descrizione")}
            descriptionId="admin-edit-quote-subtask-description"
            descriptionDefaultValue={activeEditSubtask.description ?? ""}
            estimateLabel={t(locale, "Estimated hours", "Ore stimate")}
            estimateId="admin-edit-quote-subtask-hours"
            estimateDefaultValue={activeEditSubtask.estimatedHours}
            submitLabel={t(locale, "Update subtask", "Aggiorna sottoattività")}
            showSubmitButton={false}
          />
        </QuoteActionModal>
      ) : null}

      {activeDeleteSubtask ? (
        <QuoteActionModal
          title={t(locale, "Delete subtask", "Elimina sottoattività")}
          closeHref={detailHref}
          successRedirectHref={detailHref}
          action={deleteQuoteSubtaskAction}
          closeLabel={t(locale, "Close", "Chiudi")}
          cancelLabel={t(locale, "Cancel", "Annulla")}
          submitLabel={t(locale, "Delete subtask", "Elimina sottoattività")}
          submittingLabel={t(locale, "Deleting…", "Eliminazione in corso…")}
          successMessage={t(locale, "Subtask deleted", "Sottoattività eliminata")}
          genericErrorMessage={t(locale, "Unable to delete subtask", "Impossibile eliminare la sottoattività")}
        >
          <input type="hidden" name="quoteId" value={quote.id} />
          <input type="hidden" name="subtaskId" value={activeDeleteSubtask.id} />
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t(locale, "Please confirm that you want to permanently remove this subtask from the draft quote. Any logged entries attached to it will also be removed.", "Conferma di voler rimuovere definitivamente questa sottoattività dal preventivo in bozza. Anche le voci registrate collegate verranno eliminate.")}
            </p>
            <div className="rounded-xl border border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{activeDeleteSubtask.title}</p>
              <p className="mt-1">{formatQuoteHours(activeDeleteSubtask.estimatedHours)}</p>
              {activeDeleteSubtask.description ? <p className="mt-2 leading-5">{activeDeleteSubtask.description}</p> : null}
            </div>
          </div>
        </QuoteActionModal>
      ) : null}

      {activeEditEntry && activeEditEntrySubtask ? (
        <QuoteActionModal
          title={t(locale, "Edit logged entry", "Modifica voce registrata")}
          closeHref={detailHref}
          successRedirectHref={detailHref}
          action={updateQuoteSubtaskEntryAction}
          closeLabel={t(locale, "Close", "Chiudi")}
          cancelLabel={t(locale, "Cancel", "Annulla")}
          submitLabel={t(locale, "Update entry", "Aggiorna voce")}
          submittingLabel={t(locale, "Updating…", "Aggiornamento in corso…")}
          successMessage={t(locale, "Logged entry updated", "Voce registrata aggiornata")}
          genericErrorMessage={t(locale, "Unable to update logged entry", "Impossibile aggiornare la voce registrata")}
        >
          <input type="hidden" name="quoteId" value={quote.id} />
          <input type="hidden" name="entryId" value={activeEditEntry.id} />
          <div className="space-y-1.5">
            <label htmlFor="admin-edit-quote-subtask-id" className="text-sm font-medium text-foreground">{t(locale, "Subtask", "Sottoattività")}</label>
            <select id="admin-edit-quote-subtask-id" name="quoteSubtaskId" required className={quotesInputClass} defaultValue={activeEditEntry.quoteSubtaskId}>
              {subtasks.map((subtask) => (
                <option key={subtask.id} value={subtask.id}>{subtask.title}</option>
              ))}
            </select>
          </div>
          <QuotesWorkerEntryForm
            estimateLabel={t(locale, "Logged hours", "Ore registrate")}
            estimateName="loggedHours"
            estimateId="admin-edit-quote-entry-hours"
            estimateDefaultValue={activeEditEntry.loggedHours}
            noteLabel={t(locale, "Note", "Nota")}
            noteDefaultValue={activeEditEntry.note ?? ""}
            submitLabel={t(locale, "Update entry", "Aggiorna voce")}
            showSubmitButton={false}
          />
        </QuoteActionModal>
      ) : null}

      {activeDeleteEntry ? (
        <QuoteActionModal
          title={t(locale, "Delete logged entry", "Elimina voce registrata")}
          closeHref={detailHref}
          successRedirectHref={detailHref}
          action={deleteQuoteSubtaskEntryAction}
          closeLabel={t(locale, "Close", "Chiudi")}
          cancelLabel={t(locale, "Cancel", "Annulla")}
          submitLabel={t(locale, "Delete entry", "Elimina voce")}
          submittingLabel={t(locale, "Deleting…", "Eliminazione in corso…")}
          successMessage={t(locale, "Logged entry deleted", "Voce registrata eliminata")}
          genericErrorMessage={t(locale, "Unable to delete logged entry", "Impossibile eliminare la voce registrata")}
        >
          <input type="hidden" name="quoteId" value={quote.id} />
          <input type="hidden" name="entryId" value={activeDeleteEntry.id} />
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t(locale, "Please confirm that you want to permanently remove this logged entry from the draft quote.", "Conferma di voler rimuovere definitivamente questa voce registrata dal preventivo in bozza.")}
            </p>
            <div className="rounded-xl border border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{activeDeleteEntrySubtask?.title ?? t(locale, "Unknown subtask", "Sottoattività sconosciuta")}</p>
              <p className="mt-1">{formatQuoteHours(activeDeleteEntry.loggedHours)}</p>
              {activeDeleteEntry.note ? <p className="mt-2 leading-5">{activeDeleteEntry.note}</p> : null}
            </div>
          </div>
        </QuoteActionModal>
      ) : null}

      {activeSignQuote ? (
        <QuoteActionModal
          title={t(locale, "Sign quote", "Firma preventivo")}
          closeHref={detailHref}
          successRedirectHref={detailHref}
          action={signQuoteAction}
          closeLabel={t(locale, "Close", "Chiudi")}
          cancelLabel={t(locale, "Cancel", "Annulla")}
          submitLabel={t(locale, "Apply signature", "Applica firma")}
          submittingLabel={t(locale, "Applying…", "Applicazione in corso…")}
          successMessage={t(locale, "Quote signed", "Preventivo firmato")}
          genericErrorMessage={t(locale, "Unable to sign quote", "Impossibile firmare il preventivo")}
        >
          <input type="hidden" name="quoteId" value={activeSignQuote.id} />
          <p className="text-sm text-muted-foreground">
            {t(locale, "Signing ends the editable draft phase and unlocks the customer’s single convert + prepay step.", "La firma chiude la fase di bozza modificabile e sblocca l'unico passaggio cliente di conversione + prepagamento.")}
          </p>
          <div className="rounded-xl border border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
            {t(locale, "The quote will be signed using your current admin profile name.", "Il preventivo verrà firmato usando il nome attuale del tuo profilo admin.")}
          </div>
        </QuoteActionModal>
      ) : null}

      {activeRevertQuote ? (
        <QuoteActionModal
          title={t(locale, "Return quote to draft", "Riporta il preventivo in bozza")}
          closeHref={detailHref}
          successRedirectHref={detailHref}
          action={revertQuoteToDraftAction}
          closeLabel={t(locale, "Close", "Chiudi")}
          cancelLabel={t(locale, "Cancel", "Annulla")}
          submitLabel={t(locale, "Return to draft", "Riporta in bozza")}
          submittingLabel={t(locale, "Returning…", "Ripristino in corso…")}
          successMessage={t(locale, "Quote returned to draft", "Preventivo riportato in bozza")}
          genericErrorMessage={t(locale, "Unable to return quote to draft", "Impossibile riportare il preventivo in bozza")}
        >
          <input type="hidden" name="quoteId" value={activeRevertQuote.id} />
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t(locale, "This clears the existing signature and reopens the quote for worker assignments, subtasks, entries, and discussion updates.", "Questa azione rimuove la firma esistente e riapre il preventivo per assegnazioni operatori, sottoattività, voci registrate e aggiornamenti della discussione.")}
            </p>
            <div className="rounded-xl border border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{activeRevertQuote.title}</p>
              <p className="mt-1">{t(locale, "Use this only when no conversion checkout has started for the quote.", "Usa questa azione solo quando non è ancora iniziato alcun checkout di conversione per il preventivo.")}</p>
            </div>
          </div>
        </QuoteActionModal>
      ) : null}

      {activeSwitchToPostpaidQuote ? (
        <QuoteActionModal
          title={t(locale, "Switch quote to post-paid", "Converti il preventivo in post-pagato")}
          closeHref={detailHref}
          successRedirectHref={detailHref}
          action={switchQuoteToPostpaidAction}
          closeLabel={t(locale, "Close", "Chiudi")}
          cancelLabel={t(locale, "Cancel", "Annulla")}
          submitLabel={t(locale, "Switch billing mode", "Cambia modalità fatturazione")}
          submittingLabel={t(locale, "Switching…", "Cambio in corso…")}
          successMessage={t(locale, "Quote switched to post-paid", "Preventivo convertito in post-pagato")}
          genericErrorMessage={t(locale, "Unable to switch quote to post-paid", "Impossibile convertire il preventivo in post-pagato")}
        >
          <input type="hidden" name="quoteId" value={activeSwitchToPostpaidQuote.id} />
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t(locale, "This changes the signed quote from prepaid to post-paid. After the switch, use the post-paid convert action to create the live project without a prepaid hours purchase.", "Questa azione cambia il preventivo firmato da prepagato a post-pagato. Dopo il cambio, usa l'azione di conversione post-pagata per creare il progetto attivo senza un acquisto di ore prepagate.")}
            </p>
            <div className="rounded-xl border border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{activeSwitchToPostpaidQuote.title}</p>
              <p className="mt-1">{t(locale, "Current billing mode: Prepaid", "Modalità attuale: Prepagato")}</p>
              <p className="mt-1">{t(locale, "New billing mode: Post-paid", "Nuova modalità: Post-pagato")}</p>
              <p className="mt-1">{t(locale, "This is available only before any prepayment session starts.", "Questa opzione è disponibile solo prima che inizi qualsiasi sessione di prepagamento.")}</p>
            </div>
          </div>
        </QuoteActionModal>
      ) : null}

      {activeMarkPaidQuote ? (
        <QuoteActionModal
          title={activeMarkPaidQuote.billingMode === "postpaid" ? t(locale, "Convert post-paid quote", "Converti preventivo post-pagato") : t(locale, "Mark quote as paid", "Segna il preventivo come pagato")}
          closeHref={detailHref}
          successRedirectHref={detailHref}
          action={markQuoteAsPaidAction}
          closeLabel={t(locale, "Close", "Chiudi")}
          cancelLabel={t(locale, "Cancel", "Annulla")}
          submitLabel={activeMarkPaidQuote.billingMode === "postpaid" ? t(locale, "Convert quote", "Converti preventivo") : t(locale, "Mark as (pre)paid", "Segna come (pre) pagato")}
          submittingLabel={t(locale, "Processing…", "Elaborazione in corso…")}
          successMessage={activeMarkPaidQuote.billingMode === "postpaid" ? t(locale, "Post-paid quote converted", "Preventivo post-pagato convertito") : t(locale, "Quote marked as paid", "Preventivo segnato come pagato")}
          genericErrorMessage={activeMarkPaidQuote.billingMode === "postpaid" ? t(locale, "Unable to convert post-paid quote", "Impossibile convertire il preventivo post-pagato") : t(locale, "Unable to mark quote as paid", "Impossibile segnare il preventivo come pagato")}
        >
          <input type="hidden" name="quoteId" value={activeMarkPaidQuote.id} />
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                {activeMarkPaidQuote.billingMode === "postpaid"
                  ? t(locale, "This immediately converts the signed post-paid quote into a live project without creating a prepaid hours purchase.", "Questa azione converte subito il preventivo post-pagato firmato in un progetto attivo senza creare un acquisto di ore prepagate.")
                  : t(locale, "This skips Stripe checkout and immediately converts the signed quote into a live project with the estimated hours credited as a manual payment entry.", "Questa azione salta il checkout Stripe e converte subito il preventivo firmato in un progetto attivo, accreditando le ore stimate come voce di pagamento manuale.")}
            </p>
            <div className="rounded-xl border border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{activeMarkPaidQuote.title}</p>
                <p className="mt-1">{activeMarkPaidQuote.billingMode === "postpaid"
                  ? t(locale, "Use this to convert a signed post-paid quote into its project once admin review is complete.", "Usa questa azione per convertire un preventivo post-pagato firmato nel relativo progetto una volta completata la revisione admin.")
                  : t(locale, "Use this only when the customer has already settled the quote outside the platform and no Stripe prepayment has started.", "Usa questa azione solo quando il cliente ha già saldato il preventivo fuori piattaforma e non è stato avviato alcun prepagamento Stripe.")}</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="admin-mark-paid-comment" className="text-sm font-medium text-foreground">{t(locale, "Internal note (optional)", "Nota interna (facoltativa)")}</label>
              <textarea
                id="admin-mark-paid-comment"
                name="adminComment"
                rows={3}
                className={`${quotesInputClass} min-h-24`}
                placeholder={t(locale, "Example: settled by bank transfer on site", "Esempio: saldato tramite bonifico fuori piattaforma")}
              />
            </div>
          </div>
        </QuoteActionModal>
      ) : null}
    </main>
  );
}
