import Link from "next/link";
import { notFound } from "next/navigation";
import { addQuoteCommentAction, loadQuoteDiscussionAction, loadQuotesPageData, startQuoteConversionCheckoutAction, updateQuoteCommentAction } from "@/app/actions/quotes";
import { CustomerQuoteDetail, QuoteDiscussionPanel, quotesPrimaryButtonClass, quotesSecondaryButtonClass } from "@/components/quotes";
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
  const canCustomerSign = quote.status === "signed" && !quote.linkedProjectId && !quote.customerSignedAt;

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
        discussion={(
          <QuoteDiscussionPanel
            title={t(locale, "Discussion", "Discussione")}
            description={t(locale, "Shared customer, worker, and admin notes for this quote.", "Note condivise di cliente, operatori e amministratore per questo preventivo.")}
            quoteId={quote.id}
            tag={tag}
            comments={comments}
            currentUserId={profile.id}
            currentUserRole="customer"
            canCompose={true}
            loadAction={loadQuoteDiscussionAction}
            addAction={addQuoteCommentAction}
            updateAction={updateQuoteCommentAction}
            labels={{
              emptyMessage: t(locale, "No comments yet.", "Nessun commento ancora."),
              noCommentContent: t(locale, "No comment content", "Nessun contenuto commento"),
              composerLabel: t(locale, "New message", "Nuovo messaggio"),
              composerPlaceholder: t(locale, "Share clarifications, approvals, or follow-up questions for this quote.", "Condividi chiarimenti, approvazioni o domande di follow-up per questo preventivo."),
              composerHelpText: t(locale, "Messages refresh automatically while this page stays open.", "I messaggi si aggiornano automaticamente mentre questa pagina resta aperta."),
              sendLabel: t(locale, "Send message", "Invia messaggio"),
              sendingLabel: t(locale, "Sending…", "Invio in corso…"),
              editLabel: t(locale, "Edit", "Modifica"),
              cancelEditLabel: t(locale, "Cancel", "Annulla"),
              saveEditLabel: t(locale, "Save changes", "Salva modifiche"),
              savingEditLabel: t(locale, "Saving…", "Salvataggio in corso…"),
              editedLabel: t(locale, "Edited", "Modificato"),
              originalContentLabel: t(locale, "View original message", "Visualizza messaggio originale"),
              originalContentHint: t(locale, "Use this reference when you need to compare the first version with the latest edit.", "Usa questo riferimento quando devi confrontare la prima versione con l'ultima modifica."),
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
        )}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            {canEdit ? <Link href={`/customer/quotes/${quote.id}/edit`} className={quotesSecondaryButtonClass}>{t(locale, "Edit draft", "Modifica bozza")}</Link> : null}
            {canCustomerSign ? (
              <form action={startQuoteConversionCheckoutAction}>
                <input type="hidden" name="quoteId" value={quote.id} />
                <button className={quotesPrimaryButtonClass}>
                  {quote.billingMode === "postpaid"
                    ? t(locale, "Sign & convert", "Firma e converti")
                    : t(locale, "Sign & continue to Stripe", "Firma e continua su Stripe")}
                </button>
              </form>
            ) : null}
          </div>
        )}
      />
    </main>
  );
}
