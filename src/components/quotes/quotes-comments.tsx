"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import {
  QuotesEmptyState,
  QuotesStatusBadge,
  QuotesSectionCard,
  quotesPrimaryButtonClass,
  quotesSecondaryButtonClass,
  quotesTextareaClass,
} from "@/components/quotes/quotes-shared";
import { QuotesRichTextContent } from "@/components/quotes/quotes-rich-text-content";
import { QuotesRichTextEditor } from "@/components/quotes/quotes-rich-text-editor";
import type { QuoteCommentRecord } from "@/lib/quotes";
import type { AppRole } from "@/lib/types";
import { formatLocalDateTime } from "@/lib/date-time";

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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function sortComments(comments: QuoteCommentRecord[]) {
  return [...comments].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

function hasOriginalVersion(comment: QuoteCommentRecord) {
  const current = comment.commentHtml?.trim() ?? "";
  const original = comment.originalCommentHtml?.trim() ?? "";
  return Boolean(original) && original !== current;
}

interface QuoteDiscussionLabels {
  emptyMessage: string;
  noCommentContent: string;
  composerLabel: string;
  composerPlaceholder: string;
  composerHelpText: string;
  sendLabel: string;
  sendingLabel: string;
  editLabel: string;
  cancelEditLabel: string;
  saveEditLabel: string;
  savingEditLabel: string;
  editedLabel: string;
  originalContentLabel: string;
  originalContentHint: string;
  liveUpdatesLabel: string;
  refreshingLabel: string;
  readOnlyLabel: string;
  errorFallbackMessage: string;
  roleLabels: Record<AppRole, string>;
}

interface QuoteDiscussionPanelProps {
  title: string;
  description?: string;
  quoteId: string;
  tag: string;
  comments: QuoteCommentRecord[];
  currentUserId: string;
  currentUserRole: AppRole;
  canCompose: boolean;
  loadAction: (formData: FormData) => Promise<QuoteCommentRecord[]>;
  addAction: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
  labels: QuoteDiscussionLabels;
}

export function QuoteDiscussionPanel({
  title,
  description,
  quoteId,
  tag,
  comments,
  currentUserId,
  currentUserRole,
  canCompose,
  loadAction,
  addAction,
  updateAction,
  labels,
}: QuoteDiscussionPanelProps) {
  const [discussion, setDiscussion] = useState(() => sortComments(comments));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);
  const [composerKey, setComposerKey] = useState(0);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const previousCommentCountRef = useRef(discussion.length);
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    setDiscussion(sortComments(comments));
  }, [comments]);

  useEffect(() => {
    const previousCount = previousCommentCountRef.current;
    previousCommentCountRef.current = discussion.length;

    if (discussion.length > previousCount) {
      scrollAnchorRef.current?.scrollIntoView({ behavior: previousCount === 0 ? "auto" : "smooth", block: "end" });
    }
  }, [discussion.length]);

  const refreshDiscussion = useCallback(async (silent = false) => {
    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;

    if (!silent) {
      setIsRefreshing(true);
    }

    try {
      const formData = new FormData();
      formData.set("quoteId", quoteId);
      const nextComments = await loadAction(formData);
      setDiscussion(sortComments(nextComments));
      if (!silent) {
        setErrorMessage(null);
      }
    } catch (error) {
      if (!silent) {
        setErrorMessage(getErrorMessage(error, labels.errorFallbackMessage));
      }
    } finally {
      refreshInFlightRef.current = false;
      if (!silent) {
        setIsRefreshing(false);
      }
    }
  }, [labels.errorFallbackMessage, loadAction, quoteId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshDiscussion(true);
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [refreshDiscussion]);

  const canEditComment = useCallback((comment: QuoteCommentRecord) => {
    if (!canCompose) {
      return false;
    }

    return currentUserRole === "admin" || comment.authorId === currentUserId;
  }, [canCompose, currentUserId, currentUserRole]);

  const sortedDiscussion = useMemo(() => sortComments(discussion), [discussion]);

  async function handleAddComment(formData: FormData) {
    setIsSending(true);
    setErrorMessage(null);

    try {
      formData.set("quoteId", quoteId);
      await addAction(formData);
      setComposerKey((current) => current + 1);
      await refreshDiscussion(true);
      scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, labels.errorFallbackMessage));
    } finally {
      setIsSending(false);
    }
  }

  async function handleUpdateComment(commentId: string, formData: FormData) {
    setSavingCommentId(commentId);
    setErrorMessage(null);

    try {
      formData.set("quoteId", quoteId);
      formData.set("commentId", commentId);
      await updateAction(formData);
      setEditingCommentId(null);
      await refreshDiscussion(true);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, labels.errorFallbackMessage));
    } finally {
      setSavingCommentId(null);
    }
  }

  return (
    <QuotesSectionCard
      title={title}
      description={description}
      action={(
        <button type="button" onClick={() => void refreshDiscussion(false)} className={quotesSecondaryButtonClass} disabled={isRefreshing}>
          {isRefreshing ? labels.refreshingLabel : labels.liveUpdatesLabel}
        </button>
      )}
      id="quote-discussion"
    >
      <div className="space-y-4">
        {errorMessage ? (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {errorMessage}
          </div>
        ) : null}

        <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
          {sortedDiscussion.length === 0 ? (
            <QuotesEmptyState message={labels.emptyMessage} />
          ) : (
            sortedDiscussion.map((comment) => {
              const isOwnComment = comment.authorId === currentUserId;
              const isEditing = editingCommentId === comment.id;
              const isSavingEdit = savingCommentId === comment.id;
              const showOriginalVersion = hasOriginalVersion(comment);

              return (
                <div key={comment.id} className={joinClasses("flex", isOwnComment ? "justify-end" : "justify-start")}>
                  <article
                    className={joinClasses(
                      "w-full max-w-3xl rounded-2xl border px-4 py-3 shadow-sm",
                      isOwnComment
                        ? "border-brand-500/20 bg-brand-500/10"
                        : "border-border/70 bg-background/60",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{comment.authorName || labels.roleLabels[comment.authorRole]}</p>
                          <QuotesStatusBadge label={labels.roleLabels[comment.authorRole]} tone={comment.authorRole === "admin" ? "warning" : comment.authorRole === "customer" ? "info" : "success"} />
                          {comment.editedAt ? <span className="text-xs font-medium text-muted-foreground">{labels.editedLabel}</span> : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatLocalDateTime(comment.createdAt, tag)}
                          {comment.editedAt ? ` • ${labels.editedLabel} ${formatLocalDateTime(comment.editedAt, tag)}` : ""}
                        </p>
                      </div>

                      {canEditComment(comment) && !isEditing ? (
                        <button type="button" onClick={() => setEditingCommentId(comment.id)} className={quotesSecondaryButtonClass}>
                          {labels.editLabel}
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-3 space-y-3">
                      {isEditing ? (
                        <form action={(formData) => handleUpdateComment(comment.id, formData)} className="space-y-3">
                          <fieldset disabled={isSavingEdit} className="space-y-3">
                            <QuotesRichTextEditor
                              key={`edit-${comment.id}`}
                              name="commentHtml"
                              jsonName="commentJson"
                              label={labels.editLabel}
                              placeholder={labels.composerPlaceholder}
                              initialHtml={comment.commentHtml ?? ""}
                              initialJson={comment.commentJson}
                            />
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button type="button" className={quotesSecondaryButtonClass} onClick={() => setEditingCommentId(null)}>
                                {labels.cancelEditLabel}
                              </button>
                              <button type="submit" className={quotesPrimaryButtonClass}>
                                {isSavingEdit ? labels.savingEditLabel : labels.saveEditLabel}
                              </button>
                            </div>
                          </fieldset>
                        </form>
                      ) : (
                        <QuotesRichTextContent html={comment.commentHtml ?? ""} emptyMessage={labels.noCommentContent} />
                      )}

                      {showOriginalVersion ? (
                        <details className="rounded-xl border border-dashed border-border/80 bg-background/40 px-3 py-3">
                          <summary className="cursor-pointer text-sm font-medium text-foreground">{labels.originalContentLabel}</summary>
                          <p className="mt-2 text-xs text-muted-foreground">{labels.originalContentHint}</p>
                          <div className="mt-3 rounded-lg border border-border/70 bg-background/70 px-3 py-3">
                            <QuotesRichTextContent html={comment.originalCommentHtml ?? ""} emptyMessage={labels.noCommentContent} />
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </article>
                </div>
              );
            })
          )}
          <div ref={scrollAnchorRef} />
        </div>

        {canCompose ? (
          <form action={handleAddComment} className="space-y-3 rounded-2xl border border-border/70 bg-background/45 px-4 py-4">
            <fieldset disabled={isSending} className="space-y-3">
              <QuotesRichTextEditor
                key={`composer-${composerKey}`}
                name="commentHtml"
                jsonName="commentJson"
                label={labels.composerLabel}
                placeholder={labels.composerPlaceholder}
                helpText={labels.composerHelpText}
              />
              <div className="flex justify-end">
                <button type="submit" className={quotesPrimaryButtonClass}>
                  {isSending ? labels.sendingLabel : labels.sendLabel}
                </button>
              </div>
            </fieldset>
          </form>
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
            {labels.readOnlyLabel}
          </div>
        )}
      </div>
    </QuotesSectionCard>
  );
}
