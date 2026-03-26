"use client";

import { useTransition, useState } from "react";
import { ViewportModal, ViewportModalPanel } from "@/components/ui/viewport-modal";

interface StopTimerButtonProps {
  timeEntryId: string;
  stopTimerAction: (formData: FormData) => Promise<void>;
  labels: {
    stopTimer: string;
    errorTitle: string;
    close: string;
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "An error occurred while stopping the timer.";
}

export function StopTimerButton({ timeEntryId, stopTimerAction, labels }: StopTimerButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleStop = () => {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("timeEntryId", timeEntryId);
        await stopTimerAction(formData);
      } catch (error: unknown) {
        setError(getErrorMessage(error));
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleStop}
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-6 py-4 font-bold text-red-700 transition-all hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300 md:w-auto"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
        {isPending ? "..." : labels.stopTimer}
      </button>

      {error && (
        <ViewportModal>
          <ViewportModalPanel className="max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border bg-muted/35 px-5 py-4">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {labels.errorTitle}
              </h3>
              <button
                onClick={() => setError(null)}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                aria-label={labels.close}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5">
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                {error}
              </p>

              <div className="flex justify-end">
                <button
                  onClick={() => setError(null)}
                  className="rounded-lg border border-border bg-background/65 px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-accent hover:text-accent-foreground"
                >
                  {labels.close}
                </button>
              </div>
            </div>
          </ViewportModalPanel>
        </ViewportModal>
      )}
    </>
  );
}
