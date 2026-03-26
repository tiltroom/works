import type { ComponentPropsWithoutRef, ReactNode } from "react";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export const quotesPanelClass = "rounded-2xl border border-border bg-card/80 backdrop-blur-sm";
export const quotesInsetClass = "rounded-xl border border-border/70 bg-background/60";
export const quotesInputClass = "w-full rounded-lg border border-input bg-background/75 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500";
export const quotesTextareaClass = "w-full resize-none rounded-lg border border-input bg-background/75 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500";
export const quotesPrimaryButtonClass = "inline-flex items-center justify-center rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60";
export const quotesSecondaryButtonClass = "inline-flex items-center justify-center rounded-lg border border-border bg-background/60 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60";

interface QuotesSectionCardProps extends ComponentPropsWithoutRef<"section"> {
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function QuotesSectionCard({
  title,
  description,
  action,
  className,
  children,
  ...props
}: QuotesSectionCardProps) {
  return (
    <section {...props} className={joinClasses(quotesPanelClass, className)}>
      {(title || description || action) && (
        <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title ? <h2 className="text-sm font-semibold text-foreground sm:text-base">{title}</h2> : null}
            {description ? <p className="text-xs leading-5 text-muted-foreground sm:text-sm">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

interface QuotesEmptyStateProps {
  message: string;
}

export function QuotesEmptyState({ message }: QuotesEmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-border/80 bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

interface QuotesMetaItemProps {
  label: string;
  value: ReactNode;
  tone?: "default" | "accent" | "danger" | "success";
}

export function QuotesMetaItem({ label, value, tone = "default" }: QuotesMetaItemProps) {
  const valueClassName = tone === "accent"
    ? "text-brand-700 dark:text-brand-300"
    : tone === "danger"
      ? "text-red-700 dark:text-red-300"
      : tone === "success"
        ? "text-emerald-700 dark:text-emerald-300"
        : "text-foreground";

  return (
    <div className={quotesInsetClass + " px-3 py-2"}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className={joinClasses("mt-1 text-sm font-medium", valueClassName)}>{value}</div>
    </div>
  );
}

interface QuotesStatusBadgeProps {
  label: string;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
}

export function QuotesStatusBadge({ label, tone = "neutral" }: QuotesStatusBadgeProps) {
  const toneClassName = tone === "info"
    ? "border-brand-500/20 bg-brand-500/10 text-brand-700 dark:text-brand-300"
    : tone === "success"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "warning"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : tone === "danger"
          ? "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300"
          : "border-border bg-background/70 text-muted-foreground";

  return (
    <span className={joinClasses("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", toneClassName)}>
      {label}
    </span>
  );
}
