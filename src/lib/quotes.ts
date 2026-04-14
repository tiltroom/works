import type { JSONContent } from "@tiptap/core";
import type { Locale } from "@/lib/i18n";

export type QuoteStatus = "draft" | "signed" | "converted";

export type BillingMode = "prepaid" | "postpaid";

export interface QuoteRecord {
  id: string;
  title: string;
  description: string | null;
  contentHtml: string | null;
  contentJson: JSONContent | null;
  status: QuoteStatus;
  billingMode: BillingMode;
  customerId: string;
  customerName: string | null;
  totalEstimatedHours: number;
  totalLoggedHours: number;
  signedByName: string | null;
  signedAt: string | null;
  signedByUserId: string | null;
  linkedProjectId: string | null;
  linkedProjectName: string | null;
  projectId: string | null;
  projectName: string | null;
  convertedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  scopeOfWork: string | null;
  signatureName: string | null;
  adminNotes: string | null;
  confirmedAt: string | null;
  conversionRequestedAt: string | null;
  prepaymentRequestedAt: string | null;
}

export interface QuoteWorkerRecord {
  quoteId: string;
  workerId: string;
  workerName: string | null;
  assignedAt: string;
  assignedBy: string | null;
}

export interface QuoteSubtaskRecord {
  id: string;
  quoteId: string;
  title: string;
  description: string | null;
  estimatedHours: number;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteSubtaskEntryRecord {
  id: string;
  quoteSubtaskId: string;
  workerId: string | null;
  workerName: string | null;
  loggedHours: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteCommentRecord {
  id: string;
  quoteId: string;
  authorId: string | null;
  authorRole: "admin" | "customer" | "worker";
  authorName: string | null;
  commentHtml: string | null;
  commentJson: JSONContent | null;
  originalCommentHtml: string | null;
  originalCommentJson: JSONContent | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  workerId: string | null;
  workerName: string | null;
  body: string;
}

export interface ProjectDiscussionMessageRecord {
  id: string;
  projectId: string;
  authorId: string | null;
  authorRole: "admin" | "customer" | "worker";
  authorName: string | null;
  messageHtml: string | null;
  messageJson: JSONContent | null;
  originalMessageHtml: string | null;
  originalMessageJson: JSONContent | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  workerId: string | null;
  workerName: string | null;
  body: string;
}

export interface QuoteSubtaskEstimateRecord {
  id: string;
  quoteId: string;
  workerId: string | null;
  workerName: string | null;
  title: string;
  note: string | null;
  estimatedHours: number;
  createdAt: string;
}

export interface QuoteLoggedHourRecord {
  id: string;
  quoteId: string;
  workerId: string | null;
  workerName: string | null;
  title: string;
  note: string | null;
  hoursLogged: number;
  createdAt: string;
}

export interface QuotePrepaymentSessionRecord {
  id: string;
  quoteId: string;
  customerId: string;
  stripeCheckoutSessionId: string;
  estimatedHoursSnapshot: number;
  amountCents: number;
  currency: string;
  status: "pending" | "paid";
  stripeEventId: string | null;
  paidAt: string | null;
  createdAt: string;
}

type RawRecord = Record<string, unknown>;

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function asQuoteStatus(value: unknown): QuoteStatus {
  return value === "signed" || value === "converted" ? value : "draft";
}

function asRole(value: unknown): "admin" | "customer" | "worker" {
  return value === "admin" || value === "customer" ? value : "worker";
}

function asJsonContent(value: unknown): JSONContent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JSONContent;
}

export function sanitizeRichTextHtml(html: string | null | undefined) {
  if (!html) {
    return null;
  }

  const withoutScriptBlocks = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/<meta\b[^>]*>/gi, "");

  const withoutEventHandlers = withoutScriptBlocks
    .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, "");

  const withoutJavascriptUrls = withoutEventHandlers
    .replace(/\s+href\s*=\s*"\s*javascript:[^"]*"/gi, "")
    .replace(/\s+href\s*=\s*'\s*javascript:[^']*'/gi, "")
    .replace(/\s+src\s*=\s*"\s*javascript:[^"]*"/gi, "")
    .replace(/\s+src\s*=\s*'\s*javascript:[^']*'/gi, "")
    .replace(/\s+srcdoc\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+srcdoc\s*=\s*'[^']*'/gi, "");

  const sanitized = withoutJavascriptUrls.trim();
  return sanitized.length > 0 ? sanitized : null;
}

export function parseQuoteRecord(row: RawRecord): QuoteRecord {
  const linkedProjectId = asNullableString(row.linked_project_id);
  const linkedProjectName = asNullableString(row.linked_project_name);

  return {
    id: asString(row.id),
    title: asString(row.title, "Untitled quote"),
    description: asNullableString(row.description),
    contentHtml: asNullableString(row.content_html),
    contentJson: asJsonContent(row.content_json),
    status: asQuoteStatus(row.status),
    billingMode: row.billing_mode === "postpaid" ? "postpaid" : "prepaid",
    customerId: asString(row.customer_id),
    customerName: asNullableString(row.customer_name),
    totalEstimatedHours: asNumber(row.total_estimated_hours),
    totalLoggedHours: asNumber(row.total_logged_hours),
    signedByName: asNullableString(row.signed_by_name),
    signedAt: asNullableString(row.signed_at),
    signedByUserId: asNullableString(row.signed_by_user_id),
    linkedProjectId,
    linkedProjectName,
    projectId: linkedProjectId,
    projectName: linkedProjectName,
    convertedAt: asNullableString(row.converted_at),
    createdBy: asNullableString(row.created_by),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    scopeOfWork: asNullableString(row.content_html),
    signatureName: asNullableString(row.signed_by_name),
    adminNotes: asNullableString(row.admin_notes),
    confirmedAt: asNullableString(row.confirmed_at),
    conversionRequestedAt: asNullableString(row.conversion_requested_at),
    prepaymentRequestedAt: asNullableString(row.prepayment_requested_at),
  };
}

export function parseQuoteWorkerRecord(row: RawRecord): QuoteWorkerRecord {
  return {
    quoteId: asString(row.quote_id),
    workerId: asString(row.worker_id),
    workerName: asNullableString(row.worker_name),
    assignedAt: asString(row.assigned_at),
    assignedBy: asNullableString(row.assigned_by),
  };
}

export function parseQuoteSubtaskRecord(row: RawRecord): QuoteSubtaskRecord {
  return {
    id: asString(row.id),
    quoteId: asString(row.quote_id),
    title: asString(row.title),
    description: asNullableString(row.description),
    estimatedHours: asNumber(row.estimated_hours),
    sortOrder: asNumber(row.sort_order),
    createdBy: asNullableString(row.created_by),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

export function parseQuoteSubtaskEntryRecord(row: RawRecord): QuoteSubtaskEntryRecord {
  return {
    id: asString(row.id),
    quoteSubtaskId: asString(row.quote_subtask_id),
    workerId: asNullableString(row.worker_id),
    workerName: asNullableString(row.worker_name),
    loggedHours: asNumber(row.logged_hours),
    note: asNullableString(row.note),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at, asString(row.created_at)),
  };
}

export function parseQuoteCommentRecord(row: RawRecord): QuoteCommentRecord {
  const authorRole = asRole(row.author_role);
  const authorId = asNullableString(row.author_id);
  const commentHtml = asNullableString(row.comment_html);

  return {
    id: asString(row.id),
    quoteId: asString(row.quote_id),
    authorId,
    authorRole,
    authorName: asNullableString(row.author_name),
    commentHtml,
    commentJson: asJsonContent(row.comment_json),
    originalCommentHtml: asNullableString(row.original_comment_html),
    originalCommentJson: asJsonContent(row.original_comment_json),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at, asString(row.created_at)),
    editedAt: asNullableString(row.edited_at),
    workerId: authorRole === "worker" ? authorId : null,
    workerName: authorRole === "worker" ? asNullableString(row.author_name) : null,
    body: commentHtml ?? "",
  };
}

export function parseProjectDiscussionMessageRecord(row: RawRecord): ProjectDiscussionMessageRecord {
  const authorRole = asRole(row.author_role);
  const authorId = asNullableString(row.author_id);
  const messageHtml = asNullableString(row.message_html);

  return {
    id: asString(row.id),
    projectId: asString(row.project_id),
    authorId,
    authorRole,
    authorName: asNullableString(row.author_name),
    messageHtml,
    messageJson: asJsonContent(row.message_json),
    originalMessageHtml: asNullableString(row.original_message_html),
    originalMessageJson: asJsonContent(row.original_message_json),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at, asString(row.created_at)),
    editedAt: asNullableString(row.edited_at),
    workerId: authorRole === "worker" ? authorId : null,
    workerName: authorRole === "worker" ? asNullableString(row.author_name) : null,
    body: messageHtml ?? "",
  };
}

export function parseQuoteSubtaskEstimateRecord(row: RawRecord): QuoteSubtaskEstimateRecord {
  return {
    id: asString(row.id),
    quoteId: asString(row.quote_id),
    workerId: asNullableString(row.created_by),
    workerName: asNullableString(row.worker_name),
    title: asString(row.title),
    note: asNullableString(row.description),
    estimatedHours: asNumber(row.estimated_hours),
    createdAt: asString(row.created_at),
  };
}

export function parseQuoteLoggedHourRecord(row: RawRecord): QuoteLoggedHourRecord {
  return {
    id: asString(row.id),
    quoteId: asString(row.quote_id),
    workerId: asNullableString(row.worker_id),
    workerName: asNullableString(row.worker_name),
    title: asString(row.title, "Logged entry"),
    note: asNullableString(row.note),
    hoursLogged: asNumber(row.logged_hours),
    createdAt: asString(row.created_at),
  };
}

export function parseQuotePrepaymentSessionRecord(row: RawRecord): QuotePrepaymentSessionRecord {
  return {
    id: asString(row.id),
    quoteId: asString(row.quote_id),
    customerId: asString(row.customer_id),
    stripeCheckoutSessionId: asString(row.stripe_checkout_session_id),
    estimatedHoursSnapshot: asNumber(row.estimated_hours_snapshot),
    amountCents: asNumber(row.amount_cents),
    currency: asString(row.currency),
    status: row.status === "paid" ? "paid" : "pending",
    stripeEventId: asNullableString(row.stripe_event_id),
    paidAt: asNullableString(row.paid_at),
    createdAt: asString(row.created_at),
  };
}

export function isQuotesBackendMissingError(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) {
    return false;
  }

  const message = `${error.message ?? ""}`.toLowerCase();
  return (
    error.code === "42P01"
    || error.code === "PGRST205"
    || error.code === "PGRST204"
    || error.code === "42703"
    || message.includes("quotes")
    || message.includes("quote_workers")
    || message.includes("quote_subtasks")
    || message.includes("quote_subtask_entries")
    || message.includes("quote_comments")
    || message.includes("quote_prepayment_sessions")
    || message.includes("relation")
    || message.includes("column")
  );
}

export function formatQuoteStatus(locale: Locale, status: QuoteStatus) {
  switch (status) {
    case "draft":
      return locale === "it" ? "Bozza" : "Draft";
    case "signed":
      return locale === "it" ? "Firmato" : "Signed";
    case "converted":
      return locale === "it" ? "Convertito" : "Converted";
    default:
      return locale === "it" ? "Bozza" : "Draft";
  }
}

export function formatQuoteHours(hours: number | null | undefined) {
  if (hours == null || Number.isNaN(hours)) {
    return "—";
  }

  return `${Number(hours).toFixed(2)}h`;
}

export function formatCurrencyAmount(amountCents: number | null | undefined, currency: string | null | undefined) {
  if (amountCents == null || !currency) {
    return "—";
  }

  return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

export function getQuoteStatusTone(status: QuoteStatus): "neutral" | "info" | "success" | "warning" | "danger" {
  switch (status) {
    case "draft":
      return "warning";
    case "signed":
      return "info";
    case "converted":
      return "success";
    default:
      return "neutral";
  }
}

export function sumEstimatedHours(entries: QuoteSubtaskEstimateRecord[]) {
  return entries.reduce((total, entry) => total + entry.estimatedHours, 0);
}

export function sumLoggedHours(entries: QuoteLoggedHourRecord[]) {
  return entries.reduce((total, entry) => total + entry.hoursLogged, 0);
}
