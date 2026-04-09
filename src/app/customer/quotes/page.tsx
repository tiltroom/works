import Link from "next/link";
import {
  deleteQuoteDraftAction,
  loadQuotesPageData,
  startQuoteConversionCheckoutAction,
} from "@/app/actions/quotes";
import { LogoutButton } from "@/components/logout-button";
import {
  QuoteActionModal,
  quotesPrimaryButtonClass,
  quotesSecondaryButtonClass,
} from "@/components/quotes";
import { QueryToast } from "@/components/ui/query-toast";
import { requireRole } from "@/lib/auth";
import { localeTag, t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { formatQuoteHours, formatQuoteStatus } from "@/lib/quotes";
import type { QueryToastVariant } from "@/lib/query-toast";

export const dynamic = "force-dynamic";

function formatDateTime(tag: string, value: string | null) {
  return value ? new Date(value).toLocaleString(tag) : "—";
}

export default async function CustomerQuotesPage({
  searchParams,
}: {
  searchParams?: Promise<{ deleteQuoteId?: string; checkout?: string; toast?: string; toastMessage?: string }> | { deleteQuoteId?: string; checkout?: string; toast?: string; toastMessage?: string };
}) {
  const locale = await getLocale();
  const tag = localeTag(locale);
  const profile = await requireRole(["customer"]);
  const params = await Promise.resolve(searchParams ?? {});
  const deleteQuoteId = params.deleteQuoteId?.trim();
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
  const deletingQuote = quotesData.quotes.find((quote) => quote.id === deleteQuoteId && quote.status === "draft") ?? null;
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
        <div className="flex items-center gap-2">
          <Link href="/customer/quotes/new" className={quotesPrimaryButtonClass}>{t(locale, "New draft", "Nuova bozza")}</Link>
          <LogoutButton />
        </div>
      </header>

      <section className="mb-8 mt-8 grid gap-4 md:grid-cols-3">
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
            {t(locale, "Create the first draft to start the quotes workflow.", "Crea la prima bozza per avviare il flusso dei preventivi.")}
          </div>
        ) : null}

        {quotesData.quotes.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-border/70 bg-background/45">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t(locale, "Title", "Titolo")}</th>
                    <th className="px-4 py-3 font-medium">{t(locale, "Status", "Stato")}</th>
                    <th className="px-4 py-3 font-medium">{t(locale, "Estimated", "Stimato")}</th>
                    <th className="px-4 py-3 font-medium">{t(locale, "Logged", "Registrato")}</th>
                    <th className="px-4 py-3 font-medium">{t(locale, "Updated", "Aggiornato")}</th>
                    <th className="px-4 py-3 font-medium">{t(locale, "Actions", "Azioni")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {quotesData.quotes.map((quote) => {
                    const canEdit = quote.status === "draft";
                    const canDelete = quote.status === "draft";
                    const canCheckout = quote.status === "signed" && !quote.linkedProjectId && quote.billingMode !== "postpaid";
                    const isPostPaidAwaiting = quote.status === "signed" && !quote.linkedProjectId && quote.billingMode === "postpaid";

                    return (
                      <tr key={quote.id} className="transition-colors hover:bg-accent/60">
                        <td className="px-4 py-3 align-top">
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{quote.title}</p>
                            <p className="max-w-md text-xs text-muted-foreground">{quote.description || t(locale, "No summary provided yet.", "Nessuna sintesi fornita.")}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-muted-foreground">{formatQuoteStatus(locale, quote.status)}</td>
                        <td className="px-4 py-3 align-top text-muted-foreground">{formatQuoteHours(quote.totalEstimatedHours)}</td>
                        <td className="px-4 py-3 align-top text-muted-foreground">{formatQuoteHours(quote.totalLoggedHours)}</td>
                        <td className="px-4 py-3 align-top text-muted-foreground">{formatDateTime(tag, quote.updatedAt)}</td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/customer/quotes/${quote.id}`} className={quotesSecondaryButtonClass}>{t(locale, "View", "Vedi")}</Link>
                            {canEdit ? <Link href={`/customer/quotes/${quote.id}/edit`} className={quotesSecondaryButtonClass}>{t(locale, "Edit", "Modifica")}</Link> : null}
                            {canDelete ? <Link href={`/customer/quotes?deleteQuoteId=${quote.id}`} className="inline-flex items-center justify-center rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-500/10 dark:text-red-300">{t(locale, "Delete", "Elimina")}</Link> : null}
                            {canCheckout ? (
                              <form action={startQuoteConversionCheckoutAction}>
                                <input type="hidden" name="quoteId" value={quote.id} />
                                <button className={quotesPrimaryButtonClass}>{t(locale, "Convert & prepay", "Converti e pre-paga")}</button>
                              </form>
                            ) : null}
                            {isPostPaidAwaiting ? (
                              <span className="inline-flex items-center justify-center rounded-lg border border-border/70 bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{t(locale, "Post-paid (admin converts)", "Post-pagato (admin converte)")}</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      {deletingQuote ? (
        <QuoteActionModal
          title={t(locale, "Delete draft", "Elimina bozza")}
          closeHref="/customer/quotes"
          successRedirectHref="/customer/quotes"
          action={deleteQuoteDraftAction}
          closeLabel={t(locale, "Close", "Chiudi")}
          cancelLabel={t(locale, "Cancel", "Annulla")}
          submitLabel={t(locale, "Delete", "Elimina")}
          submittingLabel={t(locale, "Deleting…", "Eliminazione in corso…")}
          successMessage={t(locale, "Draft deleted successfully", "Bozza eliminata con successo")}
          genericErrorMessage={t(locale, "An error occurred while deleting the draft.", "Si è verificato un errore durante l'eliminazione della bozza.")}
        >
          <input type="hidden" name="quoteId" value={deletingQuote.id} />
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              {t(locale, "Are you sure you want to delete", "Sei sicuro di voler eliminare")} <span className="font-semibold text-foreground">{deletingQuote.title}</span>? {t(locale, "This action cannot be undone.", "Questa azione non può essere annullata.")}
            </p>
            <p>
              {t(locale, "Only draft quotes can be deleted. Converted projects remain protected.", "Solo i preventivi in bozza possono essere eliminati. I progetti convertiti restano protetti.")}
            </p>
          </div>
        </QuoteActionModal>
      ) : null}
    </main>
  );
}
