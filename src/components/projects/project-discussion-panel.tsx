"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  QuotesEmptyState,
  QuotesRichTextContent,
  QuotesRichTextEditor,
  QuotesSectionCard,
  QuotesStatusBadge,
  quotesPrimaryButtonClass,
  quotesSecondaryButtonClass,
} from "@/components/quotes";
import type { ProjectDiscussionMessageRecord } from "@/lib/quotes";
import type { AppRole } from "@/lib/types";
import { formatLocalDateTime } from "@/lib/date-time";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function sortMessages(messages: ProjectDiscussionMessageRecord[]) {
  return [...messages].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

function hasOriginalVersion(message: ProjectDiscussionMessageRecord) {
  const current = message.messageHtml?.trim() ?? "";
  const original = message.originalMessageHtml?.trim() ?? "";
  return Boolean(original) && original !== current;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

interface ProjectDiscussionLabels {
  emptyMessage: string;
  noMessageContent: string;
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

interface ProjectDiscussionPanelProps {
  title: string;
  description?: string;
  projectId: string;
  tag: string;
  messages: ProjectDiscussionMessageRecord[];
  currentUserId: string;
  currentUserRole: AppRole;
  canCompose: boolean;
  loadAction: (formData: FormData) => Promise<ProjectDiscussionMessageRecord[]>;
  addAction: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
  labels: ProjectDiscussionLabels;
}

export function ProjectDiscussionPanel({
  title,
  description,
  projectId,
  tag,
  messages,
  currentUserId,
  currentUserRole,
  canCompose,
  loadAction,
  addAction,
  updateAction,
  labels,
}: ProjectDiscussionPanelProps) {
  const [discussion, setDiscussion] = useState(() => sortMessages(messages));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null);
  const [composerKey, setComposerKey] = useState(0);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef(discussion.length);
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    setDiscussion(sortMessages(messages));
  }, [messages]);

  useEffect(() => {
    const previousCount = previousMessageCountRef.current;
    previousMessageCountRef.current = discussion.length;

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
      formData.set("projectId", projectId);
      const nextMessages = await loadAction(formData);
      setDiscussion(sortMessages(nextMessages));
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
  }, [labels.errorFallbackMessage, loadAction, projectId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshDiscussion(true);
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [refreshDiscussion]);

  const canEditMessage = useCallback((message: ProjectDiscussionMessageRecord) => {
    if (!canCompose) {
      return false;
    }

    return currentUserRole === "admin" || message.authorId === currentUserId;
  }, [canCompose, currentUserId, currentUserRole]);

  const sortedDiscussion = useMemo(() => sortMessages(discussion), [discussion]);

  async function handleAddMessage(formData: FormData) {
    setIsSending(true);
    setErrorMessage(null);

    try {
      formData.set("projectId", projectId);
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

  async function handleUpdateMessage(messageId: string, formData: FormData) {
    setSavingMessageId(messageId);
    setErrorMessage(null);

    try {
      formData.set("projectId", projectId);
      formData.set("messageId", messageId);
      await updateAction(formData);
      setEditingMessageId(null);
      await refreshDiscussion(true);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, labels.errorFallbackMessage));
    } finally {
      setSavingMessageId(null);
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
      id="project-discussion"
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
            sortedDiscussion.map((message) => {
              const isOwnMessage = message.authorId === currentUserId;
              const isEditing = editingMessageId === message.id;
              const isSavingEdit = savingMessageId === message.id;
              const showOriginalVersion = hasOriginalVersion(message);

              return (
                <div key={message.id} className={joinClasses("flex", isOwnMessage ? "justify-end" : "justify-start")}>
                  <article
                    className={joinClasses(
                      "w-full max-w-3xl rounded-2xl border px-4 py-3 shadow-sm",
                      isOwnMessage
                        ? "border-brand-500/20 bg-brand-500/10"
                        : "border-border/70 bg-background/60",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{message.authorName || labels.roleLabels[message.authorRole]}</p>
                          <QuotesStatusBadge label={labels.roleLabels[message.authorRole]} tone={message.authorRole === "admin" ? "warning" : message.authorRole === "customer" ? "info" : "success"} />
                          {message.editedAt ? <span className="text-xs font-medium text-muted-foreground">{labels.editedLabel}</span> : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatLocalDateTime(message.createdAt, tag)}
                          {message.editedAt ? ` • ${labels.editedLabel} ${formatLocalDateTime(message.editedAt, tag)}` : ""}
                        </p>
                      </div>

                      {canEditMessage(message) && !isEditing ? (
                        <button type="button" onClick={() => setEditingMessageId(message.id)} className={quotesSecondaryButtonClass}>
                          {labels.editLabel}
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-3 space-y-3">
                      {isEditing ? (
                        <form action={(formData) => handleUpdateMessage(message.id, formData)} className="space-y-3">
                          <fieldset disabled={isSavingEdit} className="space-y-3">
                            <QuotesRichTextEditor
                              key={`edit-${message.id}`}
                              name="messageHtml"
                              jsonName="messageJson"
                              label={labels.editLabel}
                              placeholder={labels.composerPlaceholder}
                              initialHtml={message.messageHtml ?? ""}
                              initialJson={message.messageJson}
                            />
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button type="button" className={quotesSecondaryButtonClass} onClick={() => setEditingMessageId(null)}>
                                {labels.cancelEditLabel}
                              </button>
                              <button type="submit" className={quotesPrimaryButtonClass}>
                                {isSavingEdit ? labels.savingEditLabel : labels.saveEditLabel}
                              </button>
                            </div>
                          </fieldset>
                        </form>
                      ) : (
                        <QuotesRichTextContent html={message.messageHtml ?? ""} emptyMessage={labels.noMessageContent} />
                      )}

                      {showOriginalVersion ? (
                        <details className="rounded-xl border border-dashed border-border/80 bg-background/40 px-3 py-3">
                          <summary className="cursor-pointer text-sm font-medium text-foreground">{labels.originalContentLabel}</summary>
                          <p className="mt-2 text-xs text-muted-foreground">{labels.originalContentHint}</p>
                          <div className="mt-3 rounded-lg border border-border/70 bg-background/70 px-3 py-3">
                            <QuotesRichTextContent html={message.originalMessageHtml ?? ""} emptyMessage={labels.noMessageContent} />
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
          <form action={handleAddMessage} className="space-y-3 rounded-2xl border border-border/70 bg-background/45 px-4 py-4">
            <fieldset disabled={isSending} className="space-y-3">
              <QuotesRichTextEditor
                key={`composer-${composerKey}`}
                name="messageHtml"
                jsonName="messageJson"
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
