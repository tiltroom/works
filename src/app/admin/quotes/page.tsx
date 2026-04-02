import Link from "next/link";
import { loadQuotesPageData } from "@/app/actions/quotes";
import { LogoutButton } from "@/components/logout-button";
import { quotesSecondaryButtonClass } from "@/components/quotes";
import {
  QuotesMetricCard,
  QuotesStatusBadge,
  quotesTableHeadClass,
  quotesTableRowClass,
  quotesTableShellClass,
} from "@/components/quotes/ui";
import { QueryToast } from "@/components/ui/query-toast";
import { requireRole } from "@/lib/auth";
import { localeTag, t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { formatQuoteHours } from "@/lib/quotes";
import type { QueryToastVariant } from "@/lib/query-toast";

export const dynamic = "force-dynamic";

function formatDateTime(tag: string, value: string | null) {
  return value ? new Date(value).toLocaleString(tag) : "—";
}

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams?: Promise<{ toast?: string; toastMessage?: string }> | { toast?: string; toastMessage?: string };
}) {
  const locale = await getLocale();
  const tag = localeTag(locale);
  await requireRole(["admin"]);
  const params = await Promise.resolve(searchParams ?? {});
  const toastTypeParam = params.toast?.trim();
  const toastMessageParam = params.toastMessage?.trim();
  const activeToast = (toastTypeParam === "success" || toastTypeParam === "error") && toastMessageParam
    ? { variant: toastTypeParam as QueryToastVariant, message: toastMessageParam }
    : null;

  const quotesData = await loadQuotesPageData("admin", "");
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
        <QuotesMetricCard label={t(locale, "Total quotes", "Preventivi totali")} value={String(quotesData.quotes.length)} />
        <QuotesMetricCard label={t(locale, "Signed", "Firmati")} value={String(signedCount)} tone="brand" />
        <QuotesMetricCard label={t(locale, "Converted", "Convertiti")} value={String(convertedCount)} tone="success" />
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">{t(locale, "All quotes", "Tutti i preventivi")}</h2>
          <span className="text-sm text-muted-foreground">{quotesData.quotes.length} {t(locale, quotesData.quotes.length === 1 ? "quote" : "quotes", quotesData.quotes.length === 1 ? "preventivo" : "preventivi")}</span>
        </div>

        {quotesData.quotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
            {t(locale, "No quotes yet.", "Nessun preventivo ancora.")}
          </div>
        ) : null}

        {quotesData.quotes.length > 0 ? (
          <div className={quotesTableShellClass}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className={quotesTableHeadClass}>
                  <tr>
                    <th className="px-4 py-3 font-medium">{t(locale, "Title", "Titolo")}</th>
                    <th className="px-4 py-3 font-medium">{t(locale, "Customer", "Cliente")}</th>
                    <th className="px-4 py-3 font-medium">{t(locale, "Status", "Stato")}</th>
                    <th className="px-4 py-3 font-medium">{t(locale, "Estimated", "Stimato")}</th>
                    <th className="px-4 py-3 font-medium">{t(locale, "Logged", "Registrato")}</th>
                    <th className="px-4 py-3 font-medium">{t(locale, "Updated", "Aggiornato")}</th>
                    <th className="px-4 py-3 font-medium">{t(locale, "Actions", "Azioni")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {quotesData.quotes.map((quote) => {
                    const detailHref = `/admin/quotes/${quote.id}`;

                    return (
                      <tr key={quote.id} className={quotesTableRowClass}>
                        <td className="px-4 py-3 align-top">
                          <div className="space-y-1">
                            <Link href={detailHref} className="font-medium text-foreground transition-colors hover:text-brand-600 dark:hover:text-brand-300">
                              {quote.title}
                            </Link>
                            <p className="max-w-md text-xs text-muted-foreground">{quote.description || t(locale, "No summary provided yet.", "Nessuna sintesi fornita.")}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-muted-foreground">{quote.customerName || t(locale, "Unknown", "Sconosciuto")}</td>
                        <td className="px-4 py-3 align-top">
                          <QuotesStatusBadge locale={locale} status={quote.status} />
                        </td>
                        <td className="px-4 py-3 align-top text-muted-foreground">{formatQuoteHours(quote.totalEstimatedHours)}</td>
                        <td className="px-4 py-3 align-top text-muted-foreground">{formatQuoteHours(quote.totalLoggedHours)}</td>
                        <td className="px-4 py-3 align-top text-muted-foreground">{formatDateTime(tag, quote.updatedAt)}</td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={detailHref} className={quotesSecondaryButtonClass}>{t(locale, "View", "Vedi")}</Link>
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
    </main>
  );
}
