"use client";

import type { ReactNode } from "react";
import { useState } from "react";

interface SubtaskTimeControlsRevealProps {
  showLabel: string;
  hideLabel: string;
  hint: string;
  children: ReactNode;
}

export function SubtaskTimeControlsReveal({ showLabel, hideLabel, hint, children }: SubtaskTimeControlsRevealProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="min-w-0 border-t border-border/60 bg-card/25 px-3 py-3 sm:px-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">{hint}</p>
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background/65 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:w-auto"
        >
          {isExpanded ? (
            <>
              {hideLabel}
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </>
          ) : (
            <>
              {showLabel}
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>
      </div>

      {isExpanded ? <div className="mt-3 min-w-0">{children}</div> : null}
    </div>
  );
}
