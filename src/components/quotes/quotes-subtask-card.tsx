import type { ReactNode } from "react";
import {
  QuotesEmptyState,
  QuotesSectionCard,
  QuotesStatusBadge,
  quotesInputClass,
  quotesInsetClass,
  quotesPrimaryButtonClass,
  quotesTextareaClass,
} from "@/components/quotes/quotes-shared";

export interface QuotesSubtaskItem {
  id: string;
  title: string;
  description?: string | null;
  statusLabel?: string;
  statusTone?: "neutral" | "info" | "success" | "warning" | "danger";
  estimateLabel?: string | null;
  loggedLabel?: string | null;
  assigneeLabel?: string | null;
  footer?: ReactNode;
}

interface QuotesSubtaskCardProps {
  title: string;
  description?: string;
  items: QuotesSubtaskItem[];
  emptyMessage: string;
  action?: ReactNode;
}

export function QuotesSubtaskCard({ title, description, items, emptyMessage, action }: QuotesSubtaskCardProps) {
  return (
    <QuotesSectionCard title={title} description={description} action={action}>
      <div className="space-y-3">
        {items.length === 0 ? (
          <QuotesEmptyState message={emptyMessage} />
        ) : (
          items.map((item) => (
            <article key={item.id} className={quotesInsetClass + " px-3 py-3"}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                    {item.statusLabel ? (
                      <QuotesStatusBadge label={item.statusLabel} tone={item.statusTone} />
                    ) : null}
                  </div>
                  {item.description ? (
                    <p className="text-sm leading-5 text-muted-foreground">{item.description}</p>
                  ) : null}
                </div>

                <dl className="grid shrink-0 grid-cols-2 gap-2 sm:min-w-56">
                  {item.estimateLabel ? (
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Estimate</dt>
                      <dd className="mt-1 text-sm font-medium text-foreground">{item.estimateLabel}</dd>
                    </div>
                  ) : null}
                  {item.loggedLabel ? (
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Logged</dt>
                      <dd className="mt-1 text-sm font-medium text-foreground">{item.loggedLabel}</dd>
                    </div>
                  ) : null}
                  {item.assigneeLabel ? (
                    <div className="col-span-2">
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Owner</dt>
                      <dd className="mt-1 text-sm font-medium text-foreground">{item.assigneeLabel}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              {item.footer ? <div className="mt-3 border-t border-border/60 pt-3">{item.footer}</div> : null}
            </article>
          ))
        )}
      </div>
    </QuotesSectionCard>
  );
}

interface QuotesSubtaskFormProps {
  titleLabel: string;
  titleName?: string;
  titleId?: string;
  descriptionLabel: string;
  descriptionName?: string;
  descriptionId?: string;
  estimateLabel: string;
  estimateName?: string;
  estimateId?: string;
  assigneeLabel?: string;
  assigneeName?: string;
  assigneeId?: string;
  assigneeOptions?: Array<{ label: string; value: string }>;
  submitLabel: string;
  footer?: ReactNode;
}

export function QuotesSubtaskForm({
  titleLabel,
  titleName = "title",
  titleId = "quotes-subtask-title",
  descriptionLabel,
  descriptionName = "description",
  descriptionId = "quotes-subtask-description",
  estimateLabel,
  estimateName = "estimatedHours",
  estimateId = "quotes-subtask-estimate",
  assigneeLabel,
  assigneeName = "workerId",
  assigneeId = "quotes-subtask-assignee",
  assigneeOptions = [],
  submitLabel,
  footer,
}: QuotesSubtaskFormProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <label htmlFor={titleId} className="text-sm font-medium text-foreground">
            {titleLabel}
          </label>
          <input id={titleId} name={titleName} className={quotesInputClass} />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <label htmlFor={descriptionId} className="text-sm font-medium text-foreground">
            {descriptionLabel}
          </label>
          <textarea id={descriptionId} name={descriptionName} rows={3} className={quotesTextareaClass} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={estimateId} className="text-sm font-medium text-foreground">
            {estimateLabel}
          </label>
          <input id={estimateId} name={estimateName} type="number" min="0" step="0.25" className={quotesInputClass} />
        </div>

        {assigneeLabel ? (
          <div className="space-y-1.5">
            <label htmlFor={assigneeId} className="text-sm font-medium text-foreground">
              {assigneeLabel}
            </label>
            <select id={assigneeId} name={assigneeName} className={quotesInputClass} defaultValue="">
              <option value="">—</option>
              {assigneeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {footer ? <div>{footer}</div> : null}

      <div className="flex justify-end">
        <button type="submit" className={quotesPrimaryButtonClass}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
