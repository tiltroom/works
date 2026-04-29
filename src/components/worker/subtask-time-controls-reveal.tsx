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
    <div className="border-t border-border/60 bg-card/25 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{hint}</p>
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/65 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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

      {isExpanded ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
