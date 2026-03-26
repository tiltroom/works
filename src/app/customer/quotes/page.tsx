import Link from "next/link";
import {
  createQuoteDraftAction,
  loadQuotesPageData,
  startQuoteConversionCheckoutAction,
  updateQuoteDraftAction,
} from "@/app/actions/quotes";
import { LogoutButton } from "@/components/logout-button";
import {
  QuotesCommentsList,
  QuotesHeader,
  QuotesRichTextContent,
  QuotesRichTextEditor,
  QuotesSectionCard,
  QuotesSignatureSummary,
  QuotesSubtaskCard,
  QuotesWorkerEntriesCard,
  quotesInputClass,
  quotesPrimaryButtonClass,
  quotesSecondaryButtonClass,
  quotesTextareaClass,
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
import type { QueryToastVariant } from "@/lib/query-toast";

export const dynamic = "force-dynamic";

function formatDateTime(tag: string, value: string | null) {
  return value ? new Date(value).toLocaleString(tag) : "—";
}

export default async function CustomerQuotesPage({
  searchParams,
}: {
  searchParams?: Promise<{ editQuoteId?: string; checkout?: string; toast?: string; toastMessage?: string }> | { editQuoteId?: string; checkout?: string; toast?: string; toastMessage?: string };
}) {
  const locale = await getLocale();
  const tag = localeTag(locale);
  const profile = await requireRole(["customer"]);
  const params = await Promise.resolve(searchParams ?? {});
  const editQuoteId = params.editQuoteId?.trim();
  const checkoutParam = params.checkout?.trim();
  const toastTypeParam = params.toast?.trim();
  const toastMessageParam = params.toastMessage?.trim();

  const activeToast = checkoutParam === "success"
    ? { variant: "success" as QueryToastVariant, message: t(locale, "Prepayment completed successfully. Conversion will finish when Stripe confirms the session.", "Prepagamento completato con successo. La conversione terminerà quando Stripe confermerà la sessione.") }
    : checkoutParam === "cancelled"
      ? { variant: "error" as QueryToastVariant, message: t(locale, "Checkout cancelled before payment completion.", "Checkout annullato prima del completamento del pagamento.") }
      : (toastTypeParam === "success" || toastTypeParam === "error") && toastMessageParam
        ? { variant: toastTypeParam as QueryToastVariant, message: toastMessageParam }
        : null;

  const quotesData = await loadQuotesPageData("customer", profile.id);
  const editingQuote = quotesData.quotes.find((quote) => quote.id === editQuoteId) ?? null;
  const draftCount = quotesData.quotes.filter((quote) => quote.status === "draft").length;
  const signedCount = quotesData.quotes.filter((quote) => quote.status === "signed").length;
  const convertedCount = quotesData.quotes.filter((quote) => quote.status === "converted").length;

  return (
    <main className="w-full">
      {activeToast ? <QueryToast variant={activeToast.variant} message={activeToast.message} closeLabel={t(locale, "Close", "Chiudi")} /> : null}

      <header className="flex flex-col justify-between gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-center">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link href="/customer" className="rounded-full border border-border/70 bg-background/60 px-3 py-1 transition-colors hover:bg-accent hover:text-accent-foreground">
              ← {t(locale, "Back to portal", "Torna al portale")}
            </Link>
          </div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
            <span className="rounded-lg bg-brand-500/10 p-2 text-brand-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586A1 1 0 0113.293 3.293l4.414 4.414A1 1 0 0118 8.414V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            {t(locale, "Quotes", "Preventivi e quotazioni")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t(locale, "Draft the quote, collaborate through notes and subtasks, then convert it with one prepayment step after admin sign-off.", "Prepara il preventivo, collabora tramite note e sottoattività, poi convertilo con un unico passaggio di prepagamento dopo la firma dell'amministratore.")}
          </p>
        </div>
        <LogoutButton />
      </header>

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-brand-500/20 bg-background/60 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t(locale, "Drafts", "Bozze")}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{draftCount}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/60 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t(locale, "Signed", "Firmati")}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{signedCount}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-background/60 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t(locale, "Converted", "Convertiti")}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{convertedCount}</p>
        </div>
      </section>

      {quotesData.backendAvailable ? (
        <QuotesSectionCard
          title={t(locale, "Create new draft", "Crea nuova bozza")}
          description={t(locale, "Keep the summary compact, then use the rich text body for scope, imagery, and delivery details.", "Mantieni il riepilogo compatto, poi usa il corpo rich text per scopo, immagini e dettagli di consegna.")}
          className="mb-8"
        >
          <form action={createQuoteDraftAction} className="grid gap-4">
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <label htmlFor="customer-quote-title" className="text-sm font-medium text-foreground">{t(locale, "Title", "Titolo")}</label>
                <input id="customer-quote-title" name="title" required className={quotesInputClass} placeholder={t(locale, "New product launch quote", "Preventivo lancio nuovo prodotto")} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="customer-quote-description" className="text-sm font-medium text-foreground">{t(locale, "Summary", "Sintesi")}</label>
                <textarea id="customer-quote-description" name="description" rows={3} className={quotesTextareaClass} placeholder={t(locale, "Objectives, timing, and budget context.", "Obiettivi, tempistiche e contesto budget.")} />
              </div>
            </div>

            <QuotesRichTextEditor
              name="contentHtml"
              jsonName="contentJson"
              label={t(locale, "Quote body", "Corpo del preventivo")}
              placeholder={t(locale, "Describe scope, deliverables, assumptions, milestones, and any references.", "Descrivi scopo, deliverable, assunzioni, milestone e riferimenti.")}
              helpText={t(locale, "Use rich text and inline images when visual context helps the team estimate accurately.", "Usa testo ricco e immagini inline quando il contesto visivo aiuta il team a stimare con precisione.")}
              imageButtonLabel={t(locale, "Insert image", "Inserisci immagine")}
              unsupportedImageTypeMessage={t(locale, "Only JPG, PNG, WEBP, and GIF files are allowed.", "Sono consentiti solo file JPG, PNG, WEBP e GIF.")}
              imageTooLargeMessage={t(locale, "Images must be 1MB or smaller.", "Le immagini devono essere da 1MB o meno.")}
              imageUploadErrorMessage={t(locale, "Image upload failed.", "Caricamento immagine non riuscito.")}
            />

            <div className="flex justify-end">
              <button className={quotesPrimaryButtonClass}>{t(locale, "Save draft", "Salva bozza")}</button>
            </div>
          </form>
        </QuotesSectionCard>
      ) : null}

      <section className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">{t(locale, "Your quotes", "I tuoi preventivi")}</h2>
          <span className="text-sm text-muted-foreground">{quotesData.quotes.length} {t(locale, quotesData.quotes.length === 1 ? "quote" : "quotes", quotesData.quotes.length === 1 ? "preventivo" : "preventivi")}</span>
        </div>

        {!quotesData.backendAvailable ? (
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            <p className="font-semibold">{t(locale, "Quotes backend not configured", "Backend preventivi non configurato")}</p>
            <p className="mt-1">{t(locale, "The route is ready, but quote records will appear only when the quote tables are available.", "La rotta è pronta, ma i record dei preventivi compariranno solo quando le tabelle dedicate saranno disponibili.")}</p>
          </div>
        ) : null}

        {quotesData.backendAvailable && quotesData.quotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
            {t(locale, "Create the first draft above to start the quotes workflow.", "Crea la prima bozza qui sopra per avviare il flusso dei preventivi.")}
          </div>
        ) : null}

        {quotesData.quotes.map((quote) => {
          const assignedWorkers = quotesData.workers.filter((assignment) => assignment.quoteId === quote.id);
          const subtasks = quotesData.subtasks.filter((subtask) => subtask.quoteId === quote.id);
          const subtaskIds = new Set(subtasks.map((subtask) => subtask.id));
          const entries = quotesData.subtaskEntries.filter((entry) => subtaskIds.has(entry.quoteSubtaskId));
          const comments = quotesData.comments.filter((comment) => comment.quoteId === quote.id);
          const latestPrepayment = quotesData.prepaymentSessions.find((session) => session.quoteId === quote.id) ?? null;
          const canEdit = quote.status === "draft";
          const canCheckout = quote.status === "signed" && !quote.linkedProjectId;

          return (
            <article key={quote.id} className="space-y-4">
              <QuotesHeader
                title={quote.title}
                statusLabel={formatQuoteStatus(locale, quote.status)}
                statusTone={getQuoteStatusTone(quote.status)}
                description={quote.description || t(locale, "No summary provided yet.", "Nessuna sintesi fornita.")}
                action={(
                  <div className="flex flex-wrap items-center gap-2">
                    {canEdit ? (
                      <Link href={`/customer/quotes?editQuoteId=${quote.id}`} className={quotesSecondaryButtonClass}>
                        {t(locale, "Edit draft", "Modifica bozza")}
                      </Link>
                    ) : null}
                    {canCheckout ? (
                      <form action={startQuoteConversionCheckoutAction}>
                        <input type="hidden" name="quoteId" value={quote.id} />
                        <button className={quotesPrimaryButtonClass}>{t(locale, "Convert & prepay", "Converti e pre-paga")}</button>
                      </form>
                    ) : null}
                  </div>
                )}
                meta={[
                  { label: t(locale, "Estimated", "Stimato"), value: formatQuoteHours(quote.totalEstimatedHours), tone: "accent" },
                  { label: t(locale, "Logged", "Registrato"), value: formatQuoteHours(quote.totalLoggedHours) },
                  { label: t(locale, "Workers", "Operatori"), value: assignedWorkers.length },
                  { label: t(locale, "Updated", "Aggiornato"), value: formatDateTime(tag, quote.updatedAt) },
                ]}
              />

              <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
                <QuotesSectionCard title={t(locale, "Quote content", "Contenuto del preventivo")}> 
                  <QuotesRichTextContent
                    html={quote.contentHtml ?? ""}
                    emptyMessage={t(locale, "No detailed body added yet.", "Nessun corpo dettagliato aggiunto.")}
                  />
                </QuotesSectionCard>

                <QuotesSignatureSummary
                  title={t(locale, "Sign-off", "Firma")}
                  description={t(locale, "Admin sign-off unlocks the single conversion + prepayment step.", "La firma dell'amministratore sblocca l'unico passaggio di conversione + prepagamento.")}
                  signerName={quote.signedByName}
                  signedAtLabel={formatDateTime(tag, quote.signedAt)}
                  emptyMessage={t(locale, "Waiting for admin signature.", "In attesa della firma dell'amministratore.")}
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <QuotesSubtaskCard
                  title={t(locale, "Subtask estimates", "Stime sottoattività")}
                  description={t(locale, "Worker-generated effort breakdown used to determine conversion hours.", "Suddivisione dello sforzo generata dagli operatori, usata per determinare le ore di conversione.")}
                  items={subtasks.map((subtask) => {
                    const relatedEntries = entries.filter((entry) => entry.quoteSubtaskId === subtask.id);
                    return {
                      id: subtask.id,
                      title: subtask.title,
                      description: subtask.description,
                      estimateLabel: formatQuoteHours(subtask.estimatedHours),
                      loggedLabel: formatQuoteHours(relatedEntries.reduce((total, entry) => total + entry.loggedHours, 0)),
                    };
                  })}
                  emptyMessage={t(locale, "No subtasks estimated yet.", "Nessuna sottoattività stimata.")}
                />

                <QuotesWorkerEntriesCard
                  title={t(locale, "Logged subtask work", "Lavoro registrato sulle sottoattività")}
                  description={t(locale, "Progress entries added by assigned workers while the quote remains draft.", "Voci di avanzamento aggiunte dagli operatori assegnati mentre il preventivo resta in bozza.")}
                  items={entries.map((entry) => ({
                    id: entry.id,
                    workerName: entry.workerName || t(locale, "Worker", "Operatore"),
                    subtaskTitle: subtasks.find((subtask) => subtask.id === entry.quoteSubtaskId)?.title ?? t(locale, "Unknown subtask", "Sottoattività sconosciuta"),
                    loggedLabel: formatQuoteHours(entry.loggedHours),
                    note: entry.note,
                    metaLabel: formatDateTime(tag, entry.createdAt),
                  }))}
                  emptyMessage={t(locale, "No logged work yet.", "Nessun lavoro registrato.")}
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <QuotesCommentsList
                  title={t(locale, "Discussion", "Discussione")}
                  description={t(locale, "Shared customer, worker, and admin notes for this quote.", "Note condivise di cliente, operatori e amministratore per questo preventivo.")}
                  comments={comments.map((comment) => ({
                    id: comment.id,
                    authorName: comment.authorName || t(locale, comment.authorRole === "customer" ? "Customer" : comment.authorRole === "admin" ? "Admin" : "Worker", comment.authorRole === "customer" ? "Cliente" : comment.authorRole === "admin" ? "Admin" : "Operatore"),
                    createdAtLabel: formatDateTime(tag, comment.createdAt),
                    metaLabel: comment.authorRole,
                    body: <QuotesRichTextContent html={comment.commentHtml ?? ""} emptyMessage={t(locale, "No comment content", "Nessun contenuto commento")} />,
                  }))}
                  emptyMessage={t(locale, "No comments yet.", "Nessun commento ancora.")}
                />

                <QuotesSectionCard title={t(locale, "Conversion & prepayment", "Conversione e prepagamento")}>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      {quote.status === "draft"
                        ? t(locale, "Customer editing and team collaboration are still open. Conversion becomes available only after admin sign-off.", "La modifica cliente e la collaborazione del team sono ancora aperte. La conversione diventa disponibile solo dopo la firma dell'amministratore.")
                        : quote.status === "signed"
                          ? t(locale, "Admin sign-off is complete. Use the button above to pay once and convert this quote into a project with the estimated hours.", "La firma dell'amministratore è completa. Usa il pulsante sopra per pagare una volta e convertire questo preventivo in un progetto con le ore stimate.")
                          : t(locale, "This quote has already been converted into a project.", "Questo preventivo è già stato convertito in un progetto.")}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t(locale, "Latest prepayment", "Ultimo prepagamento")}</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{latestPrepayment ? formatCurrencyAmount(latestPrepayment.amountCents, latestPrepayment.currency) : "—"}</p>
                        {latestPrepayment ? <p className="mt-1 text-xs text-muted-foreground">{latestPrepayment.status === "paid" ? t(locale, "Paid", "Pagato") : t(locale, "Pending", "In attesa")}</p> : null}
                      </div>
                      <div className="rounded-xl border border-border/70 bg-background/60 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t(locale, "Linked project", "Progetto collegato")}</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{quote.linkedProjectName || "—"}</p>
                        {quote.convertedAt ? <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(tag, quote.convertedAt)}</p> : null}
                      </div>
                    </div>
                  </div>
                </QuotesSectionCard>
              </div>
            </article>
          );
        })}
      </section>

      {editingQuote ? (
        <section className="mt-8">
          <QuotesSectionCard
            title={t(locale, "Edit draft", "Modifica bozza")}
            description={t(locale, "Update the rich text body while the quote is still draft.", "Aggiorna il corpo rich text mentre il preventivo è ancora in bozza.")}
            action={<Link href="/customer/quotes" className={quotesSecondaryButtonClass}>{t(locale, "Close", "Chiudi")}</Link>}
          >
            <form action={updateQuoteDraftAction} className="grid gap-4">
              <input type="hidden" name="quoteId" value={editingQuote.id} />
              <div className="grid gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="edit-customer-quote-title" className="text-sm font-medium text-foreground">{t(locale, "Title", "Titolo")}</label>
                  <input id="edit-customer-quote-title" name="title" required defaultValue={editingQuote.title} className={quotesInputClass} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="edit-customer-quote-description" className="text-sm font-medium text-foreground">{t(locale, "Summary", "Sintesi")}</label>
                  <textarea id="edit-customer-quote-description" name="description" rows={3} defaultValue={editingQuote.description ?? ""} className={quotesTextareaClass} />
                </div>
              </div>

              <QuotesRichTextEditor
                name="contentHtml"
                jsonName="contentJson"
                label={t(locale, "Quote body", "Corpo del preventivo")}
                initialHtml={editingQuote.contentHtml ?? ""}
                initialJson={editingQuote.contentJson}
                placeholder={t(locale, "Describe scope, deliverables, assumptions, milestones, and any references.", "Descrivi scopo, deliverable, assunzioni, milestone e riferimenti.")}
                helpText={t(locale, "Use the same editor and upload flow as the final customer draft body.", "Usa lo stesso editor e flusso di upload del corpo finale della bozza cliente.")}
                imageButtonLabel={t(locale, "Insert image", "Inserisci immagine")}
                unsupportedImageTypeMessage={t(locale, "Only JPG, PNG, WEBP, and GIF files are allowed.", "Sono consentiti solo file JPG, PNG, WEBP e GIF.")}
                imageTooLargeMessage={t(locale, "Images must be 1MB or smaller.", "Le immagini devono essere da 1MB o meno.")}
                imageUploadErrorMessage={t(locale, "Image upload failed.", "Caricamento immagine non riuscito.")}
              />

              <div className="flex justify-end">
                <button className={quotesPrimaryButtonClass}>{t(locale, "Save changes", "Salva modifiche")}</button>
              </div>
            </form>
          </QuotesSectionCard>
        </section>
      ) : null}
    </main>
  );
}
