import Link from "next/link";
import { notFound } from "next/navigation";
import { loadQuotesPageData, updateQuoteDraftAction } from "@/app/actions/quotes";
import {
  quotesInputClass,
  quotesPrimaryButtonClass,
  QuotesRichTextEditor,
  QuotesSectionCard,
  quotesSecondaryButtonClass,
  quotesTextareaClass,
} from "@/components/quotes";
import { requireRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function CustomerQuoteEditPage({
  params,
}: {
  params: Promise<{ quoteId: string }> | { quoteId: string };
}) {
  const locale = await getLocale();
  const profile = await requireRole(["customer"]);
  const routeParams = await Promise.resolve(params);
  const quoteId = routeParams.quoteId?.trim();
  const quotesData = await loadQuotesPageData("customer", profile.id);
  const quote = quotesData.quotes.find((entry) => entry.id === quoteId) ?? null;

  if (!quote || quote.status !== "draft") {
    notFound();
  }

  return (
    <main className="w-full space-y-8">
      <header className="border-b border-border/70 pb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/customer/quotes/${quote.id}`} className="rounded-full border border-border/70 bg-background/60 px-3 py-1 transition-colors hover:bg-accent hover:text-accent-foreground">
            ← {t(locale, "Back to quote", "Torna al preventivo")}
          </Link>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t(locale, "Edit quote draft", "Modifica bozza preventivo")}</h1>
        <p className="mt-1 text-muted-foreground">{t(locale, "Update the draft in its dedicated editing view.", "Aggiorna la bozza nella sua vista di modifica dedicata.")}</p>
      </header>

      <QuotesSectionCard
        title={t(locale, "Edit draft", "Modifica bozza")}
        description={t(locale, "Update the rich text body while the quote is still draft.", "Aggiorna il corpo rich text mentre il preventivo è ancora in bozza.")}
        action={<Link href={`/customer/quotes/${quote.id}`} className={quotesSecondaryButtonClass}>{t(locale, "Close", "Chiudi")}</Link>}
      >
        <form action={updateQuoteDraftAction} className="grid gap-4">
          <input type="hidden" name="quoteId" value={quote.id} />
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <label htmlFor="edit-customer-quote-title" className="text-sm font-medium text-foreground">{t(locale, "Title", "Titolo")}</label>
              <input id="edit-customer-quote-title" name="title" required defaultValue={quote.title} className={quotesInputClass} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-customer-quote-description" className="text-sm font-medium text-foreground">{t(locale, "Summary", "Sintesi")}</label>
              <textarea id="edit-customer-quote-description" name="description" rows={3} defaultValue={quote.description ?? ""} className={quotesTextareaClass} />
            </div>
          </div>

          <QuotesRichTextEditor
            name="contentHtml"
            jsonName="contentJson"
            label={t(locale, "Quote body", "Corpo del preventivo")}
            initialHtml={quote.contentHtml ?? ""}
            initialJson={quote.contentJson}
            placeholder={t(locale, "Describe scope, deliverables, assumptions, milestones, and any references.", "Descrivi scopo, deliverable, assunzioni, milestone e riferimenti.")}
            helpText={t(locale, "Use the same editor and upload flow as the final customer draft body.", "Usa lo stesso editor e flusso di upload del corpo finale della bozza cliente.")}
            imageButtonLabel={t(locale, "Insert image", "Inserisci immagine")}
            unsupportedImageTypeMessage={t(locale, "Only JPG, PNG, WEBP, and GIF files are allowed.", "Sono consentiti solo file JPG, PNG, WEBP e GIF.")}
            imageTooLargeMessage={t(locale, "Images must be 1MB or smaller.", "Le immagini devono essere da 1MB o meno.")}
            imageUploadErrorMessage={t(locale, "Image upload failed.", "Caricamento immagine non riuscito.")}
          />

          <div className="flex justify-end gap-2">
            <Link href={`/customer/quotes/${quote.id}`} className={quotesSecondaryButtonClass}>{t(locale, "Cancel", "Annulla")}</Link>
            <button className={quotesPrimaryButtonClass}>{t(locale, "Save changes", "Salva modifiche")}</button>
          </div>
        </form>
      </QuotesSectionCard>
    </main>
  );
}
