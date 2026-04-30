import type { ReactNode } from "react";
import Link from "next/link";
import {
  QuotesMetaItem,
  QuotesSectionCard,
  QuotesStatusBadge,
  quotesPanelClass,
} from "@/components/quotes";

export interface ProjectDetailMetaItem {
  label: string;
  value: ReactNode;
  tone?: "default" | "accent" | "danger" | "success";
}

interface ProjectDetailShellProps {
  backHref: string;
  backLabel: string;
  title: string;
  description: string;
  projectName: string;
  projectDescription: string;
  badgeLabel?: string;
  badgeTone?: "neutral" | "info" | "success" | "warning" | "danger";
  meta: ProjectDetailMetaItem[];
  overview: ReactNode;
  secondary: ReactNode;
  discussion: ReactNode;
  headerAction?: ReactNode;
}

export function ProjectDetailShell({
  backHref,
  backLabel,
  title,
  description,
  projectName,
  projectDescription,
  badgeLabel,
  badgeTone = "neutral",
  meta,
  overview,
  secondary,
  discussion,
  headerAction,
}: ProjectDetailShellProps) {
  return (
    <main className="min-w-0 w-full space-y-8">
      <header className="border-b border-border/70 pb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <Link href={backHref} className="rounded-full border border-border/70 bg-background/60 px-3 py-1 transition-colors hover:bg-accent hover:text-accent-foreground">
            ← {backLabel}
          </Link>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </div>
        <h1 className="break-words text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </header>

      <section className="space-y-4">
        <section className={`${quotesPanelClass} overflow-hidden`}>
          <div className="space-y-4 border-b border-border/70 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="min-w-0 break-words text-2xl font-bold tracking-tight text-foreground">{projectName}</h2>
              {badgeLabel ? <QuotesStatusBadge label={badgeLabel} tone={badgeTone} /> : null}
            </div>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{projectDescription}</p>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {meta.map((item) => (
              <QuotesMetaItem key={item.label} label={item.label} value={item.value} tone={item.tone} />
            ))}
          </div>
        </section>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="min-w-0">{overview}</div>
          <div className="min-w-0">{secondary}</div>
        </div>

        {discussion}
      </section>
    </main>
  );
}

export { QuotesSectionCard };
