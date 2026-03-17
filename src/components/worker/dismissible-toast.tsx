"use client";

import { useEffect } from "react";

interface DismissibleToastProps {
  variant: "success" | "error";
  message: string;
  closeLabel: string;
  onClose: () => void;
  autoCloseMs?: number;
}

export function DismissibleToast({ variant, message, closeLabel, onClose, autoCloseMs = 4000 }: DismissibleToastProps) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onClose, autoCloseMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [autoCloseMs, onClose]);

  const isSuccess = variant === "success";

  return (
    <div className="fixed right-4 top-4 z-[60] w-full max-w-sm animate-in fade-in slide-in-from-top-2 duration-200">
      <div
        className={`rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${
          isSuccess
            ? "border-emerald-500/30 bg-emerald-950/95 text-emerald-50"
            : "border-red-500/30 bg-red-950/95 text-red-50"
        }`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
              isSuccess
                ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                : "border-red-400/30 bg-red-500/15 text-red-300"
            }`}
          >
            {isSuccess ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 13 4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM10.615 3.891 1.891 18.75A1.5 1.5 0 0 0 3.184 21h17.632a1.5 1.5 0 0 0 1.293-2.25L13.385 3.89a1.5 1.5 0 0 0-2.77 0Z" />
              </svg>
            )}
          </span>

          <div className="min-w-0 flex-1 pr-1">
            <p className="text-sm font-medium leading-5">{message}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-current/70 transition-colors hover:bg-black/10 hover:text-current"
            aria-label={closeLabel}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
