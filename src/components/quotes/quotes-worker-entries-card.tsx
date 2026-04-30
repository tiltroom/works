import type { ReactNode } from "react";
import {
  QuotesEmptyState,
  QuotesSectionCard,
  quotesInputClass,
  quotesInsetClass,
  quotesPrimaryButtonClass,
  quotesTextareaClass,
} from "@/components/quotes/quotes-shared";

export interface QuotesWorkerEntryItem {
  id: string;
  workerName: string;
  subtaskTitle?: string | null;
  estimateLabel?: string | null;
  loggedLabel?: string | null;
  note?: string | null;
  metaLabel?: ReactNode;
  action?: ReactNode;
}

interface QuotesWorkerEntriesCardProps {
  title: string;
  description?: string;
  items: QuotesWorkerEntryItem[];
  emptyMessage: string;
  action?: ReactNode;
}

export function QuotesWorkerEntriesCard({
  title,
  description,
  items,
  emptyMessage,
  action,
}: QuotesWorkerEntriesCardProps) {
  return (
    <QuotesSectionCard title={title} description={description} action={action}>
      <div className="space-y-3">
        {items.length === 0 ? (
          <QuotesEmptyState message={emptyMessage} />
        ) : (
          items.map((item) => (
            <div key={item.id} className={quotesInsetClass + " flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{item.workerName}</p>
                  {item.metaLabel ? <span className="text-xs text-muted-foreground">{item.metaLabel}</span> : null}
                </div>
                {item.subtaskTitle ? <p className="mt-1 text-sm text-foreground/90">{item.subtaskTitle}</p> : null}
                {item.note ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.note}</p> : null}
              </div>

              <div className="flex items-center gap-4 sm:justify-end">
                {item.estimateLabel ? (
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Estimate</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{item.estimateLabel}</p>
                  </div>
                ) : null}
                {item.loggedLabel ? (
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Logged</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{item.loggedLabel}</p>
                  </div>
                ) : null}
                {item.action ? <div className="shrink-0">{item.action}</div> : null}
              </div>
            </div>
          ))
        )}
      </div>
    </QuotesSectionCard>
  );
}

interface QuotesWorkerEntryFormProps {
  estimateLabel: string;
  estimateName?: string;
  estimateId?: string;
  estimateDefaultValue?: string | number;
  loggedLabel?: string;
  loggedName?: string;
  loggedId?: string;
  loggedDefaultValue?: string | number;
  noteLabel?: string;
  noteName?: string;
  noteId?: string;
  noteDefaultValue?: string;
  submitLabel: string;
  showSubmitButton?: boolean;
  footer?: ReactNode;
}

export function QuotesWorkerEntryForm({
  estimateLabel,
  estimateName = "estimatedHours",
  estimateId = "quotes-worker-estimate",
  estimateDefaultValue,
  loggedLabel,
  loggedName = "loggedHours",
  loggedId = "quotes-worker-logged",
  loggedDefaultValue,
  noteLabel,
  noteName = "note",
  noteId = "quotes-worker-note",
  noteDefaultValue,
  submitLabel,
  showSubmitButton = true,
  footer,
}: QuotesWorkerEntryFormProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={estimateId} className="text-sm font-medium text-foreground">
            {estimateLabel}
          </label>
          <input id={estimateId} name={estimateName} type="number" min="0" step="0.25" defaultValue={estimateDefaultValue} className={quotesInputClass} />
        </div>

        {loggedLabel ? (
          <div className="space-y-1.5">
            <label htmlFor={loggedId} className="text-sm font-medium text-foreground">
              {loggedLabel}
            </label>
            <input id={loggedId} name={loggedName} type="number" min="0" step="0.25" defaultValue={loggedDefaultValue} className={quotesInputClass} />
          </div>
        ) : null}

        {noteLabel ? (
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor={noteId} className="text-sm font-medium text-foreground">
              {noteLabel}
            </label>
            <textarea id={noteId} name={noteName} rows={3} defaultValue={noteDefaultValue} className={quotesTextareaClass} />
          </div>
        ) : null}
      </div>

      {footer ? <div>{footer}</div> : null}

      {showSubmitButton ? (
        <div className="flex justify-end">
          <button type="submit" className={quotesPrimaryButtonClass}>
            {submitLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
