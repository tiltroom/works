import type { ReactNode } from "react";
import {
  QuotesMetaItem,
  QuotesSectionCard,
  QuotesStatusBadge,
} from "@/components/quotes/quotes-shared";

interface QuotesHeaderMetric {
  label: string;
  value: ReactNode;
  tone?: "default" | "accent" | "danger" | "success";
}

interface QuotesHeaderProps {
  title: string;
  code?: string | null;
  statusLabel: string;
  statusTone?: "neutral" | "info" | "success" | "warning" | "danger";
  description?: string | null;
  meta?: QuotesHeaderMetric[];
  action?: ReactNode;
}

export function QuotesHeader({
  title,
  code,
  statusLabel,
  statusTone = "neutral",
  description,
  meta = [],
  action,
}: QuotesHeaderProps) {
  return (
    <QuotesSectionCard
      title={title}
      description={description ?? undefined}
      action={action}
      className="overflow-hidden"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            {code ? <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{code}</p> : null}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
              <QuotesStatusBadge label={statusLabel} tone={statusTone} />
            </div>
          </div>
        </div>

        {meta.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {meta.map((item) => (
              <QuotesMetaItem
                key={item.label}
                label={item.label}
                value={item.value}
                tone={item.tone}
              />
            ))}
          </div>
        ) : null}
      </div>
    </QuotesSectionCard>
  );
}
