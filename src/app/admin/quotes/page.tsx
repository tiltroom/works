import Link from "next/link";
import { assignQuoteWorkersAction, loadQuotesPageData, signQuoteAction } from "@/app/actions/quotes";
import { LogoutButton } from "@/components/logout-button";
import {
  QuotesCommentsList,
  QuotesHeader,
  QuotesRichTextContent,
  QuotesSectionCard,
  QuotesSignatureSummary,
  QuotesSubtaskCard,
  QuotesWorkerEntriesCard,
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

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams?: Promise<{ assignWorkersId?: string; signQuoteId?: string; toast?: string; toastMessage?: string }> | { assignWorkersId?: string; signQuoteId?: string; toast?: string; toastMessage?: string };
}) {
  const locale = await getLocale();
  const tag = localeTag(locale);
  await requireRole(["admin"]);
  const supabase = await createClient();
  const params = await Promise.resolve(searchParams ?? {});
  const assignWorkersId = params.assignWorkersId?.trim();
  const signQuoteId = params.signQuoteId?.trim();
  const toastTypeParam = params.toast?.trim();
  const toastMessageParam = params.toastMessage?.trim();
  const activeToast = (toastTypeParam === "success" || toastTypeParam === "error") && toastMessageParam
    ? { variant: toastTypeParam as QueryToastVariant, message: toastMessageParam }
    : null;

  const [{ data: workersFromDb }, quotesData] = await Promise.all([
    supabase.from("profiles").select("id,full_name").eq("role", "worker").order("full_name", { ascending: true }),
    loadQuotesPageData("admin", ""),
  ]);

  const workerOptions = (workersFromDb ?? []).map((worker) => ({ id: String(worker.id), name: worker.full_name?.trim() || String(worker.id) }));
  const activeAssignQuote = quotesData.quotes.find((quote) => quote.id === assignWorkersId) ?? null;
  const activeSignQuote = quotesData.quotes.find((quote) => quote.id === signQuoteId) ?? null;
  const signedCount = quotesData.quotes.filter((quote) => quote.status === "signed").length;
  const convertedCount = quotesData.quotes.filter((quote) => quote.status === "converted").length;

  return (
    <main className="w-full">
      {activeToast ? <QueryToast variant={activeToast.variant} message={activeToast.message} closeLabel={t(locale, "Close", "Chiudi")} /> : null}

      <header className="mb-8 flex flex-col justify-between gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-center">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link href="/admin" className="rounded-full border border-border/70 bg-background/60 px-3 py-1 transition-colors hover:bg-accent hover:text-accent-foreground">
              ← {t(locale, "Back to admin", "Torna all'area admin")}
            </Link>
          </div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
            <span className="rounded-lg bg-red-500/10 p-2 text-red-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
              </svg>
            </span>
            {t(locale, "Quotes Review Desk", "Desk revisione preventivi")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t(locale, "Assign workers during draft, review the breakdown, and sign the quote when it is ready for conversion checkout.", "Assegna operatori durante la bozza, rivedi la scomposizione del lavoro e firma il preventivo quando è pronto per il checkout di conversione.")}
          </p>
        </div>
        <LogoutButton />
      </header>

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-background/60 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t(locale, "Total quotes", "Preventivi totali")}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{quotesData.quotes.length}</p>
        </div>
        <div className="rounded-xl border border-brand-500/20 bg-background/60 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t(locale, "Signed", "Firmati")}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{signedCount}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-background/60 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t(locale, "Converted", "Convertiti")}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{convertedCount}</p>
        </div>
      </section>

      <section className="space-y-6">
        {quotesData.quotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
            {t(locale, "No quotes yet.", "Nessun preventivo ancora.")}
          </div>
        ) : null}

        {quotesData.quotes.map((quote) => {
          const assignedWorkers = quotesData.workers.filter((assignment) => assignment.quoteId === quote.id);
          const subtasks = quotesData.subtasks.filter((subtask) => subtask.quoteId === quote.id);
          const subtaskIds = new Set(subtasks.map((subtask) => subtask.id));
          const entries = quotesData.subtaskEntries.filter((entry) => subtaskIds.has(entry.quoteSubtaskId));
          const comments = quotesData.comments.filter((comment) => comment.quoteId === quote.id);
          const latestPrepayment = quotesData.prepaymentSessions.find((session) => session.quoteId === quote.id) ?? null;
          const canAssignWorkers = quote.status === "draft";
          const canSign = quote.status === "draft";

          return (
            <article key={quote.id} className="space-y-4">
              <QuotesHeader
                title={quote.title}
                statusLabel={formatQuoteStatus(locale, quote.status)}
                statusTone={getQuoteStatusTone(quote.status)}
                description={quote.description || t(locale, "No summary provided yet.", "Nessuna sintesi fornita.")}
                action={(
                  <div className="flex flex-wrap items-center gap-2">
                    {canAssignWorkers ? <Link href={`/admin/quotes?assignWorkersId=${quote.id}#assign-workers`} className={quotesSecondaryButtonClass}>{t(locale, "Assign workers", "Assegna operatori")}</Link> : null}
                    {canSign ? <Link href={`/admin/quotes?signQuoteId=${quote.id}`} className={quotesPrimaryButtonClass}>{t(locale, "Sign", "Firma")}</Link> : null}
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
                  description={t(locale, "Actual work captured against subtasks during draft stage.", "Lavoro effettivo registrato sulle sottoattività durante la fase di bozza.")}
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
            </article>
          );
        })}
      </section>

      {activeAssignQuote ? (
        <section id="assign-workers" className="mt-8 scroll-mt-24">
          <QuotesSectionCard
            title={t(locale, "Assign workers", "Assegna operatori")}
            description={t(locale, "Only draft quotes can be staffed before the worker collaboration phase starts.", "Solo i preventivi in bozza possono essere assegnati prima che inizi la collaborazione degli operatori.")}
            action={<Link href="/admin/quotes" className={quotesSecondaryButtonClass}>{t(locale, "Close", "Chiudi")}</Link>}
          >
            <form action={assignQuoteWorkersAction} className="space-y-4">
              <input type="hidden" name="quoteId" value={activeAssignQuote.id} />
              <div className="space-y-1.5">
                <label htmlFor="assign-worker-select" className="text-sm font-medium text-foreground">{t(locale, "Workers", "Operatori")}</label>
                <select id="assign-worker-select" name="workerIds" multiple className={`${quotesInputClass} min-h-40`} defaultValue={quotesData.workers.filter((assignment) => assignment.quoteId === activeAssignQuote.id).map((assignment) => assignment.workerId)}>
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

      {activeSignQuote ? (
        <section className="mt-8">
          <QuotesSectionCard
            title={t(locale, "Sign quote", "Firma preventivo")}
            description={t(locale, "Signing ends the editable draft phase and unlocks the customer’s single convert + prepay step.", "La firma chiude la fase di bozza modificabile e sblocca l'unico passaggio cliente di conversione + prepagamento.")}
            action={<Link href="/admin/quotes" className={quotesSecondaryButtonClass}>{t(locale, "Close", "Chiudi")}</Link>}
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
