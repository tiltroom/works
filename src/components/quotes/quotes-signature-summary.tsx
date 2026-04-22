import { QuotesSectionCard, quotesInsetClass } from "@/components/quotes/quotes-shared";

interface QuotesSignatureSummaryProps {
  title: string;
  description?: string;
  signerLabel?: string;
  signedAtTitle?: string;
  signerName?: string | null;
  signerEmail?: string | null;
  signedAtLabel?: string | null;
  ipAddressLabel?: string | null;
  signatureSteps?: Array<{
    key: string;
    signerLabel: string;
    signedAtTitle: string;
    signerName?: string | null;
    signerEmail?: string | null;
    signedAtLabel?: string | null;
    ipAddressLabel?: string | null;
    emptyMessage: string;
  }>;
  emptyMessage: string;
}

export function QuotesSignatureSummary({
  title,
  description,
  signerLabel,
  signedAtTitle,
  signerName,
  signerEmail,
  signedAtLabel,
  ipAddressLabel,
  signatureSteps,
  emptyMessage,
}: QuotesSignatureSummaryProps) {
  if (signatureSteps && signatureSteps.length > 0) {
    return (
      <QuotesSectionCard title={title} description={description}>
        <div className="space-y-3">
          {signatureSteps.map((step) => {
            const hasSignature = Boolean(step.signerName || step.signerEmail || step.signedAtLabel || step.ipAddressLabel);

            return hasSignature ? (
              <div key={step.key} className="grid gap-3 sm:grid-cols-2">
                <div className={quotesInsetClass + " px-3 py-3"}>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{step.signerLabel}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{step.signerName || "—"}</p>
                  {step.signerEmail ? <p className="mt-1 text-sm text-muted-foreground">{step.signerEmail}</p> : null}
                </div>
                <div className={quotesInsetClass + " px-3 py-3"}>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{step.signedAtTitle}</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{step.signedAtLabel || "—"}</p>
                  {step.ipAddressLabel ? <p className="mt-1 text-sm text-muted-foreground">IP {step.ipAddressLabel}</p> : null}
                </div>
              </div>
            ) : (
              <div key={step.key} className="rounded-xl border border-dashed border-border/80 bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground">
                {step.emptyMessage}
              </div>
            );
          })}
        </div>
      </QuotesSectionCard>
    );
  }

  const hasSignature = Boolean(signerName || signerEmail || signedAtLabel || ipAddressLabel);

  return (
    <QuotesSectionCard title={title} description={description}>
      {hasSignature ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={quotesInsetClass + " px-3 py-3"}>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{signerLabel}</p>
            <p className="mt-1 text-sm font-medium text-foreground">{signerName || "—"}</p>
            {signerEmail ? <p className="mt-1 text-sm text-muted-foreground">{signerEmail}</p> : null}
          </div>
          <div className={quotesInsetClass + " px-3 py-3"}>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{signedAtTitle}</p>
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
