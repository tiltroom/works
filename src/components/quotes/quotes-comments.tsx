import type { ComponentPropsWithoutRef, ReactNode } from "react";
import {
  QuotesEmptyState,
  QuotesSectionCard,
  quotesPrimaryButtonClass,
  quotesSecondaryButtonClass,
  quotesTextareaClass,
} from "@/components/quotes/quotes-shared";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export interface QuotesCommentItem {
  id: string;
  authorName: string;
  createdAtLabel: string;
  body: ReactNode;
  metaLabel?: string | null;
}

interface QuotesCommentsListProps {
  title: string;
  description?: string;
  comments: QuotesCommentItem[];
  emptyMessage: string;
  action?: ReactNode;
}

export function QuotesCommentsList({
  title,
  description,
  comments,
  emptyMessage,
  action,
}: QuotesCommentsListProps) {
  return (
    <QuotesSectionCard title={title} description={description} action={action}>
      <div className="space-y-3">
        {comments.length === 0 ? (
          <QuotesEmptyState message={emptyMessage} />
        ) : (
          comments.map((comment) => (
            <article key={comment.id} className="rounded-xl border border-border/70 bg-background/60 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{comment.authorName}</p>
                  {comment.metaLabel ? <p className="text-xs text-muted-foreground">{comment.metaLabel}</p> : null}
                </div>
                <p className="text-xs text-muted-foreground">{comment.createdAtLabel}</p>
              </div>
              <div className="mt-3 text-sm leading-6 text-foreground/90">{comment.body}</div>
            </article>
          ))
        )}
      </div>
    </QuotesSectionCard>
  );
}

interface QuotesCommentFormProps extends Omit<ComponentPropsWithoutRef<"form">, "children"> {
  textareaName?: string;
  textareaId?: string;
  textareaLabel: string;
  textareaPlaceholder?: string;
  submitLabel: string;
  cancelLabel?: string;
  onCancelHref?: string;
  footer?: ReactNode;
}

export function QuotesCommentForm({
  textareaName = "comment",
  textareaId = "quotes-comment",
  textareaLabel,
  textareaPlaceholder,
  submitLabel,
  cancelLabel,
  onCancelHref,
  footer,
  className,
  ...props
}: QuotesCommentFormProps) {
  return (
    <form {...props} className={joinClasses("space-y-3", className)}>
      <div className="space-y-1.5">
        <label htmlFor={textareaId} className="text-sm font-medium text-foreground">
          {textareaLabel}
        </label>
        <textarea
          id={textareaId}
          name={textareaName}
          rows={4}
          placeholder={textareaPlaceholder}
          className={quotesTextareaClass}
        />
      </div>

      {footer ? <div>{footer}</div> : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {cancelLabel && onCancelHref ? (
          <a href={onCancelHref} className={quotesSecondaryButtonClass}>
            {cancelLabel}
          </a>
        ) : null}
        <button type="submit" className={quotesPrimaryButtonClass}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

interface QuotesCompactFieldProps extends ComponentPropsWithoutRef<"div"> {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}

export function QuotesCompactField({ label, htmlFor, hint, className, children, ...props }: QuotesCompactFieldProps) {
  return (
    <div {...props} className={joinClasses("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
