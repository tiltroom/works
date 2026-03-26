"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

interface ViewportModalProps {
  children: ReactNode;
  className?: string;
}

interface ViewportModalPanelProps {
  children: ReactNode;
  className?: string;
}

function subscribeToClientReady() {
  return () => {};
}

export function ViewportModal({ children, className }: ViewportModalProps) {
  const mounted = useSyncExternalStore(subscribeToClientReady, () => true, () => false);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className={joinClasses(
        "fixed inset-0 z-50 flex min-h-screen w-screen items-center justify-center bg-background/80 p-4 backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

export function ViewportModalPanel({ children, className }: ViewportModalPanelProps) {
  return (
    <div
      className={joinClasses(
        "w-full rounded-2xl border border-border bg-card shadow-2xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
