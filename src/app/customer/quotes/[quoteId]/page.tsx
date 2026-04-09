import Link from "next/link";
import { notFound } from "next/navigation";
import { loadQuotesPageData, startQuoteConversionCheckoutAction } from "@/app/actions/quotes";
import { CustomerQuoteDetail, quotesPrimaryButtonClass, quotesSecondaryButtonClass } from "@/components/quotes";
import { QueryToast } from "@/components/ui/query-toast";
import { requireRole } from "@/lib/auth";
import { localeTag, t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import type { QueryToastVariant } from "@/lib/query-toast";

export const dynamic = "force-dynamic";

export default async function CustomerQuoteViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }> | { quoteId: string };
  searchParams?: Promise<{ toast?: string; toastMessage?: string }> | { toast?: string; toastMessage?: string };
}) {
  const locale = await getLocale();
  const tag = localeTag(locale);
  const profile = await requireRole(["customer"]);
  const routeParams = await Promise.resolve(params);
  const paramsValue = await Promise.resolve(searchParams ?? {});
  const quoteId = routeParams.quoteId?.trim();
  const toastTypeParam = paramsValue.toast?.trim();
  const toastMessageParam = paramsValue.toastMessage?.trim();
  const activeToast = (toastTypeParam === "success" || toastTypeParam === "error") && toastMessageParam
    ? { variant: toastTypeParam as QueryToastVariant, message: toastMessageParam }
    : null;
  const quotesData = await loadQuotesPageData("customer", profile.id);
  const quote = quotesData.quotes.find((entry) => entry.id === quoteId) ?? null;

  if (!quote) {
    notFound();
  }

  const assignedWorkers = quotesData.workers.filter((assignment) => assignment.quoteId === quote.id);
  const subtasks = quotesData.subtasks.filter((subtask) => subtask.quoteId === quote.id);
  const subtaskIds = new Set(subtasks.map((subtask) => subtask.id));
  const entries = quotesData.subtaskEntries.filter((entry) => subtaskIds.has(entry.quoteSubtaskId));
  const comments = quotesData.comments.filter((comment) => comment.quoteId === quote.id);
  const latestPrepayment = quotesData.prepaymentSessions.find((session) => session.quoteId === quote.id) ?? null;
  const canEdit = quote.status === "draft";
  const canCheckout = quote.status === "signed" && !quote.linkedProjectId;

  return (
    <main className="w-full space-y-8">
      {activeToast ? <QueryToast variant={activeToast.variant} message={activeToast.message} closeLabel={t(locale, "Close", "Chiudi")} /> : null}

      <header className="border-b border-border/70 pb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href="/customer/quotes" className="rounded-full border border-border/70 bg-background/60 px-3 py-1 transition-colors hover:bg-accent hover:text-accent-foreground">
            ← {t(locale, "Back to quotes", "Torna ai preventivi")}
          </Link>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t(locale, "Quote details", "Dettagli preventivo")}</h1>
        <p className="mt-1 text-muted-foreground">{t(locale, "Review all quote details, comments, subtasks, and conversion status in one dedicated view.", "Rivedi tutti i dettagli del preventivo, commenti, sottoattività e stato di conversione in una vista dedicata.")}</p>
      </header>

      <CustomerQuoteDetail
        locale={locale}
        tag={tag}
        quote={quote}
        assignedWorkers={assignedWorkers}
        subtasks={subtasks}
        entries={entries}
        comments={comments}
        latestPrepayment={latestPrepayment}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            {canEdit ? <Link href={`/customer/quotes/${quote.id}/edit`} className={quotesSecondaryButtonClass}>{t(locale, "Edit draft", "Modifica bozza")}</Link> : null}
            {canCheckout ? (
              <form action={startQuoteConversionCheckoutAction}>
                <input type="hidden" name="quoteId" value={quote.id} />
                <button className={quotesPrimaryButtonClass}>{t(locale, "Convert & prepay", "Converti e pre-paga")}</button>
              </form>
            ) : null}
          </div>
        )}
      />
    </main>
  );
}
