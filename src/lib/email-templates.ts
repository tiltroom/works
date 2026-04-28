export type EmailEventType =
  | "quote_created"
  | "quote_converted"
  | "quote_reverted"
  | "quote_discussion_message"
  | "project_discussion_message";

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

interface QuoteDiscussionParams extends CreatedParams {
  authorName: string;
  messagePreview?: string | null;
  recipientRole?: RecipientRole;
}

interface ProjectDiscussionParams {
  locale: string;
  projectTitle: string;
  projectId: string;
  customerName: string;
  authorName: string;
  messagePreview?: string | null;
  appUrl: string;
  recipientRole?: RecipientRole;
}

const STYLES = {
  body: "margin:0;padding:0;background-color:#f4f5f9;color:#18181b;font-family:Geist,ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;",
  wrapper: "max-width:640px;margin:0 auto;padding:32px 20px;",
  card: "background:linear-gradient(145deg,rgba(255,255,255,0.96) 0%,rgba(244,245,249,0.88) 100%);border-radius:20px;border:1px solid rgba(24,24,27,0.08);overflow:hidden;box-shadow:0 18px 40px -24px rgba(15,23,42,0.28);",
  header: "background:radial-gradient(circle at 12% 16%,rgba(199,210,254,0.48) 0,rgba(199,210,254,0) 34%),linear-gradient(135deg,#312e81 0%,#4f46e5 52%,#6366f1 100%);color:#ffffff;padding:28px 32px 24px;",
  eyebrow: "margin:0 0 10px;font-size:12px;line-height:1.4;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#c7d2fe;",
  headerTitle: "margin:0;font-size:24px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:#ffffff;",
  headerSubtitle: "margin:10px 0 0;font-size:14px;line-height:1.6;color:#e0e7ff;",
  content: "padding:28px 32px 30px;",
  paragraph: "margin:0 0 18px;font-size:15px;line-height:1.7;color:#27272a;",
  detailCard: "margin:18px 0 0;border:1px solid rgba(212,212,216,0.7);border-radius:14px;background-color:rgba(244,245,249,0.6);overflow:hidden;",
  detailRow: "margin:0;padding:12px 14px;border-bottom:1px solid rgba(212,212,216,0.7);font-size:14px;line-height:1.5;color:#52525b;",
  detailRowLast: "margin:0;padding:12px 14px;font-size:14px;line-height:1.5;color:#52525b;",
  detailLabel: "display:block;margin-bottom:3px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#71717a;",
  detailValue: "font-size:14px;font-weight:600;color:#18181b;",
  statusRow: "margin:0 0 18px;",
  statusBadgeDraft: "display:inline-block;border:1px solid rgba(212,212,216,0.7);border-radius:999px;background-color:rgba(244,245,249,0.72);padding:6px 11px;font-size:12px;line-height:1;font-weight:700;color:#52525b;",
  notice: "margin:18px 0 0;border:1px solid rgba(79,70,229,0.2);border-radius:14px;background-color:rgba(99,102,241,0.08);padding:14px 16px;",
  noticeTitle: "margin:0 0 4px;font-size:13px;line-height:1.4;font-weight:700;color:#312e81;",
  noticeText: "margin:0;font-size:14px;line-height:1.6;color:#3730a3;",
  ctaButton: "display:inline-block;padding:12px 18px;background-color:#4f46e5;color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:700;box-shadow:0 18px 32px -22px rgba(79,70,229,0.62);",
  footer: "padding:18px 32px 0;font-size:12px;line-height:1.5;color:#71717a;text-align:center;",
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

function buildProjectLink(appUrl: string, projectId: string, role?: RecipientRole): string {
  const base = appUrl.replace(/\/+$/, "");
  const segment = role ?? "admin";
  return `${base}/${segment}/projects/${projectId}`;
}

function normalizePreview(value: string | null | undefined) {
  const preview = value?.replace(/\s+/g, " ").trim() ?? "";
  return preview.length > 240 ? `${preview.slice(0, 237)}...` : preview;
}

function buildEmailHtml(
  locale: Locale,
  headerText: string,
  bodyRows: string[],
  ctaUrl: string,
  ctaLabel: string,
  footerNote: string,
  options?: { eyebrow?: string; headerSubtitle?: string },
) {
  return `<!DOCTYPE html>
<html lang="${locale === "it" ? "it" : "en"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${STYLES.body}">
  <div style="${STYLES.wrapper}">
    <div style="${STYLES.card}">
      <div style="${STYLES.header}">
        ${options?.eyebrow ? `<p style="${STYLES.eyebrow}">${escapeHtml(options.eyebrow)}</p>` : ""}
        <h1 style="${STYLES.headerTitle}">${escapeHtml(headerText)}</h1>
        ${options?.headerSubtitle ? `<p style="${STYLES.headerSubtitle}">${escapeHtml(options.headerSubtitle)}</p>` : ""}
      </div>
      <div style="${STYLES.content}">
        ${bodyRows.join("\n        ")}
        <p style="margin:24px 0 0;">
          <a href="${escapeHtml(ctaUrl)}" style="${STYLES.ctaButton}">${escapeHtml(ctaLabel)}</a>
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

export function renderQuoteDiscussionMessageEmail(params: QuoteDiscussionParams): RenderedEmail {
  const locale = normalizeLocale(params.locale);
  const quoteTitle = params.quoteTitle || "Untitled quote";
  const customerDisplay = params.customerName || "—";
  const authorDisplay = params.authorName || "—";
  const messagePreview = normalizePreview(params.messagePreview);
  const link = buildLink(params.appUrl, params.quoteId, params.recipientRole);

  const subject = t(locale, `New discussion message: ${quoteTitle}`, `Nuovo messaggio nella discussione: ${quoteTitle}`);
  const headerText = t(locale, "New Quote Discussion Message", "Nuovo Messaggio nella Discussione del Preventivo");
  const ctaLabel = t(locale, "Open Discussion", "Apri Discussione");
  const footerNote = t(
    locale,
    "You received this email because you are associated with this quote discussion.",
    "Hai ricevuto questa email perché sei associato a questa discussione del preventivo.",
  );

  const bodyRows = [
    `<p style="${STYLES.paragraph}">${t(locale, `${escapeHtml(authorDisplay)} wrote a new message in the quote discussion for ${escapeHtml(quoteTitle)}.`, `${escapeHtml(authorDisplay)} ha scritto un nuovo messaggio nella discussione del preventivo ${escapeHtml(quoteTitle)}.`)}</p>`,
    `<div style="${STYLES.detailCard}">
          <p style="${STYLES.detailRow}"><span style="${STYLES.detailLabel}">${t(locale, "Quote", "Preventivo")}</span><span style="${STYLES.detailValue}">${escapeHtml(quoteTitle)}</span></p>
          <p style="${messagePreview ? STYLES.detailRow : STYLES.detailRowLast}"><span style="${STYLES.detailLabel}">${t(locale, "Customer", "Cliente")}</span><span style="${STYLES.detailValue}">${escapeHtml(customerDisplay)}</span></p>
          ${messagePreview ? `<p style="${STYLES.detailRowLast}"><span style="${STYLES.detailLabel}">${t(locale, "Message preview", "Anteprima messaggio")}</span><span style="${STYLES.detailValue}">${escapeHtml(messagePreview)}</span></p>` : ""}
        </div>`,
  ];

  return {
    subject,
    html: buildEmailHtml(locale, headerText, bodyRows, link, ctaLabel, footerNote, {
      eyebrow: "Hours Platform",
      headerSubtitle: t(locale, "A new message is waiting in the shared quote thread.", "Un nuovo messaggio ti aspetta nel thread condiviso del preventivo."),
    }),
  };
}

export function renderProjectDiscussionMessageEmail(params: ProjectDiscussionParams): RenderedEmail {
  const locale = normalizeLocale(params.locale);
  const projectTitle = params.projectTitle || "Untitled project";
  const customerDisplay = params.customerName || "—";
  const authorDisplay = params.authorName || "—";
  const messagePreview = normalizePreview(params.messagePreview);
  const link = buildProjectLink(params.appUrl, params.projectId, params.recipientRole);

  const subject = t(locale, `New project message: ${projectTitle}`, `Nuovo messaggio nel progetto: ${projectTitle}`);
  const headerText = t(locale, "New Project Discussion Message", "Nuovo Messaggio nella Discussione del Progetto");
  const ctaLabel = t(locale, "Open Project Discussion", "Apri Discussione Progetto");
  const footerNote = t(
    locale,
    "You received this email because you are associated with this project discussion.",
    "Hai ricevuto questa email perché sei associato a questa discussione del progetto.",
  );

  const bodyRows = [
    `<p style="${STYLES.paragraph}">${t(locale, `${escapeHtml(authorDisplay)} wrote a new message in the project discussion for ${escapeHtml(projectTitle)}.`, `${escapeHtml(authorDisplay)} ha scritto un nuovo messaggio nella discussione del progetto ${escapeHtml(projectTitle)}.`)}</p>`,
    `<div style="${STYLES.detailCard}">
          <p style="${STYLES.detailRow}"><span style="${STYLES.detailLabel}">${t(locale, "Project", "Progetto")}</span><span style="${STYLES.detailValue}">${escapeHtml(projectTitle)}</span></p>
          <p style="${messagePreview ? STYLES.detailRow : STYLES.detailRowLast}"><span style="${STYLES.detailLabel}">${t(locale, "Customer", "Cliente")}</span><span style="${STYLES.detailValue}">${escapeHtml(customerDisplay)}</span></p>
          ${messagePreview ? `<p style="${STYLES.detailRowLast}"><span style="${STYLES.detailLabel}">${t(locale, "Message preview", "Anteprima messaggio")}</span><span style="${STYLES.detailValue}">${escapeHtml(messagePreview)}</span></p>` : ""}
        </div>`,
  ];

  return {
    subject,
    html: buildEmailHtml(locale, headerText, bodyRows, link, ctaLabel, footerNote, {
      eyebrow: "Hours Platform",
      headerSubtitle: t(locale, "A new message is waiting in the shared project thread.", "Un nuovo messaggio ti aspetta nel thread condiviso del progetto."),
    }),
  };
}

export function renderQuoteRevertedEmail(params: RevertedParams): RenderedEmail {
  const locale = normalizeLocale(params.locale);
  const quoteTitle = params.quoteTitle || t(locale, "Untitled quote", "Preventivo senza titolo");
  const customerDisplay = params.customerName || "—";
  const link = buildLink(params.appUrl, params.quoteId, params.recipientRole);
  const escapedQuoteTitle = escapeHtml(quoteTitle);
  const escapedCustomerDisplay = escapeHtml(customerDisplay);

  const subject = t(locale, `Quote reverted to draft: ${quoteTitle}`, `Preventivo riportato in bozza: ${quoteTitle}`);
  const headerText = t(locale, "Quote reverted to draft", "Preventivo riportato in bozza");
  const ctaLabel = t(locale, "Open quote", "Apri preventivo");
  const footerNote = t(
    locale,
    "You received this email because you are associated with this quote.",
    "Hai ricevuto questa email perché sei associato a questo preventivo.",
  );

  const roleIntro = params.recipientRole === "customer"
    ? t(locale, `The quote associated with your account has been reverted to draft: <strong>${escapedQuoteTitle}</strong>.`, `Il preventivo associato al tuo account è stato riportato in bozza: <strong>${escapedQuoteTitle}</strong>.`)
    : params.recipientRole === "worker"
      ? t(locale, `The quote assigned to you has been reverted to draft: <strong>${escapedQuoteTitle}</strong>. Hour logging is temporarily suspended.`, `Il preventivo assegnato a te è stato riportato in bozza: <strong>${escapedQuoteTitle}</strong>. La registrazione delle ore è temporaneamente sospesa.`)
      : t(locale, `Quote <strong>${escapedQuoteTitle}</strong> has been reverted to draft.`, `Il preventivo <strong>${escapedQuoteTitle}</strong> è stato riportato in bozza.`);

  const nextStep = params.recipientRole === "customer"
    ? t(locale, "Review the draft from the platform and wait for it to be sent for signature again when updates are ready.", "Rivedi la bozza dalla piattaforma e attendi il nuovo invio in firma quando gli aggiornamenti saranno pronti.")
    : params.recipientRole === "worker"
      ? t(locale, "Wait for the quote to be updated or sent for signature again before resuming work.", "Attendi che il preventivo venga aggiornato o inviato di nuovo in firma prima di riprendere le attività.")
      : t(locale, "Review content, assignments, and logged hours, then send the quote for signature again when ready.", "Rivedi contenuto, assegnazioni e ore registrate, quindi invia nuovamente il preventivo in firma quando è pronto.");

  const bodyRows = [
    `<p style="${STYLES.paragraph}">${roleIntro}</p>`,
    `<p style="${STYLES.statusRow}"><span style="${STYLES.statusBadgeDraft}">${t(locale, "Current status · Draft", "Stato attuale · Bozza")}</span></p>`,
    `<div style="${STYLES.detailCard}">
          <p style="${STYLES.detailRow}"><span style="${STYLES.detailLabel}">${t(locale, "Quote", "Preventivo")}</span><span style="${STYLES.detailValue}">${escapedQuoteTitle}</span></p>
          <p style="${STYLES.detailRowLast}"><span style="${STYLES.detailLabel}">${t(locale, "Customer", "Cliente")}</span><span style="${STYLES.detailValue}">${escapedCustomerDisplay}</span></p>
        </div>`,
    `<div style="${STYLES.notice}">
          <p style="${STYLES.noticeTitle}">${t(locale, "Next step", "Prossimo passo")}</p>
          <p style="${STYLES.noticeText}">${nextStep}</p>
        </div>`,
  ];

  return {
    subject,
    html: buildEmailHtml(
      locale,
      headerText,
      bodyRows,
      link,
      ctaLabel,
      footerNote,
      {
        eyebrow: "Hours Platform",
        headerSubtitle: t(locale, "The quote is back in the editable stage with the same clean platform experience.", "Il preventivo è tornato alla fase modificabile con lo stesso stile pulito della piattaforma."),
      },
    ),
  };
}
