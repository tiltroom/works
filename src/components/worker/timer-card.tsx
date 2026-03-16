"use client";

import { useEffect, useState } from "react";
import { timerStartedAtToNowHours } from "@/lib/time";

interface TimerCardProps {
  startedAt: string;
  projectName: string;
  description: string | null;
}

export function TimerCard({ startedAt, projectName, description }: TimerCardProps) {
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
      <h3 className="text-2xl font-bold text-white tracking-tight">{projectName}</h3>
      {description ? (
        <p className="text-zinc-400 text-sm max-w-md line-clamp-2 leading-relaxed">{description}</p>
      ) : (
        <p className="text-zinc-500 text-sm italic">No description provided</p>
      )}
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-5xl font-mono font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] tabular-nums">
          {elapsed}
        </span>
        <span className="text-sm font-medium text-brand-400">elapsed</span>
      </div>
    </div>
  );
}
