import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { formatQuoteStatus, type QuoteStatus } from "@/lib/quotes";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export const quotesPanelClass = "rounded-2xl border border-border bg-card/80 backdrop-blur-sm";
export const quotesTableShellClass = "overflow-hidden rounded-xl border border-border/70 bg-background/45";
export const quotesTableHeadClass = "border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground";
export const quotesTableRowClass = "transition-colors hover:bg-accent/60";
export const quotesInputClass = "w-full rounded-lg border border-input bg-background/75 px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all";
export const quotesTextareaClass = "w-full resize-none rounded-lg border border-input bg-background/75 px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all";
export const quotesSelectClass = `${quotesInputClass} appearance-none`;

function statusTone(status: QuoteStatus) {
  switch (status) {
    case "draft":
      return "border-border/70 bg-background/70 text-muted-foreground";
    case "signed":
      return "border-brand-500/20 bg-brand-500/10 text-brand-700 dark:text-brand-300";
    case "converted":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    default:
      return "border-border/70 bg-background/70 text-muted-foreground";
  }
}

export function QuotesStatusBadge({ locale, status }: { locale: Locale; status: QuoteStatus }) {
  return (
    <span className={joinClasses("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", statusTone(status))}>
      {formatQuoteStatus(locale, status)}
    </span>
  );
}

export function QuotesMetricCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "brand" | "success" }) {
  return (
    <div
      className={joinClasses(
        "rounded-xl border bg-background/60 p-4",
        tone === "brand" && "border-brand-500/20",
        tone === "success" && "border-emerald-500/20",
        tone === "default" && "border-border/70",
      )}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function QuotesEmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className={`${quotesPanelClass} p-8 text-center`}>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function QuotesBackendNotice({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-amber-700/90 dark:text-amber-100/80">{description}</p>
    </div>
  );
}

export function QuoteCard({
  locale,
  title,
  status,
  subtitle,
  meta,
  actions,
  children,
}: {
  locale: Locale;
  title: string;
  status: QuoteStatus;
  subtitle?: string | null;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className={`${quotesPanelClass} p-6`}>
      <div className="flex flex-col gap-4 border-b border-border/70 pb-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold text-foreground">{title}</h3>
            <QuotesStatusBadge locale={locale} status={status} />
          </div>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          {meta ? <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div> : null}
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </article>
  );
}

export function QuoteMetaChip({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-border/70 bg-background/65 px-2.5 py-1">{children}</span>;
}
