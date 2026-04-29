"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ViewportModal, ViewportModalPanel } from "@/components/ui/viewport-modal";
import { formatEstimateWarningHours, parseOverEstimateWarningMessage, type OverEstimateWarningPayload } from "@/lib/time-entry-warnings";
import { timerStartedAtToNowHours } from "@/lib/time";

interface SubtaskTimeControlsLabels {
  startTimer: string;
  stopTimer: string;
  manualLog: string;
  note: string;
  notePlaceholder: string;
  startTime: string;
  endTime: string;
  saveManual: string;
  saving: string;
  close: string;
  cancel: string;
  errorTitle: string;
  warningTitle: string;
  warningDescription: string;
  estimate: string;
  alreadyLogged: string;
  newEntry: string;
  afterSave: string;
  overBy: string;
  continueAnyway: string;
  elapsed: string;
}

interface SubtaskTimeControlsProps {
  projectId: string;
  quoteSubtaskId: string;
  startTimerAction: (formData: FormData) => Promise<void>;
  stopTimerAction: (formData: FormData) => Promise<void>;
  createManualTimeEntryAction: (formData: FormData) => Promise<void>;
  runningTimer: {
    id: string;
    startedAt: string;
    quoteSubtaskId: string | null;
  } | null;
  labels: SubtaskTimeControlsLabels;
}

type PendingAction = "timer" | "manual" | null;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function formatForDatetimeLocal(value: Date) {
  const offset = value.getTimezoneOffset() * 60000;
  const local = new Date(value.getTime() - offset);
  return local.toISOString().slice(0, 16);
}

function buildManualFormData(form: HTMLFormElement, projectId: string, quoteSubtaskId: string, confirmed: boolean) {
  const formData = new FormData(form);
  formData.set("projectId", projectId);
  formData.set("quoteSubtaskId", quoteSubtaskId);
  if (confirmed) {
    formData.set("confirmOverEstimate", "true");
  } else {
    formData.delete("confirmOverEstimate");
  }
  return formData;
}

function buildStopFormData(timeEntryId: string, confirmed: boolean) {
  const formData = new FormData();
  formData.set("timeEntryId", timeEntryId);
  if (confirmed) {
    formData.set("confirmOverEstimate", "true");
  }
  return formData;
}

function WarningDetails({ warning, labels }: { warning: OverEstimateWarningPayload; labels: SubtaskTimeControlsLabels }) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">{warning.message}</p>
      <div className="grid gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-amber-700/80 dark:text-amber-300/80">{labels.estimate}</p>
          <p className="mt-1 font-semibold text-foreground">{formatEstimateWarningHours(warning.estimatedHours)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-amber-700/80 dark:text-amber-300/80">{labels.alreadyLogged}</p>
          <p className="mt-1 font-semibold text-foreground">{formatEstimateWarningHours(warning.loggedHours)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-amber-700/80 dark:text-amber-300/80">{labels.newEntry}</p>
          <p className="mt-1 font-semibold text-foreground">{formatEstimateWarningHours(warning.addedHours)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-amber-700/80 dark:text-amber-300/80">{labels.afterSave}</p>
          <p className="mt-1 font-semibold text-foreground">{formatEstimateWarningHours(warning.projectedHours)}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-[11px] uppercase tracking-wide text-amber-700/80 dark:text-amber-300/80">{labels.overBy}</p>
          <p className="mt-1 font-semibold text-amber-800 dark:text-amber-200">{formatEstimateWarningHours(warning.overByHours)}</p>
        </div>
      </div>
    </div>
  );
}

export function SubtaskTimeControls({
  projectId,
  quoteSubtaskId,
  startTimerAction,
  stopTimerAction,
  createManualTimeEntryAction,
  runningTimer,
  labels,
}: SubtaskTimeControlsProps) {
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<OverEstimateWarningPayload | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<{ kind: "stop"; timeEntryId: string } | { kind: "manual"; form: HTMLFormElement } | null>(null);
  const [manualFormForWarning, setManualFormForWarning] = useState<HTMLFormElement | null>(null);
  const [timerStopForWarning, setTimerStopForWarning] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState("00:00:00");
  const isRunningThisSubtask = runningTimer?.quoteSubtaskId === quoteSubtaskId;
  const hasOtherRunningTimer = Boolean(runningTimer && !isRunningThisSubtask);

  useEffect(() => {
    if (!isRunningThisSubtask || !runningTimer) {
      return;
    }

    const formatElapsed = () => {
      const elapsedHours = timerStartedAtToNowHours(runningTimer.startedAt);
      const totalSeconds = Math.floor(elapsedHours * 3600);
      const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
      const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
      const seconds = (totalSeconds % 60).toString().padStart(2, "0");
      setElapsed(`${hours}:${minutes}:${seconds}`);
    };

    formatElapsed();
    const interval = window.setInterval(formatElapsed, 1000);
    return () => window.clearInterval(interval);
  }, [isRunningThisSubtask, runningTimer]);

  const defaultEndTime = useMemo(() => formatForDatetimeLocal(new Date()), []);

  const runAction = async (kind: Exclude<PendingAction, null>, action: () => Promise<void>) => {
    setPendingAction(kind);
    setError(null);
    setWarning(null);

    try {
      await action();
      return "ok" as const;
    } catch (error: unknown) {
      const message = getErrorMessage(error, labels.errorTitle);
      const parsedWarning = parseOverEstimateWarningMessage(message);
      if (parsedWarning) {
        setWarning(parsedWarning);
        return "warning" as const;
      } else {
        setError(message);
        return "error" as const;
      }
    } finally {
      setPendingAction(null);
    }
  };

  const handleStartTimer = () => {
    startTransition(async () => {
      await runAction("timer", async () => {
        const formData = new FormData();
        formData.set("projectId", projectId);
        formData.set("quoteSubtaskId", quoteSubtaskId);
        await startTimerAction(formData);
      });
    });
  };

  const handleStopTimer = (confirmed = false) => {
    if (!runningTimer) {
      return;
    }

    startTransition(async () => {
      if (!confirmed) {
        setTimerStopForWarning(runningTimer.id);
        setManualFormForWarning(null);
      }
      const result = await runAction("timer", async () => {
        await stopTimerAction(buildStopFormData(runningTimer.id, confirmed));
      });

      if (result !== "warning") {
        setTimerStopForWarning(null);
      }

      if (confirmed && result !== "warning") {
        setPendingConfirmation(null);
        setTimerStopForWarning(null);
      }
    });
  };

  const handleManualSubmit = (formData: FormData) => {
    void formData;
    const form = document.getElementById(`manual-log-${quoteSubtaskId}`) as HTMLFormElement | null;
    if (!form) {
      return;
    }

    startTransition(async () => {
      setManualFormForWarning(form);
      setTimerStopForWarning(null);
      const result = await runAction("manual", async () => {
        await createManualTimeEntryAction(buildManualFormData(form, projectId, quoteSubtaskId, false));
        form.reset();
      });

      if (result !== "warning") {
        setManualFormForWarning(null);
      }
    });
  };

  useEffect(() => {
    if (!warning) {
      return;
    }

    if (timerStopForWarning) {
      setPendingConfirmation({ kind: "stop", timeEntryId: timerStopForWarning });
      return;
    }

    if (manualFormForWarning) {
      setPendingConfirmation({ kind: "manual", form: manualFormForWarning });
    }
  }, [manualFormForWarning, timerStopForWarning, warning]);

  const handleConfirmWarning = () => {
    if (!pendingConfirmation) {
      return;
    }

    if (pendingConfirmation.kind === "stop") {
      handleStopTimer(true);
      setWarning(null);
      return;
    }

    const form = pendingConfirmation.form;
    startTransition(async () => {
      const result = await runAction("manual", async () => {
        await createManualTimeEntryAction(buildManualFormData(form, projectId, quoteSubtaskId, true));
        form.reset();
      });
      if (result !== "warning") {
        setPendingConfirmation(null);
        setManualFormForWarning(null);
        setWarning(null);
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {isRunningThisSubtask ? (
          <>
            <span className="inline-flex items-center gap-2 rounded-lg border border-brand-500/25 bg-brand-500/10 px-3 py-2 text-xs font-medium text-brand-700 dark:text-brand-300">
              <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
              {elapsed} {labels.elapsed}
            </span>
            <button
              type="button"
              onClick={() => handleStopTimer(false)}
              disabled={isPending || pendingAction === "timer"}
              className="inline-flex items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300"
            >
              {pendingAction === "timer" ? labels.saving : labels.stopTimer}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleStartTimer}
            disabled={isPending || pendingAction === "timer" || hasOtherRunningTimer}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "timer" ? labels.saving : labels.startTimer}
          </button>
        )}
      </div>

      <form id={`manual-log-${quoteSubtaskId}`} action={handleManualSubmit} className="grid gap-3 rounded-xl border border-border/60 bg-background/45 p-3 md:grid-cols-2">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="quoteSubtaskId" value={quoteSubtaskId} />
        <div className="space-y-1.5">
          <label htmlFor={`manual-start-${quoteSubtaskId}`} className="text-xs font-medium text-muted-foreground">{labels.startTime}</label>
          <input id={`manual-start-${quoteSubtaskId}`} name="startedAt" type="datetime-local" required className="w-full rounded-lg border border-input bg-background/75 px-3 py-2 text-xs text-foreground transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`manual-end-${quoteSubtaskId}`} className="text-xs font-medium text-muted-foreground">{labels.endTime}</label>
          <input id={`manual-end-${quoteSubtaskId}`} name="endedAt" type="datetime-local" required defaultValue={defaultEndTime} className="w-full rounded-lg border border-input bg-background/75 px-3 py-2 text-xs text-foreground transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <label htmlFor={`manual-note-${quoteSubtaskId}`} className="text-xs font-medium text-muted-foreground">{labels.note}</label>
          <textarea id={`manual-note-${quoteSubtaskId}`} name="description" rows={2} placeholder={labels.notePlaceholder} className="w-full resize-none rounded-lg border border-input bg-background/75 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>
        <div className="md:col-span-2">
          <button type="submit" disabled={isPending || pendingAction === "manual"} className="inline-flex w-full items-center justify-center rounded-lg border border-border bg-background/70 px-3 py-2 text-xs font-semibold text-foreground transition-all hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
            {pendingAction === "manual" ? labels.saving : labels.saveManual}
          </button>
        </div>
      </form>

      {error ? (
        <ViewportModal>
          <ViewportModalPanel className="max-w-md overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-lg font-semibold text-foreground">{labels.errorTitle}</h3>
              <button type="button" onClick={() => setError(null)} className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground" aria-label={labels.close}>×</button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm leading-6 text-muted-foreground">{error}</p>
              <div className="flex justify-end">
                <button type="button" onClick={() => setError(null)} className="rounded-lg border border-border bg-background/65 px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-accent hover:text-accent-foreground">
                  {labels.close}
                </button>
              </div>
            </div>
          </ViewportModalPanel>
        </ViewportModal>
      ) : null}

      {warning ? (
        <ViewportModal>
          <ViewportModalPanel className="max-w-lg overflow-hidden">
            <div role="alertdialog" aria-modal="true">
              <div className="border-b border-amber-500/20 bg-amber-500/10 px-5 py-4">
                <h3 className="text-lg font-semibold text-foreground">{labels.warningTitle}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{labels.warningDescription}</p>
              </div>
              <div className="space-y-5 p-5">
                <WarningDetails warning={warning} labels={labels} />
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => { setWarning(null); setPendingConfirmation(null); }} className="rounded-lg border border-border bg-background/65 px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-accent hover:text-accent-foreground">
                    {labels.cancel}
                  </button>
                  <button type="button" onClick={handleConfirmWarning} disabled={isPending} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60">
                    {isPending ? labels.saving : labels.continueAnyway}
                  </button>
                </div>
              </div>
            </div>
          </ViewportModalPanel>
        </ViewportModal>
      ) : null}
    </div>
  );
}
