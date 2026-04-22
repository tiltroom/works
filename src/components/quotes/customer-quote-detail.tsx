import type { ReactNode } from "react";
import {
  QuotesHeader,
  QuotesRichTextContent,
  QuotesSectionCard,
  QuotesSignatureSummary,
  QuotesSubtaskCard,
  QuotesWorkerEntriesCard,
} from "@/components/quotes";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import {
  formatCurrencyAmount,
  formatQuoteHours,
  formatQuoteStatus,
  getQuoteStatusTone,
  type QuoteCommentRecord,
  type QuotePrepaymentSessionRecord,
  type QuoteRecord,
  type QuoteSubtaskEntryRecord,
  type QuoteSubtaskRecord,
  type QuoteWorkerRecord,
} from "@/lib/quotes";

function formatDateTime(tag: string, value: string | null) {
  return value ? new Date(value).toLocaleString(tag) : "—";
}

interface CustomerQuoteDetailProps {
  locale: Locale;
  tag: string;
  quote: QuoteRecord;
  assignedWorkers: QuoteWorkerRecord[];
  subtasks: QuoteSubtaskRecord[];
  entries: QuoteSubtaskEntryRecord[];
  comments: QuoteCommentRecord[];
  latestPrepayment: QuotePrepaymentSessionRecord | null;
  actions?: ReactNode;
  discussion?: ReactNode;
}

export function CustomerQuoteDetail({
  locale,
  tag,
  quote,
  assignedWorkers,
  subtasks,
  entries,
  latestPrepayment,
  actions,
  discussion,
}: CustomerQuoteDetailProps) {
  return (
    <div className="space-y-4">
      <QuotesHeader
        title={quote.title}
        statusLabel={formatQuoteStatus(locale, quote.status)}
        statusTone={getQuoteStatusTone(quote.status)}
        description={quote.description || t(locale, "No summary provided yet.", "Nessuna sintesi fornita.")}
        action={actions}
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
          description={t(locale, "Admin signs first and selects prepaid or post-paid. Customer signature then starts the matching conversion flow.", "L'admin firma per primo e seleziona prepagato o post-pagato. La firma cliente avvia poi il relativo flusso di conversione.")}
          signatureSteps={[
            {
              key: "admin",
              signerLabel: t(locale, "Admin signer", "Firmatario admin"),
              signedAtTitle: t(locale, "Admin signed at", "Firma admin il"),
              signerName: quote.signedByName,
              signedAtLabel: formatDateTime(tag, quote.signedAt),
              emptyMessage: t(locale, "Waiting for admin signature.", "In attesa della firma dell'amministratore."),
            },
            {
              key: "customer",
              signerLabel: t(locale, "Customer signer", "Firmatario cliente"),
              signedAtTitle: t(locale, "Customer signed at", "Firma cliente il"),
              signerName: quote.customerSignedByName,
              signedAtLabel: formatDateTime(tag, quote.customerSignedAt),
              emptyMessage: t(locale, "Waiting for your signature.", "In attesa della tua firma."),
            },
          ]}
          emptyMessage={t(locale, "Waiting for admin signature.", "In attesa della firma dell'amministratore.")}
        />
      </div>

      {quote.status !== "draft" ? (
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
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {discussion}

        <QuotesSectionCard title={t(locale, "Conversion & prepayment", "Conversione e prepagamento")}>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              {quote.status === "draft"
                ? t(locale, "Customer editing and team collaboration are still open. Customer signature becomes available only after admin sign-off.", "La modifica cliente e la collaborazione del team sono ancora aperte. La firma cliente diventa disponibile solo dopo la firma dell'amministratore.")
                : quote.status === "signed"
                  ? quote.billingMode === "postpaid"
                    ? t(locale, "Admin sign-off is complete. Sign your part to convert this quote into a post-paid project.", "La firma dell'amministratore è completa. Firma la tua parte per convertire questo preventivo in un progetto post-pagato.")
                    : t(locale, "Admin sign-off is complete. Sign your part to continue to Stripe and convert this quote after prepayment.", "La firma dell'amministratore è completa. Firma la tua parte per proseguire su Stripe e convertire questo preventivo dopo il prepagamento.")
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
    </div>
  );
}
