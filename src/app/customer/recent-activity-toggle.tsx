"use client";

import { useState } from "react";

interface RecentActivityToggleProps {
  title: string;
  showLabel: string;
  hideLabel: string;
  exportUrl?: string;
  exportLabel?: string;
  children: React.ReactNode;
}

export function RecentActivityToggle({
  title,
  showLabel,
  hideLabel,
  exportUrl,
  exportLabel,
  children,
}: RecentActivityToggleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-6 border-t border-zinc-800/60 pt-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
          {title}
        </h4>
        <div className="flex items-center gap-2">
          {exportUrl && exportLabel ? (
            <a
              href={exportUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900/40 text-zinc-300 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exportLabel}
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900/50 text-zinc-300 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            {isExpanded ? (
              <>
                {hideLabel}
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </>
            ) : (
              <>
                {showLabel}
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
      
      {isExpanded && children}
    </div>
  );
}
