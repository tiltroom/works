import Link from "next/link";
import {
  addQuoteCommentAction,
  addQuoteSubtaskAction,
  addQuoteSubtaskEntryAction,
  loadQuotesPageData,
} from "@/app/actions/quotes";
import { LogoutButton } from "@/components/logout-button";
import {
  QuotesCommentsList,
  QuotesHeader,
  QuotesRichTextContent,
  QuotesRichTextEditor,
  QuotesSectionCard,
  QuotesSubtaskCard,
  QuotesSubtaskForm,
  QuotesWorkerEntriesCard,
  QuotesWorkerEntryForm,
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

function formatDateTime(tag: string, value: string | null) {
  return value ? new Date(value).toLocaleString(tag) : "—";
}

export default async function WorkerQuotesPage({
  searchParams,
}: {
  searchParams?: Promise<{ commentQuoteId?: string; subtaskQuoteId?: string; entryQuoteId?: string; toast?: string; toastMessage?: string }> | { commentQuoteId?: string; subtaskQuoteId?: string; entryQuoteId?: string; toast?: string; toastMessage?: string };
}) {
  const locale = await getLocale();
  const tag = localeTag(locale);
  const profile = await requireRole(["worker"]);
  const params = await Promise.resolve(searchParams ?? {});
  const commentQuoteId = params.commentQuoteId?.trim();
  const subtaskQuoteId = params.subtaskQuoteId?.trim();
  const entryQuoteId = params.entryQuoteId?.trim();
  const toastTypeParam = params.toast?.trim();
  const toastMessageParam = params.toastMessage?.trim();
  const activeToast = (toastTypeParam === "success" || toastTypeParam === "error") && toastMessageParam
    ? { variant: toastTypeParam as QueryToastVariant, message: toastMessageParam }
    : null;

  const quotesData = await loadQuotesPageData("worker", profile.id);
  const activeCommentQuote = quotesData.quotes.find((quote) => quote.id === commentQuoteId) ?? null;
  const activeSubtaskQuote = quotesData.quotes.find((quote) => quote.id === subtaskQuoteId) ?? null;
  const activeEntryQuote = quotesData.quotes.find((quote) => quote.id === entryQuoteId) ?? null;

  return (
    <main className="w-full">
      {activeToast ? <QueryToast variant={activeToast.variant} message={activeToast.message} closeLabel={t(locale, "Close", "Chiudi")} /> : null}

      <header className="mb-8 flex flex-col justify-between gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-center">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link href="/worker" className="rounded-full border border-border/70 bg-background/60 px-3 py-1 transition-colors hover:bg-accent hover:text-accent-foreground">
              ← {t(locale, "Back to station", "Torna alla postazione")}
            </Link>
          </div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
            <span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h6m0 0l-3-3m3 3l-3 3M5 19h6a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
            {t(locale, "Worker Quotes Workspace", "Area preventivi operatore")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t(locale, "Add comments, break the work into subtasks, and log effort while the quote is still draft.", "Aggiungi commenti, suddividi il lavoro in sottoattività e registra lo sforzo mentre il preventivo è ancora in bozza.")}
          </p>
        </div>
        <LogoutButton />
      </header>

      <section className="space-y-6">
        {quotesData.quotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
            {t(locale, "No quotes assigned to you yet.", "Nessun preventivo assegnato per ora.")}
          </div>
        ) : null}

        {quotesData.quotes.map((quote) => {
          const assignedWorkers = quotesData.workers.filter((assignment) => assignment.quoteId === quote.id);
          const subtasks = quotesData.subtasks.filter((subtask) => subtask.quoteId === quote.id);
          const subtaskIds = new Set(subtasks.map((subtask) => subtask.id));
          const entries = quotesData.subtaskEntries.filter((entry) => subtaskIds.has(entry.quoteSubtaskId));
          const comments = quotesData.comments.filter((comment) => comment.quoteId === quote.id);
          const canMutate = quote.status === "draft";

          return (
            <article key={quote.id} className="space-y-4">
              <QuotesHeader
                title={quote.title}
                statusLabel={formatQuoteStatus(locale, quote.status)}
                statusTone={getQuoteStatusTone(quote.status)}
                description={quote.description || t(locale, "No summary provided yet.", "Nessuna sintesi fornita.")}
                action={canMutate ? (
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/worker/quotes?commentQuoteId=${quote.id}`} className={quotesSecondaryButtonClass}>{t(locale, "Comment", "Commenta")}</Link>
                    <Link href={`/worker/quotes?subtaskQuoteId=${quote.id}`} className={quotesSecondaryButtonClass}>{t(locale, "Add subtask", "Aggiungi sottoattività")}</Link>
                    <Link href={`/worker/quotes?entryQuoteId=${quote.id}`} className={quotesSecondaryButtonClass}>{t(locale, "Log hours", "Registra ore")}</Link>
                  </div>
                ) : null}
                meta={[
                  { label: t(locale, "Estimated", "Stimato"), value: formatQuoteHours(quote.totalEstimatedHours), tone: "accent" },
                  { label: t(locale, "Logged", "Registrato"), value: formatQuoteHours(quote.totalLoggedHours) },
                  { label: t(locale, "Assigned workers", "Operatori assegnati"), value: assignedWorkers.length },
                  { label: t(locale, "Updated", "Aggiornato"), value: formatDateTime(tag, quote.updatedAt) },
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
                          <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(tag, assignment.assignedAt)}</p>
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
                    metaLabel: formatDateTime(tag, entry.createdAt),
                  }))}
                  emptyMessage={t(locale, "No logged entries yet.", "Nessuna voce registrata ancora.")}
                />
              </div>

              <QuotesCommentsList
                title={t(locale, "Discussion", "Discussione")}
                description={t(locale, "Keep blockers, assumptions, and implementation notes visible to the whole quotes workflow.", "Mantieni visibili blocchi, assunzioni e note implementative lungo tutto il flusso dei preventivi.")}
                comments={comments.map((comment) => ({
                  id: comment.id,
                  authorName: comment.authorName || t(locale, comment.authorRole === "admin" ? "Admin" : comment.authorRole === "customer" ? "Customer" : "Worker", comment.authorRole === "admin" ? "Admin" : comment.authorRole === "customer" ? "Cliente" : "Operatore"),
                  createdAtLabel: formatDateTime(tag, comment.createdAt),
                  metaLabel: comment.authorRole,
                  body: <QuotesRichTextContent html={comment.commentHtml ?? ""} emptyMessage={t(locale, "No comment content", "Nessun contenuto commento")} />,
                }))}
                emptyMessage={t(locale, "No comments yet.", "Nessun commento ancora.")}
              />
            </article>
          );
        })}
      </section>

      {activeCommentQuote ? (
        <section className="mt-8">
          <QuotesSectionCard
            title={t(locale, "Add comment", "Aggiungi commento")}
            description={t(locale, "Comments stay available while the quote remains draft.", "I commenti restano disponibili finché il preventivo rimane in bozza.")}
            action={<Link href="/worker/quotes" className={quotesSecondaryButtonClass}>{t(locale, "Close", "Chiudi")}</Link>}
          >
            <form action={addQuoteCommentAction} className="space-y-4">
              <input type="hidden" name="quoteId" value={activeCommentQuote.id} />
              <QuotesRichTextEditor
                name="commentHtml"
                jsonName="commentJson"
                label={t(locale, "Comment", "Commento")}
                placeholder={t(locale, "Describe blockers, implementation assumptions, or client-facing notes.", "Descrivi blocchi, assunzioni implementative o note per il cliente.")}
                imageButtonLabel={t(locale, "Insert image", "Inserisci immagine")}
              />
              <div className="flex justify-end">
                <button className={quotesSecondaryButtonClass}>{t(locale, "Save comment", "Salva commento")}</button>
              </div>
            </form>
          </QuotesSectionCard>
        </section>
      ) : null}

      {activeSubtaskQuote ? (
        <section className="mt-8">
          <QuotesSectionCard
            title={t(locale, "Add subtask estimate", "Aggiungi stima sottoattività")}
            description={t(locale, "Break the quote into concrete work items with estimated hours.", "Suddividi il preventivo in elementi di lavoro concreti con ore stimate.")}
            action={<Link href="/worker/quotes" className={quotesSecondaryButtonClass}>{t(locale, "Close", "Chiudi")}</Link>}
          >
            <form action={addQuoteSubtaskAction}>
              <input type="hidden" name="quoteId" value={activeSubtaskQuote.id} />
              <QuotesSubtaskForm
                titleLabel={t(locale, "Subtask title", "Titolo sottoattività")}
                descriptionLabel={t(locale, "Description", "Descrizione")}
                estimateLabel={t(locale, "Estimated hours", "Ore stimate")}
                submitLabel={t(locale, "Save subtask", "Salva sottoattività")}
              />
            </form>
          </QuotesSectionCard>
        </section>
      ) : null}

      {activeEntryQuote ? (
        <section className="mt-8">
          <QuotesSectionCard
            title={t(locale, "Add logged hours", "Aggiungi ore registrate")}
            description={t(locale, "Attach real effort to an existing subtask.", "Collega lo sforzo reale a una sottoattività esistente.")}
            action={<Link href="/worker/quotes" className={quotesSecondaryButtonClass}>{t(locale, "Close", "Chiudi")}</Link>}
          >
            <form action={addQuoteSubtaskEntryAction} className="space-y-4">
              <input type="hidden" name="quoteId" value={activeEntryQuote.id} />
              <div className="space-y-1.5">
                <label htmlFor="quote-subtask-id" className="text-sm font-medium text-foreground">{t(locale, "Subtask", "Sottoattività")}</label>
                <select id="quote-subtask-id" name="quoteSubtaskId" required className="w-full rounded-lg border border-input bg-background/75 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">{t(locale, "Select subtask", "Seleziona sottoattività")}</option>
                  {quotesData.subtasks.filter((subtask) => subtask.quoteId === activeEntryQuote.id).map((subtask) => (
                    <option key={subtask.id} value={subtask.id}>{subtask.title}</option>
                  ))}
                </select>
              </div>
              <QuotesWorkerEntryForm
                estimateLabel={t(locale, "Logged hours", "Ore registrate")}
                estimateName="loggedHours"
                estimateId="quote-entry-hours"
                noteLabel={t(locale, "Note", "Nota")}
                submitLabel={t(locale, "Save entry", "Salva voce")}
              />
            </form>
          </QuotesSectionCard>
        </section>
      ) : null}
    </main>
  );
}
