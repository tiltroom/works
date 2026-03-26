import { QuotesSectionCard, quotesInsetClass } from "@/components/quotes/quotes-shared";

interface QuotesSignatureSummaryProps {
  title: string;
  description?: string;
  signerName?: string | null;
  signerEmail?: string | null;
  signedAtLabel?: string | null;
  ipAddressLabel?: string | null;
  emptyMessage: string;
}

export function QuotesSignatureSummary({
  title,
  description,
  signerName,
  signerEmail,
  signedAtLabel,
  ipAddressLabel,
  emptyMessage,
}: QuotesSignatureSummaryProps) {
  const hasSignature = Boolean(signerName || signerEmail || signedAtLabel || ipAddressLabel);

  return (
    <QuotesSectionCard title={title} description={description}>
      {hasSignature ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={quotesInsetClass + " px-3 py-3"}>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Signer</p>
            <p className="mt-1 text-sm font-medium text-foreground">{signerName || "—"}</p>
            {signerEmail ? <p className="mt-1 text-sm text-muted-foreground">{signerEmail}</p> : null}
          </div>
          <div className={quotesInsetClass + " px-3 py-3"}>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Signed at</p>
            <p className="mt-1 text-sm font-medium text-foreground">{signedAtLabel || "—"}</p>
            {ipAddressLabel ? <p className="mt-1 text-sm text-muted-foreground">IP {ipAddressLabel}</p> : null}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/80 bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )}
    </QuotesSectionCard>
  );
}
