export type EmailEventType = "quote_created" | "quote_converted" | "quote_reverted";

type RecipientRole = "admin" | "customer" | "worker";

type Locale = "en" | "it";

interface RenderedEmail {
  subject: string;
  html: string;
}

interface CreatedParams {
  locale: string;
  quoteTitle: string;
  quoteId: string;
  customerName: string;
  appUrl: string;
}

interface ConvertedParams extends CreatedParams {
  recipientRole?: RecipientRole;
}

interface RevertedParams extends CreatedParams {
  recipientRole?: RecipientRole;
}

const STYLES = {
  body: "margin:0;padding:0;background-color:#f4f5f7;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;",
  wrapper: "max-width:600px;margin:0 auto;padding:24px;",
  card: "background-color:#ffffff;border-radius:8px;border:1px solid #e0e0e0;overflow:hidden;",
  header: "background-color:#1a1a2e;color:#ffffff;padding:24px 32px;",
  headerTitle: "margin:0;font-size:20px;font-weight:600;",
  content: "padding:24px 32px;",
  paragraph: "margin:0 0 16px;font-size:15px;line-height:1.6;color:#333333;",
  detailRow: "margin:0 0 8px;font-size:14px;line-height:1.5;color:#555555;",
  detailLabel: "font-weight:600;color:#333333;",
  ctaButton: "display:inline-block;padding:12px 24px;background-color:#1a1a2e;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;",
  footer: "padding:16px 32px 24px;font-size:12px;color:#999999;text-align:center;",
} as const;

function t(locale: Locale, en: string, it: string) {
  return locale === "it" ? it : en;
}

function normalizeLocale(value: string): Locale {
  return value === "it" ? "it" : "en";
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildLink(appUrl: string, quoteId: string, role?: RecipientRole): string {
  const base = appUrl.replace(/\/+$/, "");
  const segment = role ?? "admin";
  return `${base}/${segment}/quotes/${quoteId}`;
}

function buildEmailHtml(locale: Locale, headerText: string, bodyRows: string[], ctaUrl: string, ctaLabel: string, footerNote: string) {
  return `<!DOCTYPE html>
<html lang="${locale === "it" ? "it" : "en"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${STYLES.body}">
  <div style="${STYLES.wrapper}">
    <div style="${STYLES.card}">
      <div style="${STYLES.header}">
        <h1 style="${STYLES.headerTitle}">${escapeHtml(headerText)}</h1>
      </div>
      <div style="${STYLES.content}">
        ${bodyRows.join("\n        ")}
        <p style="margin:24px 0 0;">
          <a href="${ctaUrl}" style="${STYLES.ctaButton}">${escapeHtml(ctaLabel)}</a>
        </p>
      </div>
    </div>
    <div style="${STYLES.footer}">${escapeHtml(footerNote)}</div>
  </div>
</body>
</html>`;
}

export function renderQuoteCreatedEmail(params: CreatedParams): RenderedEmail {
  const locale = normalizeLocale(params.locale);
  const quoteTitle = params.quoteTitle || "Untitled quote";
  const customerDisplay = params.customerName || "—";
  const link = buildLink(params.appUrl, params.quoteId);

  const subject = t(locale, `New Quote: ${quoteTitle}`, `Nuovo Preventivo: ${quoteTitle}`);
  const headerText = t(locale, "New Quote Created", "Nuovo Preventivo Creato");
  const ctaLabel = t(locale, "View Quote", "Visualizza Preventivo");
  const footerNote = t(
    locale,
    "You received this email because you are associated with this quote.",
    "Hai ricevuto questa email perché sei associato a questo preventivo.",
  );

  const bodyRows = [
    `<p style="${STYLES.paragraph}">${t(locale, `${escapeHtml(customerDisplay)} created a new quote: ${escapeHtml(quoteTitle)}.`, `${escapeHtml(customerDisplay)} ha creato un nuovo preventivo: ${escapeHtml(quoteTitle)}.`)}</p>`,
    `<p style="${STYLES.detailRow}"><span style="${STYLES.detailLabel}">${t(locale, "Customer:", "Cliente:")}</span> ${escapeHtml(customerDisplay)}</p>`,
  ];

  return {
    subject,
    html: buildEmailHtml(locale, headerText, bodyRows, link, ctaLabel, footerNote),
  };
}

export function renderQuoteConvertedEmail(params: ConvertedParams): RenderedEmail {
  const locale = normalizeLocale(params.locale);
  const quoteTitle = params.quoteTitle || "Untitled quote";
  const customerDisplay = params.customerName || "—";
  const link = buildLink(params.appUrl, params.quoteId, params.recipientRole);

  const subject = t(locale, `Quote Converted: ${quoteTitle}`, `Preventivo Convertito: ${quoteTitle}`);
  const headerText = t(locale, "Quote Converted to Project", "Preventivo Convertito in Progetto");
  const ctaLabel = t(locale, "View Quote", "Visualizza Preventivo");
  const footerNote = t(
    locale,
    "You received this email because you are associated with this quote.",
    "Hai ricevuto questa email perché sei associato a questo preventivo.",
  );

  const roleIntro = params.recipientRole === "customer"
    ? t(locale, `Your quote '${escapeHtml(quoteTitle)}' has been converted to a project. Work can now begin!`, `Il tuo preventivo '${escapeHtml(quoteTitle)}' è stato convertito in un progetto. Il lavoro può ora iniziare!`)
    : params.recipientRole === "worker"
      ? t(locale, `A quote assigned to you has been converted to a project: ${escapeHtml(quoteTitle)}. You can now start logging hours.`, `Un preventivo assegnato a te è stato convertito in un progetto: ${escapeHtml(quoteTitle)}. Ora puoi iniziare a registrare le ore.`)
      : t(locale, `Quote '${escapeHtml(quoteTitle)}' has been converted to a project.`, `Il preventivo '${escapeHtml(quoteTitle)}' è stato convertito in un progetto.`);

  const bodyRows = [
    `<p style="${STYLES.paragraph}">${roleIntro}</p>`,
    `<p style="${STYLES.detailRow}"><span style="${STYLES.detailLabel}">${t(locale, "Customer:", "Cliente:")}</span> ${escapeHtml(customerDisplay)}</p>`,
  ];

  return {
    subject,
    html: buildEmailHtml(locale, headerText, bodyRows, link, ctaLabel, footerNote),
  };
}

export function renderQuoteRevertedEmail(params: RevertedParams): RenderedEmail {
  const locale = normalizeLocale(params.locale);
  const quoteTitle = params.quoteTitle || "Untitled quote";
  const customerDisplay = params.customerName || "—";
  const link = buildLink(params.appUrl, params.quoteId, params.recipientRole);

  const subject = t(locale, `Quote Reverted: ${quoteTitle}`, `Preventivo Ripristinato: ${quoteTitle}`);
  const headerText = t(locale, "Quote Reverted to Draft", "Preventivo Ripristinato a Bozza");
  const ctaLabel = t(locale, "View Quote", "Visualizza Preventivo");
  const footerNote = t(
    locale,
    "You received this email because you are associated with this quote.",
    "Hai ricevuto questa email perché sei associato a questo preventivo.",
  );

  const roleIntro = params.recipientRole === "customer"
    ? t(locale, `A quote associated with your account has been reverted to draft: ${escapeHtml(quoteTitle)}.`, `Un preventivo associato al tuo account è stato ripristinato a bozza: ${escapeHtml(quoteTitle)}.`)
    : params.recipientRole === "worker"
      ? t(locale, `A quote assigned to you has been reverted to draft: ${escapeHtml(quoteTitle)}. Logging hours is paused.`, `Un preventivo assegnato a te è stato ripristinato a bozza: ${escapeHtml(quoteTitle)}. La registrazione delle ore è in pausa.`)
      : t(locale, `Quote '${escapeHtml(quoteTitle)}' has been reverted to draft.`, `Il preventivo '${escapeHtml(quoteTitle)}' è stato ripristinato a bozza.`);

  const bodyRows = [
    `<p style="${STYLES.paragraph}">${roleIntro}</p>`,
    `<p style="${STYLES.detailRow}"><span style="${STYLES.detailLabel}">${t(locale, "Customer:", "Cliente:")}</span> ${escapeHtml(customerDisplay)}</p>`,
  ];

  return {
    subject,
    html: buildEmailHtml(locale, headerText, bodyRows, link, ctaLabel, footerNote),
  };
}
