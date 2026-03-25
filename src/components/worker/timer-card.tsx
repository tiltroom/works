"use client";

import { useEffect, useState } from "react";
import { timerStartedAtToNowHours } from "@/lib/time";

interface TimerCardProps {
  startedAt: string;
  projectName: string;
  description: string | null;
  elapsedLabel: string;
  noDescriptionLabel: string;
}

export function TimerCard({ startedAt, projectName, description, elapsedLabel, noDescriptionLabel }: TimerCardProps) {
  const [elapsed, setElapsed] = useState("00:00:00");

  useEffect(() => {
    const formatElapsed = () => {
      const elapsedHours = timerStartedAtToNowHours(startedAt);
      const totalSeconds = Math.floor(elapsedHours * 3600);
      const hours = Math.floor(totalSeconds / 3600)
        .toString()
        .padStart(2, "0");
      const minutes = Math.floor((totalSeconds % 3600) / 60)
        .toString()
        .padStart(2, "0");
      const seconds = (totalSeconds % 60).toString().padStart(2, "0");
      setElapsed(`${hours}:${minutes}:${seconds}`);
    };

    formatElapsed();
    const interval = window.setInterval(() => {
      formatElapsed();
    }, 1000);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-2xl font-bold tracking-tight text-foreground">{projectName}</h3>
      {description ? (
        <p className="max-w-md line-clamp-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : (
        <p className="text-sm italic text-muted-foreground">{noDescriptionLabel}</p>
      )}
      <div className="mt-4 flex items-baseline gap-2">
        <span className="bg-gradient-to-r from-brand-500 via-brand-400 to-foreground bg-clip-text text-5xl font-mono font-bold tracking-tighter text-transparent tabular-nums">
          {elapsed}
        </span>
        <span className="text-sm font-medium text-brand-600 dark:text-brand-400">{elapsedLabel}</span>
      </div>
    </div>
  );
}
