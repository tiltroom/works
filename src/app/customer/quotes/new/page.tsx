import Link from "next/link";
import { createQuoteDraftAction } from "@/app/actions/quotes";
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

export default async function CustomerNewQuotePage() {
  const locale = await getLocale();
  await requireRole(["customer"]);

  return (
    <main className="w-full space-y-8">
      <header className="border-b border-border/70 pb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href="/customer/quotes" className="rounded-full border border-border/70 bg-background/60 px-3 py-1 transition-colors hover:bg-accent hover:text-accent-foreground">
            ← {t(locale, "Back to quotes", "Torna ai preventivi")}
          </Link>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t(locale, "New quote draft", "Nuova bozza preventivo")}</h1>
        <p className="mt-1 text-muted-foreground">{t(locale, "Create a new draft, then continue from its dedicated quote pages.", "Crea una nuova bozza, poi continua dalle sue pagine dedicate.")}</p>
      </header>

      <QuotesSectionCard
        title={t(locale, "Create new draft", "Crea nuova bozza")}
        description={t(locale, "Keep the summary compact, then use the rich text body for scope, imagery, and delivery details.", "Mantieni il riepilogo compatto, poi usa il corpo rich text per scopo, immagini e dettagli di consegna.")}
      >
        <form action={createQuoteDraftAction} className="grid gap-4">
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <label htmlFor="customer-quote-title" className="text-sm font-medium text-foreground">{t(locale, "Title", "Titolo")}</label>
              <input id="customer-quote-title" name="title" required className={quotesInputClass} placeholder={t(locale, "New product launch quote", "Preventivo lancio nuovo prodotto")} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="customer-quote-description" className="text-sm font-medium text-foreground">{t(locale, "Summary", "Sintesi")}</label>
              <textarea id="customer-quote-description" name="description" rows={3} className={quotesTextareaClass} placeholder={t(locale, "Objectives, timing, and budget context.", "Obiettivi, tempistiche e contesto budget.")} />
            </div>
          </div>

          <QuotesRichTextEditor
            name="contentHtml"
            jsonName="contentJson"
            label={t(locale, "Quote body", "Corpo del preventivo")}
            placeholder={t(locale, "Describe scope, deliverables, assumptions, milestones, and any references.", "Descrivi scopo, deliverable, assunzioni, milestone e riferimenti.")}
            helpText={t(locale, "Use rich text and inline images when visual context helps the team estimate accurately.", "Usa testo ricco e immagini inline quando il contesto visivo aiuta il team a stimare con precisione.")}
            imageButtonLabel={t(locale, "Insert image", "Inserisci immagine")}
            unsupportedImageTypeMessage={t(locale, "Only JPG, PNG, WEBP, and GIF files are allowed.", "Sono consentiti solo file JPG, PNG, WEBP e GIF.")}
            imageTooLargeMessage={t(locale, "Images must be 1MB or smaller.", "Le immagini devono essere da 1MB o meno.")}
            imageUploadErrorMessage={t(locale, "Image upload failed.", "Caricamento immagine non riuscito.")}
          />

          <div className="flex justify-end gap-2">
            <Link href="/customer/quotes" className={quotesSecondaryButtonClass}>{t(locale, "Cancel", "Annulla")}</Link>
            <button className={quotesPrimaryButtonClass}>{t(locale, "Save draft", "Salva bozza")}</button>
          </div>
        </form>
      </QuotesSectionCard>
    </main>
  );
}
