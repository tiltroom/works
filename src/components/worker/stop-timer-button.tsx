"use client";

import { useTransition, useState } from "react";

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
        className="w-full md:w-auto rounded-xl bg-red-500/10 text-red-500 px-6 py-4 font-bold transition-all hover:bg-red-500 hover:text-white border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.15)] hover:shadow-[0_0_30px_rgba(239,68,68,0.3)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
        {isPending ? "..." : labels.stopTimer}
      </button>

      {error && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/20 px-5 py-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {labels.errorTitle}
              </h3>
              <button
                onClick={() => setError(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                aria-label={labels.close}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5">
              <p className="text-zinc-300 text-sm leading-relaxed mb-6">
                {error}
              </p>

              <div className="flex justify-end">
                <button
                  onClick={() => setError(null)}
                  className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 hover:border-zinc-600 border border-zinc-700 transition-all"
                >
                  {labels.close}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
