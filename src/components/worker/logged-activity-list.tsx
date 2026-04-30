"use client";

import { formatLocalDateTime } from "@/lib/date-time";
import {
  hoursToMinutesWithHoursDisplay,
  loggedHoursBetween,
  loggedMinutesBetween,
} from "@/lib/time";

type LoggedActivitySource = "timer" | "manual";

export interface LoggedActivityEntry {
  id: string;
  startedAt: string;
  endedAt: string | null;
  description?: string | null;
  source?: LoggedActivitySource;
  contextLabel?: string | null;
}

interface LoggedActivityListLabels {
  emptyMessage: string;
  running: string;
  timer: string;
  manual: string;
  started: string;
  ended: string;
  duration: string;
  description: string;
  noDescription: string;
}

interface LoggedActivityListProps {
  entries: LoggedActivityEntry[];
  tag: string;
  labels: LoggedActivityListLabels;
  className?: string;
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatCompactTimestamp(tag: string, value: string) {
  return formatLocalDateTime(value, tag, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFullTimestamp(tag: string, value: string | null) {
  return formatLocalDateTime(value, tag);
}

function formatCompactDuration(entry: LoggedActivityEntry, runningLabel: string) {
  if (!entry.endedAt) {
    return runningLabel;
  }

  const totalMinutes = loggedMinutesBetween(entry.startedAt, entry.endedAt);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${totalMinutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function formatDuration(entry: LoggedActivityEntry, runningLabel: string) {
  if (!entry.endedAt) {
    return runningLabel;
  }

  return hoursToMinutesWithHoursDisplay(loggedHoursBetween(entry.startedAt, entry.endedAt));
}

function sourceLabel(source: LoggedActivitySource | undefined, labels: LoggedActivityListLabels) {
  return source === "manual" ? labels.manual : labels.timer;
}

function sourceClassName(source: LoggedActivitySource | undefined) {
  return source === "manual"
    ? "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300"
    : "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300";
}

export function LoggedActivityList({ entries, tag, labels, className }: LoggedActivityListProps) {
  if (entries.length === 0) {
    return (
      <div className={joinClasses("rounded-xl border border-dashed border-border/80 bg-background/35 px-4 py-5 text-center text-sm text-muted-foreground", className)}>
        {labels.emptyMessage}
      </div>
    );
  }

  return (
    <div className={joinClasses("space-y-2", className)}>
      {entries.map((entry) => {
        const description = entry.description?.trim();
        const isRunning = !entry.endedAt;

        return (
          <details key={entry.id} className="group overflow-hidden rounded-xl border border-border/70 bg-background/55 transition-colors open:bg-background/75">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/45 [&::-webkit-details-marker]:hidden">
              <span className={joinClasses("h-2.5 w-2.5 shrink-0 rounded-full", isRunning ? "bg-brand-500 shadow-[0_0_0_4px_rgba(59,130,246,0.12)]" : "bg-muted-foreground/45")} />

              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {formatCompactTimestamp(tag, entry.startedAt)}
                  </span>
                  {entry.contextLabel ? (
                    <span className="max-w-48 truncate rounded-full border border-border/70 bg-background/65 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {entry.contextLabel}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {description || labels.noDescription}
                </span>
              </span>

              <span className="hidden shrink-0 items-center gap-2 sm:flex">
                <span className={joinClasses("rounded-full border px-2 py-0.5 text-[11px] font-medium", sourceClassName(entry.source))}>
                  {sourceLabel(entry.source, labels)}
                </span>
                <span className={joinClasses("rounded-full border px-2.5 py-1 text-xs font-semibold", isRunning ? "border-brand-500/25 bg-brand-500/10 text-brand-700 dark:text-brand-300" : "border-border bg-card/80 text-foreground")}>
                  {formatCompactDuration(entry, labels.running)}
                </span>
              </span>

              <svg className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>

            <div className="grid gap-3 border-t border-border/60 px-3 py-3 text-xs sm:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-card/45 px-3 py-2">
                <p className="uppercase tracking-wide text-muted-foreground">{labels.started}</p>
                <p className="mt-1 font-medium text-foreground">{formatFullTimestamp(tag, entry.startedAt)}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/45 px-3 py-2">
                <p className="uppercase tracking-wide text-muted-foreground">{labels.ended}</p>
                <p className="mt-1 font-medium text-foreground">{formatFullTimestamp(tag, entry.endedAt)}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/45 px-3 py-2">
                <p className="uppercase tracking-wide text-muted-foreground">{labels.duration}</p>
                <p className={joinClasses("mt-1 font-medium", isRunning ? "text-brand-700 dark:text-brand-300" : "text-foreground")}>
                  {formatDuration(entry, labels.running)}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card/45 px-3 py-2 sm:col-span-3">
                <p className="uppercase tracking-wide text-muted-foreground">{labels.description}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">
                  {description || labels.noDescription}
                </p>
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
