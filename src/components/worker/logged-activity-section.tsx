"use client";

import type { ReactNode } from "react";
import { useState } from "react";

interface LoggedActivitySectionProps {
  title: string;
  description?: string;
  showLabel: string;
  hideLabel: string;
  countLabel?: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}

export function LoggedActivitySection({
  title,
  description,
  showLabel,
  hideLabel,
  countLabel,
  defaultExpanded = false,
  children,
}: LoggedActivitySectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <section className="rounded-xl border border-border/70 bg-card/35">
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/45"
        aria-expanded={isExpanded}
      >
        <span className="min-w-0">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            {countLabel ? (
              <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {countLabel}
              </span>
            ) : null}
          </span>
          {description ? <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span> : null}
        </span>

        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background/65 px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
          {isExpanded ? hideLabel : showLabel}
          <svg className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {isExpanded ? <div className="border-t border-border/60 p-3">{children}</div> : null}
    </section>
  );
}
