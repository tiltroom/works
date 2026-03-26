import type { ReactNode } from "react";
import {
  QuotesCommentsList,
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
}

export function CustomerQuoteDetail({
  locale,
  tag,
  quote,
  assignedWorkers,
  subtasks,
  entries,
  comments,
  latestPrepayment,
  actions,
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
    </div>
  );
}
