import Link from "next/link";
import { loadQuotesPageData } from "@/app/actions/quotes";
import { LocalDateTime } from "@/components/local-date-time";
import { LogoutButton } from "@/components/logout-button";
import { quotesSecondaryButtonClass } from "@/components/quotes";
import {
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

export default async function WorkerQuotesPage({
  searchParams,
}: {
  searchParams?: Promise<{ toast?: string; toastMessage?: string }> | { toast?: string; toastMessage?: string };
}) {
  const locale = await getLocale();
  const tag = localeTag(locale);
  const profile = await requireRole(["worker"]);
  const params = await Promise.resolve(searchParams ?? {});
  const toastTypeParam = params.toast?.trim();
  const toastMessageParam = params.toastMessage?.trim();
  const activeToast = (toastTypeParam === "success" || toastTypeParam === "error") && toastMessageParam
    ? { variant: toastTypeParam as QueryToastVariant, message: toastMessageParam }
    : null;

  const quotesData = await loadQuotesPageData("worker", profile.id);

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
            {t(locale, "Open one assigned quote at a time, leave implementation notes, and log draft effort from the dedicated worker detail view.", "Apri un preventivo assegnato alla volta, lascia note operative e registra lo sforzo in bozza dalla vista dettaglio dedicata all'operatore.")}
          </p>
        </div>
        <LogoutButton />
      </header>

      <section className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">{t(locale, "Assigned quotes", "Preventivi assegnati")}</h2>
          <span className="text-sm text-muted-foreground">{quotesData.quotes.length} {t(locale, quotesData.quotes.length === 1 ? "quote" : "quotes", quotesData.quotes.length === 1 ? "preventivo" : "preventivi")}</span>
        </div>

        {quotesData.quotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
            {t(locale, "No quotes assigned to you yet.", "Nessun preventivo assegnato per ora.")}
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
                    const detailHref = `/worker/quotes/${quote.id}`;

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
                        <td className="px-4 py-3 align-top text-muted-foreground"><LocalDateTime value={quote.updatedAt} tag={tag} /></td>
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
