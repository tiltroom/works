import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addQuoteSubtaskAction,
  addQuoteSubtaskEntryAction,
  assignQuoteWorkersAction,
  deleteQuoteSubtaskAction,
  deleteQuoteSubtaskEntryAction,
  loadQuotesPageData,
  signQuoteAction,
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
  searchParams?: Promise<{ assignWorkersId?: string; signQuoteId?: string; addSubtaskQuoteId?: string; editSubtaskId?: string; deleteSubtaskId?: string; entryQuoteId?: string; editEntryId?: string; deleteEntryId?: string; toast?: string; toastMessage?: string }> | { assignWorkersId?: string; signQuoteId?: string; addSubtaskQuoteId?: string; editSubtaskId?: string; deleteSubtaskId?: string; entryQuoteId?: string; editEntryId?: string; deleteEntryId?: string; toast?: string; toastMessage?: string };
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
  const latestPrepayment = quotesData.prepaymentSessions.find((session) => session.quoteId === quote.id) ?? null;
  const activeAssignQuote = assignWorkersId === quote.id ? quote : null;
  const activeSignQuote = signQuoteId === quote.id ? quote : null;
  const activeAddSubtaskQuote = addSubtaskQuoteId === quote.id ? quote : null;
  const activeEditSubtask = subtasks.find((subtask) => subtask.id === editSubtaskId) ?? null;
  const activeDeleteSubtask = subtasks.find((subtask) => subtask.id === deleteSubtaskId) ?? null;
  const activeEntryQuote = entryQuoteId === quote.id ? quote : null;
  const activeEditEntry = entries.find((entry) => entry.id === editEntryId) ?? null;
  const activeDeleteEntry = entries.find((entry) => entry.id === deleteEntryId) ?? null;
  const activeEditEntrySubtask = activeEditEntry ? subtaskById.get(activeEditEntry.quoteSubtaskId) ?? null : null;
  const activeDeleteEntrySubtask = activeDeleteEntry ? subtaskById.get(activeDeleteEntry.quoteSubtaskId) ?? null : null;
  const canAssignWorkers = quote.status === "draft";
  const canSign = quote.status === "draft";
  const canManageSubtasks = quote.status === "draft";
  const canManageEntries = quote.status === "draft";

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
              {canAssignWorkers ? <Link href={`${detailHref}?assignWorkersId=${quote.id}#assign-workers`} className={quotesSecondaryButtonClass}>{t(locale, "Assign workers", "Assegna operatori")}</Link> : null}
              {canSign ? <Link href={`${detailHref}?signQuoteId=${quote.id}`} className={quotesPrimaryButtonClass}>{t(locale, "Sign", "Firma")}</Link> : null}
            </div>
          )}
          meta={[
            { label: t(locale, "Customer", "Cliente"), value: quote.customerName || t(locale, "Unknown", "Sconosciuto") },
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
              <p>{quote.linkedProjectName ? t(locale, "Converted into project", "Convertito nel progetto") : t(locale, "Awaiting checkout conversion after sign-off.", "In attesa del checkout di conversione dopo la firma.")}</p>
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
        <section id="assign-workers" className="mt-8 scroll-mt-24">
          <QuotesSectionCard
            title={t(locale, "Assign workers", "Assegna operatori")}
            description={t(locale, "Only draft quotes can be staffed before the worker collaboration phase starts.", "Solo i preventivi in bozza possono essere assegnati prima che inizi la collaborazione degli operatori.")}
            action={<Link href={detailHref} className={quotesSecondaryButtonClass}>{t(locale, "Close", "Chiudi")}</Link>}
          >
            <form action={assignQuoteWorkersAction} className="space-y-4">
              <input type="hidden" name="quoteId" value={activeAssignQuote.id} />
              <div className="space-y-1.5">
                <label htmlFor="assign-worker-select" className="text-sm font-medium text-foreground">{t(locale, "Workers", "Operatori")}</label>
                <select id="assign-worker-select" name="workerIds" multiple className={`${quotesInputClass} min-h-40`} defaultValue={assignedWorkers.map((assignment) => assignment.workerId)}>
                  {workerOptions.map((worker) => (
                    <option key={worker.id} value={worker.id}>{worker.name}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">{t(locale, "Hold Command/Ctrl to select multiple workers.", "Tieni premuto Command/Ctrl per selezionare più operatori.")}</p>
              </div>
              <div className="flex justify-end">
                <button className={quotesPrimaryButtonClass}>{t(locale, "Save assignments", "Salva assegnazioni")}</button>
              </div>
            </form>
          </QuotesSectionCard>
        </section>
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
        <section className="mt-8">
          <QuotesSectionCard
            title={t(locale, "Sign quote", "Firma preventivo")}
            description={t(locale, "Signing ends the editable draft phase and unlocks the customer’s single convert + prepay step.", "La firma chiude la fase di bozza modificabile e sblocca l'unico passaggio cliente di conversione + prepagamento.")}
            action={<Link href={detailHref} className={quotesSecondaryButtonClass}>{t(locale, "Close", "Chiudi")}</Link>}
          >
            <form action={signQuoteAction} className="space-y-4">
              <input type="hidden" name="quoteId" value={activeSignQuote.id} />
              <div className="space-y-1.5">
                <label htmlFor="admin-signature-name" className="text-sm font-medium text-foreground">{t(locale, "Signer name", "Nome del firmatario")}</label>
                <input id="admin-signature-name" name="signatureName" required defaultValue={activeSignQuote.signedByName ?? ""} className={quotesInputClass} placeholder={t(locale, "Maria Rossi", "Maria Rossi")} />
              </div>
              <div className="flex justify-end">
                <button className={quotesPrimaryButtonClass}>{t(locale, "Apply signature", "Applica firma")}</button>
              </div>
            </form>
          </QuotesSectionCard>
        </section>
      ) : null}
    </main>
  );
}
