"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { env } from "@/lib/env";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { withQueryToast } from "@/lib/query-toast";
import {
  isQuotesBackendMissingError,
  parseQuoteCommentRecord,
  parseQuotePrepaymentSessionRecord,
  parseQuoteRecord,
  parseQuoteSubtaskEntryRecord,
  parseQuoteSubtaskRecord,
  parseQuoteSubtaskEstimateRecord,
  parseQuoteWorkerRecord,
  sanitizeRichTextHtml,
  type QuoteCommentRecord,
  type QuotePrepaymentSessionRecord,
  type QuoteRecord,
  type QuoteSubtaskEntryRecord,
  type QuoteSubtaskEstimateRecord,
  type QuoteSubtaskRecord,
  type QuoteWorkerRecord,
} from "@/lib/quotes";
import { getStripeClient } from "@/lib/stripe";
import { notifyQuoteCreated, notifyQuoteConverted, notifyQuoteReverted } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types";

interface QuotesPageData {
  backendAvailable: boolean;
  quotes: QuoteRecord[];
  workers: QuoteWorkerRecord[];
  subtasks: QuoteSubtaskRecord[];
  subtaskEstimates: QuoteSubtaskEstimateRecord[];
  subtaskEntries: QuoteSubtaskEntryRecord[];
  comments: QuoteCommentRecord[];
  prepaymentSessions: QuotePrepaymentSessionRecord[];
}

type RawRow = Record<string, unknown>;

interface DiscussionPayload {
  html: string | null;
  json: Record<string, unknown> | null;
}

function revalidateQuotesModule(quoteId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/quotes");
  if (quoteId) {
    revalidatePath(`/admin/quotes/${quoteId}`);
    revalidatePath(`/customer/quotes/${quoteId}`);
    revalidatePath(`/worker/quotes/${quoteId}`);
  }
  revalidatePath("/customer");
  revalidatePath("/customer/quotes");
  revalidatePath("/worker");
  revalidatePath("/worker/quotes");
}

function trimString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseDiscussionPayload(
  formData: FormData,
  options: {
    htmlKeys: string[];
    jsonKeys: string[];
  },
): DiscussionPayload {
  const rawHtml = options.htmlKeys
    .map((key) => String(formData.get(key) ?? "").trim())
    .find((value) => value.length > 0) ?? null;
  const jsonValue = options.jsonKeys
    .map((key) => parseJsonContent(String(formData.get(key) ?? "")))
    .find((value) => value !== null) ?? null;

  return { html: sanitizeRichTextHtml(rawHtml), json: jsonValue };
}

function assertDiscussionPayload(payload: DiscussionPayload, locale: "en" | "it", fieldLabel: { en: string; it: string }) {
  if (!payload.html && !payload.json) {
    throw new Error(t(locale, `${fieldLabel.en} content is required`, `Il contenuto ${fieldLabel.it} è obbligatorio`));
  }
}

function normalizeQuoteCommentAuthorName(comment: QuoteCommentRecord, profileNameById: Map<string, string | null>) {
  return comment.authorName ?? (comment.authorId ? profileNameById.get(comment.authorId) ?? null : null);
}

async function getQuoteCommentForMutation(quoteId: string, commentId: string) {
  const locale = await getLocale();
  const supabase = await assertQuotesBackend();
  const { data, error } = await supabase
    .from("quote_comments")
    .select("*")
    .eq("id", commentId)
    .eq("quote_id", quoteId)
    .maybeSingle<RawRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(t(locale, "Comment not found", "Commento non trovato"));
  }

  return parseQuoteCommentRecord(data);
}

async function loadQuoteDiscussionCommentsForQuote(quoteId: string) {
  const supabase = await assertQuotesBackend();
  const commentsResult = await supabase
    .from("quote_comments")
    .select("*")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: false });

  if (commentsResult.error) {
    if (isQuotesBackendMissingError(commentsResult.error)) {
      return [];
    }

    throw new Error(commentsResult.error.message);
  }

  const comments = (commentsResult.data ?? []).map((row) => parseQuoteCommentRecord(row as RawRow));
  const profileIds = [...new Set(comments.map((comment) => comment.authorId).filter((value): value is string => Boolean(value)))];
  const profilesResult = profileIds.length > 0
    ? await supabase.from("profiles").select("id,full_name").in("id", profileIds)
    : { data: [], error: null };

  if (profilesResult.error) {
    throw new Error(profilesResult.error.message);
  }

  const profileNameById = new Map((profilesResult.data ?? []).map((profile) => [String(profile.id), profile.full_name?.trim() || null]));

  return comments.map((comment) => ({
    ...comment,
    authorName: normalizeQuoteCommentAuthorName(comment, profileNameById),
    workerName: comment.authorRole === "worker" && comment.authorId ? profileNameById.get(comment.authorId) ?? null : comment.workerName,
  }));
}

function parseJsonContent(value: string) {
  if (!value.trim()) {
    return null;
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function quotesUnavailableMessage(locale: "en" | "it") {
  return t(
    locale,
    "The preventivi backend is not configured yet. Add the preventivi tables and policies to enable saving quote data.",
    "Il backend dei preventivi non è ancora configurato. Aggiungi tabelle e policy dei preventivi per abilitare il salvataggio dei dati.",
  );
}

async function assertQuotesBackend() {
  const locale = await getLocale();
  const supabase = await createClient();
  const result = await supabase.from("quotes").select("id", { head: true, count: "exact" });

  if (result.error) {
    if (isQuotesBackendMissingError(result.error)) {
      throw new Error(quotesUnavailableMessage(locale));
    }

    throw new Error(result.error.message);
  }

  return supabase;
}

async function getQuoteForCustomer(quoteId: string, customerId: string) {
  const locale = await getLocale();
  const supabase = await assertQuotesBackend();
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .eq("customer_id", customerId)
    .maybeSingle<RawRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(t(locale, "Quote not found", "Preventivo non trovato"));
  }

  return parseQuoteRecord(data);
}

async function getQuoteForAdmin(quoteId: string) {
  const locale = await getLocale();
  const supabase = await assertQuotesBackend();
  const { data, error } = await supabase.from("quotes").select("*").eq("id", quoteId).maybeSingle<RawRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(t(locale, "Quote not found", "Preventivo non trovato"));
  }

  return parseQuoteRecord(data);
}

async function assertWorkerAccessToQuote(quoteId: string, workerId: string) {
  const locale = await getLocale();
  const supabase = await assertQuotesBackend();
  const [quoteResult, assignmentResult] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", quoteId).maybeSingle<RawRow>(),
    supabase.from("quote_workers").select("quote_id").eq("quote_id", quoteId).eq("worker_id", workerId).maybeSingle(),
  ]);

  if (quoteResult.error) {
    throw new Error(quoteResult.error.message);
  }

  if (!quoteResult.data) {
    throw new Error(t(locale, "Quote not found", "Preventivo non trovato"));
  }

  if (assignmentResult.error) {
    throw new Error(assignmentResult.error.message);
  }

  if (!assignmentResult.data) {
    throw new Error(t(locale, "Not authorized for this quote", "Non autorizzato per questo preventivo"));
  }

  return { supabase, quote: parseQuoteRecord(quoteResult.data) };
}

async function getQuoteSubtaskForQuote(quoteId: string, quoteSubtaskId: string) {
  const locale = await getLocale();
  const supabase = await assertQuotesBackend();
  const { data, error } = await supabase
    .from("quote_subtasks")
    .select("id,quote_id")
    .eq("id", quoteSubtaskId)
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(t(locale, "Subtask not found", "Sottoattività non trovata"));
  }

  return data;
}

async function getQuoteSubtaskForAdmin(quoteId: string, subtaskId: string) {
  const locale = await getLocale();
  const supabase = await assertQuotesBackend();
  const { data, error } = await supabase
    .from("quote_subtasks")
    .select("id,quote_id")
    .eq("id", subtaskId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || String(data.quote_id) !== quoteId) {
    throw new Error(t(locale, "Subtask not found", "Sottoattività non trovata"));
  }

  return data;
}

async function getQuoteSubtaskEntryForAdmin(quoteId: string, entryId: string) {
  const locale = await getLocale();
  const supabase = await assertQuotesBackend();
  const { data, error } = await supabase
    .from("quote_subtask_entries")
    .select("id,quote_subtask_id")
    .eq("id", entryId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(t(locale, "Logged entry not found", "Voce registrata non trovata"));
  }

  await getQuoteSubtaskForQuote(quoteId, String(data.quote_subtask_id));

  return data;
}

export async function loadQuotesPageData(role: AppRole, profileId: string): Promise<QuotesPageData> {
  const supabase = await createClient();
  const quotesResult = await supabase.from("quotes").select("*").order("updated_at", { ascending: false });

  if (quotesResult.error) {
    if (isQuotesBackendMissingError(quotesResult.error)) {
      return {
        backendAvailable: false,
        quotes: [],
        workers: [],
        subtasks: [],
        subtaskEstimates: [],
        subtaskEntries: [],
        comments: [],
        prepaymentSessions: [],
      };
    }

    throw new Error(quotesResult.error.message);
  }

  let quotes = (quotesResult.data ?? []).map((row) => parseQuoteRecord(row as RawRow));

  if (role === "customer") {
    quotes = quotes.filter((quote) => quote.customerId === profileId);
  }

  if (role === "worker") {
    const { data: assignments, error: assignmentsError } = await supabase
      .from("quote_workers")
      .select("quote_id")
      .eq("worker_id", profileId);

    if (assignmentsError) {
      throw new Error(assignmentsError.message);
    }

    const assignedIds = new Set((assignments ?? []).map((entry) => String(entry.quote_id)));
    quotes = quotes.filter((quote) => assignedIds.has(quote.id));
  }

  const quoteIds = quotes.map((quote) => quote.id);
  if (quoteIds.length === 0) {
    return {
      backendAvailable: true,
      quotes,
      workers: [],
      subtasks: [],
      subtaskEstimates: [],
      subtaskEntries: [],
      comments: [],
      prepaymentSessions: [],
    };
  }

  const [workersResult, subtasksResult, entriesResult, commentsResult, prepaymentResult] = await Promise.all([
    supabase.from("quote_workers").select("*").in("quote_id", quoteIds).order("assigned_at", { ascending: true }),
    supabase.from("quote_subtasks").select("*").in("quote_id", quoteIds).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("quote_subtask_entries").select("*").order("created_at", { ascending: false }),
    supabase.from("quote_comments").select("*").in("quote_id", quoteIds).order("created_at", { ascending: false }),
    supabase.from("quote_prepayment_sessions").select("*").in("quote_id", quoteIds).order("created_at", { ascending: false }),
  ]);

  for (const result of [workersResult, subtasksResult, entriesResult, commentsResult, prepaymentResult]) {
    if (result.error) {
      if (isQuotesBackendMissingError(result.error)) {
        return {
          backendAvailable: false,
          quotes: [],
          workers: [],
          subtasks: [],
          subtaskEstimates: [],
          subtaskEntries: [],
          comments: [],
          prepaymentSessions: [],
        };
      }

      throw new Error(result.error.message);
    }
  }

  const workers = (workersResult.data ?? []).map((row) => parseQuoteWorkerRecord(row as RawRow));
  const subtasks = (subtasksResult.data ?? []).map((row) => parseQuoteSubtaskRecord(row as RawRow));
  const subtaskEstimates = (subtasksResult.data ?? []).map((row) => parseQuoteSubtaskEstimateRecord(row as RawRow));
  const subtaskIds = new Set(subtasks.map((subtask) => subtask.id));
  const subtaskEntries = (entriesResult.data ?? [])
    .map((row) => parseQuoteSubtaskEntryRecord(row as RawRow))
    .filter((entry) => subtaskIds.has(entry.quoteSubtaskId));
  const comments = (commentsResult.data ?? []).map((row) => parseQuoteCommentRecord(row as RawRow));
  const prepaymentSessions = (prepaymentResult.data ?? []).map((row) => parseQuotePrepaymentSessionRecord(row as RawRow));

  const profileIds = new Set<string>();
  const projectIds = new Set<string>();

  for (const quote of quotes) {
    profileIds.add(quote.customerId);
    if (quote.signedByUserId) {
      profileIds.add(quote.signedByUserId);
    }
    if (quote.customerSignedByUserId) {
      profileIds.add(quote.customerSignedByUserId);
    }
    if (quote.createdBy) {
      profileIds.add(quote.createdBy);
    }
    if (quote.linkedProjectId) {
      projectIds.add(quote.linkedProjectId);
    }
  }

  for (const assignment of workers) {
    profileIds.add(assignment.workerId);
  }

  for (const subtask of subtasks) {
    if (subtask.createdBy) {
      profileIds.add(subtask.createdBy);
    }
  }

  for (const entry of subtaskEntries) {
    if (entry.workerId) {
      profileIds.add(entry.workerId);
    }
  }

  for (const comment of comments) {
    if (comment.authorId) {
      profileIds.add(comment.authorId);
    }
  }

  const [profilesResult, projectsResult] = await Promise.all([
    profileIds.size > 0
      ? supabase.from("profiles").select("id,full_name").in("id", [...profileIds])
      : Promise.resolve({ data: [], error: null }),
    projectIds.size > 0
      ? supabase.from("projects").select("id,name").in("id", [...projectIds])
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) {
    throw new Error(profilesResult.error.message);
  }

  if (projectsResult.error) {
    throw new Error(projectsResult.error.message);
  }

  const profileNameById = new Map((profilesResult.data ?? []).map((profile) => [String(profile.id), profile.full_name?.trim() || null]));
  const projectNameById = new Map((projectsResult.data ?? []).map((project) => [String(project.id), project.name]));

  const normalizedQuotes = quotes.map((quote) => ({
    ...quote,
    customerName: quote.customerName ?? profileNameById.get(quote.customerId) ?? null,
    signedByName: quote.signedByUserId ? profileNameById.get(quote.signedByUserId) ?? quote.signedByName : quote.signedByName,
    customerSignedByName: quote.customerSignedByUserId ? profileNameById.get(quote.customerSignedByUserId) ?? quote.customerSignedByName : quote.customerSignedByName,
    linkedProjectName: quote.linkedProjectId ? projectNameById.get(quote.linkedProjectId) ?? null : null,
    projectName: quote.linkedProjectId ? projectNameById.get(quote.linkedProjectId) ?? null : null,
  }));

  const normalizedWorkers = workers.map((assignment) => ({
    ...assignment,
    workerName: assignment.workerName ?? profileNameById.get(assignment.workerId) ?? null,
  }));

  const normalizedEntries = subtaskEntries.map((entry) => ({
    ...entry,
    workerName: entry.workerName ?? (entry.workerId ? profileNameById.get(entry.workerId) ?? null : null),
  }));

  const normalizedComments = comments.map((comment) => ({
    ...comment,
    authorName: normalizeQuoteCommentAuthorName(comment, profileNameById),
    workerName: comment.authorRole === "worker" && comment.authorId ? profileNameById.get(comment.authorId) ?? null : comment.workerName,
  }));

  const normalizedEstimates = subtaskEstimates.map((subtask) => ({
    ...subtask,
    workerName: subtask.workerId ? profileNameById.get(subtask.workerId) ?? null : null,
  }));

  return {
    backendAvailable: true,
    quotes: normalizedQuotes,
    workers: normalizedWorkers,
    subtasks,
    subtaskEstimates: normalizedEstimates,
    subtaskEntries: normalizedEntries,
    comments: normalizedComments,
    prepaymentSessions,
  };
}

export async function createQuoteDraftAction(formData: FormData) {
  const locale = await getLocale();
  const profile = await requireRole(["customer"]);
  const title = trimString(formData, "title");
  const description = trimString(formData, "description");
  const contentHtml = String(formData.get("contentHtml") ?? formData.get("scopeOfWork") ?? "").trim();
  const contentJson = parseJsonContent(String(formData.get("contentJson") ?? ""));

  if (!title) {
    throw new Error(t(locale, "A quote title is required", "Il titolo del preventivo è obbligatorio"));
  }

  const supabase = await assertQuotesBackend();
  const { data, error } = await supabase
    .from("quotes")
    .insert({
      customer_id: profile.id,
      title,
      description: description || null,
      content_html: contentHtml || null,
      content_json: contentJson,
      status: "draft",
      billing_mode: "prepaid",
      created_by: profile.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    throw new Error(error.message);
  }

  const quoteId = data?.id?.trim();

  if (!quoteId) {
    throw new Error(t(locale, "Quote created but missing identifier", "Preventivo creato ma identificatore mancante"));
  }

  revalidateQuotesModule(quoteId);

  after(async () => {
    await notifyQuoteCreated(quoteId, profile.id);
  });

  redirect(
    withQueryToast(
      `/customer/quotes/${quoteId}`,
      "success",
      t(locale, "Draft created successfully", "Bozza creata con successo"),
    ),
  );
}

export async function updateQuoteDraftAction(formData: FormData) {
  const locale = await getLocale();
  const profile = await requireRole(["customer"]);
  const quoteId = trimString(formData, "quoteId");
  const title = trimString(formData, "title");
  const description = trimString(formData, "description");
  const contentHtml = String(formData.get("contentHtml") ?? formData.get("scopeOfWork") ?? "").trim();
  const contentJson = parseJsonContent(String(formData.get("contentJson") ?? ""));

  if (!quoteId || !title) {
    throw new Error(t(locale, "Invalid quote payload", "Payload preventivo non valido"));
  }

  const existing = await getQuoteForCustomer(quoteId, profile.id);
  if (existing.status !== "draft") {
    throw new Error(t(locale, "Only draft quotes can be edited", "Solo i preventivi in bozza possono essere modificati"));
  }

  const supabase = await assertQuotesBackend();
  const { error } = await supabase
    .from("quotes")
    .update({
      title,
      description: description || null,
      content_html: contentHtml || null,
      content_json: contentJson,
    })
    .eq("id", quoteId)
    .eq("customer_id", profile.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidateQuotesModule(quoteId);
}

export async function deleteQuoteDraftAction(formData: FormData) {
  const locale = await getLocale();
  const profile = await requireRole(["customer"]);
  const quoteId = trimString(formData, "quoteId");

  if (!quoteId) {
    throw new Error(t(locale, "Invalid quote payload", "Payload preventivo non valido"));
  }

  const existing = await getQuoteForCustomer(quoteId, profile.id);
  if (existing.status !== "draft") {
    throw new Error(t(locale, "Only draft quotes can be deleted", "Solo i preventivi in bozza possono essere eliminati"));
  }

  const supabase = await assertQuotesBackend();
  const { error } = await supabase
    .from("quotes")
    .delete()
    .eq("id", quoteId)
    .eq("customer_id", profile.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidateQuotesModule(quoteId);
}

export async function assignQuoteWorkersAction(formData: FormData) {
  const locale = await getLocale();
  const admin = await requireRole(["admin"]);
  const quoteId = trimString(formData, "quoteId");
  const workerIds = formData
    .getAll("workerIds")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (!quoteId) {
    throw new Error(t(locale, "Quote id is required", "L'ID del preventivo è obbligatorio"));
  }

  const existing = await getQuoteForAdmin(quoteId);
  if (existing.status !== "draft") {
    throw new Error(t(locale, "Workers can only be assigned while the quote is in draft", "Gli operatori possono essere assegnati solo mentre il preventivo è in bozza"));
  }

  const supabase = await assertQuotesBackend();
  const { error: deleteError } = await supabase.from("quote_workers").delete().eq("quote_id", quoteId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (workerIds.length > 0) {
    const uniqueWorkerIds = [...new Set(workerIds)];
    const { error: insertError } = await supabase.from("quote_workers").insert(
      uniqueWorkerIds.map((workerId) => ({
        quote_id: quoteId,
        worker_id: workerId,
        assigned_by: admin.id,
      })),
    );

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  revalidateQuotesModule(quoteId);
}

export async function addQuoteCommentAction(formData: FormData) {
  const locale = await getLocale();
  const profile = await requireRole(["customer", "worker", "admin"]);
  const quoteId = trimString(formData, "quoteId");
  const payload = parseDiscussionPayload(formData, {
    htmlKeys: ["commentHtml", "comment"],
    jsonKeys: ["commentJson"],
  });

  if (!quoteId) {
    throw new Error(t(locale, "Comment content is required", "Il contenuto del commento è obbligatorio"));
  }

  assertDiscussionPayload(payload, locale, { en: "Comment", it: "del commento" });

  if (profile.role === "customer") {
    await getQuoteForCustomer(quoteId, profile.id);
  } else if (profile.role === "worker") {
    await assertWorkerAccessToQuote(quoteId, profile.id);
  } else {
    await getQuoteForAdmin(quoteId);
  }

  const supabase = await assertQuotesBackend();
  const { error } = await supabase.from("quote_comments").insert({
    quote_id: quoteId,
    author_id: profile.id,
    author_role: profile.role,
    comment_html: payload.html,
    comment_json: payload.json,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidateQuotesModule(quoteId);
}

export async function addQuoteWorkerCommentAction(formData: FormData) {
  return addQuoteCommentAction(formData);
}

export async function loadQuoteDiscussionAction(formData: FormData): Promise<QuoteCommentRecord[]> {
  const profile = await requireRole(["customer", "worker", "admin"]);
  const quoteId = trimString(formData, "quoteId");
  const locale = await getLocale();

  if (!quoteId) {
    throw new Error(t(locale, "Quote not found", "Preventivo non trovato"));
  }

  if (profile.role === "customer") {
    await getQuoteForCustomer(quoteId, profile.id);
  } else if (profile.role === "worker") {
    await assertWorkerAccessToQuote(quoteId, profile.id);
  } else {
    await getQuoteForAdmin(quoteId);
  }

  return loadQuoteDiscussionCommentsForQuote(quoteId);
}

export async function updateQuoteCommentAction(formData: FormData) {
  const locale = await getLocale();
  const profile = await requireRole(["customer", "worker", "admin"]);
  const quoteId = trimString(formData, "quoteId");
  const commentId = trimString(formData, "commentId");
  const payload = parseDiscussionPayload(formData, {
    htmlKeys: ["commentHtml", "comment"],
    jsonKeys: ["commentJson"],
  });

  if (!quoteId || !commentId) {
    throw new Error(t(locale, "Invalid comment payload", "Payload commento non valido"));
  }

  assertDiscussionPayload(payload, locale, { en: "Comment", it: "del commento" });

  if (profile.role === "customer") {
    await getQuoteForCustomer(quoteId, profile.id);
  } else if (profile.role === "worker") {
    await assertWorkerAccessToQuote(quoteId, profile.id);
  } else {
    await getQuoteForAdmin(quoteId);
  }

  const existingComment = await getQuoteCommentForMutation(quoteId, commentId);
  if (profile.role !== "admin" && existingComment.authorId !== profile.id) {
    throw new Error(t(locale, "You can only edit your own comments", "Puoi modificare solo i tuoi commenti"));
  }

  const supabase = await assertQuotesBackend();
  const { error } = await supabase
    .from("quote_comments")
    .update({
      comment_html: payload.html,
      comment_json: payload.json,
    })
    .eq("id", commentId)
    .eq("quote_id", quoteId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateQuotesModule(quoteId);
}

export async function addQuoteSubtaskAction(formData: FormData) {
  const locale = await getLocale();
  const profile = await requireRole(["worker", "admin"]);
  const quoteId = trimString(formData, "quoteId");
  const title = trimString(formData, "title");
  const description = trimString(formData, "description") || trimString(formData, "note");
  const estimatedHours = parseNumber(trimString(formData, "estimatedHours"));

  if (!quoteId || !title || Number.isNaN(estimatedHours) || estimatedHours < 0) {
    throw new Error(t(locale, "Subtask title and estimated hours are required", "Titolo della sottoattività e ore stimate sono obbligatori"));
  }

  if (profile.role === "worker") {
    const access = await assertWorkerAccessToQuote(quoteId, profile.id);
    if (access.quote.status !== "draft") {
      throw new Error(t(locale, "Subtasks can only be added while the quote is in draft", "Le sottoattività possono essere aggiunte solo mentre il preventivo è in bozza"));
    }
  } else {
    const existing = await getQuoteForAdmin(quoteId);
    if (existing.status !== "draft") {
      throw new Error(t(locale, "Subtasks can only be added while the quote is in draft", "Le sottoattività possono essere aggiunte solo mentre il preventivo è in bozza"));
    }
  }

  const supabase = await assertQuotesBackend();
  const latestSubtask = await supabase
    .from("quote_subtasks")
    .select("sort_order")
    .eq("quote_id", quoteId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestSubtask.error) {
    throw new Error(latestSubtask.error.message);
  }

  const nextSortOrder = Number(latestSubtask.data?.sort_order ?? -1) + 1;
  const { error } = await supabase.from("quote_subtasks").insert({
    quote_id: quoteId,
    title,
    description: description || null,
    estimated_hours: estimatedHours,
    sort_order: nextSortOrder,
    created_by: profile.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidateQuotesModule(quoteId);
}

export async function addQuoteSubtaskEstimateAction(formData: FormData) {
  return addQuoteSubtaskAction(formData);
}

export async function updateQuoteSubtaskAction(formData: FormData) {
  const locale = await getLocale();
  await requireRole(["admin"]);
  const quoteId = trimString(formData, "quoteId");
  const subtaskId = trimString(formData, "subtaskId");
  const title = trimString(formData, "title");
  const description = trimString(formData, "description") || trimString(formData, "note");
  const estimatedHours = parseNumber(trimString(formData, "estimatedHours"));

  if (!quoteId || !subtaskId || !title || Number.isNaN(estimatedHours) || estimatedHours < 0) {
    throw new Error(t(locale, "Subtask title and estimated hours are required", "Titolo della sottoattività e ore stimate sono obbligatori"));
  }

  const existing = await getQuoteForAdmin(quoteId);
  if (existing.status !== "draft") {
    throw new Error(t(locale, "Subtasks can only be edited while the quote is in draft", "Le sottoattività possono essere modificate solo mentre il preventivo è in bozza"));
  }

  await getQuoteSubtaskForAdmin(quoteId, subtaskId);

  const supabase = await assertQuotesBackend();
  const { error } = await supabase
    .from("quote_subtasks")
    .update({
      title,
      description: description || null,
      estimated_hours: estimatedHours,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subtaskId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateQuotesModule(quoteId);
}

export async function deleteQuoteSubtaskAction(formData: FormData) {
  const locale = await getLocale();
  await requireRole(["admin"]);
  const quoteId = trimString(formData, "quoteId");
  const subtaskId = trimString(formData, "subtaskId");

  if (!quoteId || !subtaskId) {
    throw new Error(t(locale, "Invalid subtask payload", "Payload sottoattività non valido"));
  }

  const existing = await getQuoteForAdmin(quoteId);
  if (existing.status !== "draft") {
    throw new Error(t(locale, "Subtasks can only be deleted while the quote is in draft", "Le sottoattività possono essere eliminate solo mentre il preventivo è in bozza"));
  }

  await getQuoteSubtaskForAdmin(quoteId, subtaskId);

  const supabase = await assertQuotesBackend();
  const { error } = await supabase.from("quote_subtasks").delete().eq("id", subtaskId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateQuotesModule(quoteId);
}

export async function addQuoteSubtaskEntryAction(formData: FormData) {
  const locale = await getLocale();
  const profile = await requireRole(["worker", "admin"]);
  const quoteId = trimString(formData, "quoteId");
  const quoteSubtaskId = trimString(formData, "quoteSubtaskId");
  const loggedHours = parseNumber(trimString(formData, "loggedHours"));
  const note = trimString(formData, "note");

  if (!quoteId || !quoteSubtaskId || Number.isNaN(loggedHours) || loggedHours <= 0) {
    throw new Error(t(locale, "Subtask and logged hours are required", "Sottoattività e ore registrate sono obbligatorie"));
  }

  if (profile.role === "worker") {
    const access = await assertWorkerAccessToQuote(quoteId, profile.id);
    if (access.quote.status !== "draft") {
      throw new Error(t(locale, "Logged entries can only be added while the quote is in draft", "Le voci registrate possono essere aggiunte solo mentre il preventivo è in bozza"));
    }
  } else {
    const existing = await getQuoteForAdmin(quoteId);
    if (existing.status !== "draft") {
      throw new Error(t(locale, "Logged entries can only be added while the quote is in draft", "Le voci registrate possono essere aggiunte solo mentre il preventivo è in bozza"));
    }
  }

  const supabase = await assertQuotesBackend();
  await getQuoteSubtaskForQuote(quoteId, quoteSubtaskId);

  const { error } = await supabase.from("quote_subtask_entries").insert({
    quote_subtask_id: quoteSubtaskId,
    worker_id: profile.id,
    logged_hours: loggedHours,
    note: note || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidateQuotesModule(quoteId);
}

export async function addQuoteLoggedHourAction(formData: FormData) {
  return addQuoteSubtaskEntryAction(formData);
}

export async function updateQuoteSubtaskEntryAction(formData: FormData) {
  const locale = await getLocale();
  await requireRole(["admin"]);
  const quoteId = trimString(formData, "quoteId");
  const entryId = trimString(formData, "entryId");
  const quoteSubtaskId = trimString(formData, "quoteSubtaskId");
  const loggedHours = parseNumber(trimString(formData, "loggedHours"));
  const note = trimString(formData, "note");

  if (!quoteId || !entryId || !quoteSubtaskId || Number.isNaN(loggedHours) || loggedHours <= 0) {
    throw new Error(t(locale, "Subtask and logged hours are required", "Sottoattività e ore registrate sono obbligatorie"));
  }

  const existing = await getQuoteForAdmin(quoteId);
  if (existing.status !== "draft") {
    throw new Error(t(locale, "Logged entries can only be edited while the quote is in draft", "Le voci registrate possono essere modificate solo mentre il preventivo è in bozza"));
  }

  await getQuoteSubtaskEntryForAdmin(quoteId, entryId);
  await getQuoteSubtaskForQuote(quoteId, quoteSubtaskId);

  const supabase = await assertQuotesBackend();
  const { error } = await supabase
    .from("quote_subtask_entries")
    .update({
      quote_subtask_id: quoteSubtaskId,
      logged_hours: loggedHours,
      note: note || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateQuotesModule(quoteId);
}

export async function deleteQuoteSubtaskEntryAction(formData: FormData) {
  const locale = await getLocale();
  await requireRole(["admin"]);
  const quoteId = trimString(formData, "quoteId");
  const entryId = trimString(formData, "entryId");

  if (!quoteId || !entryId) {
    throw new Error(t(locale, "Invalid logged entry payload", "Payload voce registrata non valido"));
  }

  const existing = await getQuoteForAdmin(quoteId);
  if (existing.status !== "draft") {
    throw new Error(t(locale, "Logged entries can only be deleted while the quote is in draft", "Le voci registrate possono essere eliminate solo mentre il preventivo è in bozza"));
  }

  await getQuoteSubtaskEntryForAdmin(quoteId, entryId);

  const supabase = await assertQuotesBackend();
  const { error } = await supabase.from("quote_subtask_entries").delete().eq("id", entryId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateQuotesModule(quoteId);
}

export async function confirmQuoteAction(formData: FormData) {
  const locale = await getLocale();
  const admin = await requireRole(["admin"]);
  const quoteId = trimString(formData, "quoteId");
  const adminNotes = trimString(formData, "adminNotes");

  if (!quoteId || !adminNotes) {
    throw new Error(t(locale, "Admin review notes are required", "Le note di revisione dell'amministratore sono obbligatorie"));
  }

  const existing = await getQuoteForAdmin(quoteId);
  if (existing.status !== "draft") {
    throw new Error(t(locale, "Only draft quotes can be reviewed", "Solo i preventivi in bozza possono essere revisionati"));
  }

  const supabase = await assertQuotesBackend();
  const { error } = await supabase.from("quote_comments").insert({
    quote_id: quoteId,
    author_id: admin.id,
    author_role: "admin",
    comment_html: adminNotes,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidateQuotesModule(quoteId);
}

export async function signQuoteAction(formData: FormData) {
  const locale = await getLocale();
  const admin = await requireRole(["admin"]);
  const quoteId = trimString(formData, "quoteId");
  const billingMode = trimString(formData, "billingMode");
  const signatureName = admin.full_name?.trim() || "";

  if (!quoteId || !signatureName) {
    throw new Error(t(locale, "Admin profile name is required to sign quotes", "Il nome del profilo admin è obbligatorio per firmare i preventivi"));
  }

  if (billingMode !== "prepaid" && billingMode !== "postpaid") {
    throw new Error(t(locale, "Select prepaid or post-paid before signing", "Seleziona prepagato o post-pagato prima di firmare"));
  }

  const existing = await getQuoteForAdmin(quoteId);
  if (existing.status !== "draft") {
    throw new Error(t(locale, "Only draft quotes can be signed", "Solo i preventivi in bozza possono essere firmati"));
  }

  const supabase = await assertQuotesBackend();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("quotes")
    .update({
      status: "signed",
      billing_mode: billingMode,
      signed_by_name: signatureName,
      signed_by_user_id: admin.id,
      signed_at: now,
      updated_at: now,
    })
    .eq("id", quoteId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateQuotesModule();
}

export async function revertQuoteToDraftAction(formData: FormData) {
  const locale = await getLocale();
  await requireRole(["admin"]);
  const quoteId = trimString(formData, "quoteId");

  if (!quoteId) {
    throw new Error(t(locale, "Quote id is required", "L'ID del preventivo è obbligatorio"));
  }

  const existing = await getQuoteForAdmin(quoteId);
  if (existing.status === "draft") {
    throw new Error(t(locale, "Quote is already in draft", "Il preventivo è già in bozza"));
  }

  const supabase = await assertQuotesBackend();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("quotes")
    .update({
      status: "draft",
      billing_mode: "prepaid",
      signed_by_name: null,
      signed_by_user_id: null,
      signed_at: null,
      customer_signed_by_name: null,
      customer_signed_by_user_id: null,
      customer_signed_at: null,
      linked_project_id: null,
      converted_at: null,
      updated_at: now,
    })
    .eq("id", quoteId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateQuotesModule(quoteId);
  after(async () => {
    await notifyQuoteReverted(quoteId);
  });
}

export async function switchQuoteToPostpaidAction(formData: FormData) {
  const locale = await getLocale();
  await requireRole(["admin"]);
  const quoteId = trimString(formData, "quoteId");
  const adminComment = trimString(formData, "adminComment");

  if (!quoteId) {
    throw new Error(t(locale, "Quote id is required", "L'ID del preventivo è obbligatorio"));
  }

  const existing = await getQuoteForAdmin(quoteId);
  if (existing.status !== "signed") {
    throw new Error(t(locale, "Only signed quotes can be switched to post-paid", "Solo i preventivi firmati possono essere convertiti in post-pagato"));
  }

  if (!existing.customerSignedAt) {
    throw new Error(t(locale, "Customer signature is required before conversion", "La firma cliente è obbligatoria prima della conversione"));
  }

  if (existing.billingMode === "postpaid") {
    throw new Error(t(locale, "Quote is already post-paid", "Il preventivo è già post-pagato"));
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("switch_quote_to_postpaid_and_convert", {
    p_quote_id: quoteId,
    p_admin_comment: adminComment || null,
  });

  if (error) {
    if (error.message.includes("quote_not_found")) {
      throw new Error(t(locale, "Quote not found", "Preventivo non trovato"));
    }

    if (error.message.includes("quote_not_signed")) {
      throw new Error(t(locale, "Only signed quotes can be switched to post-paid", "Solo i preventivi firmati possono essere convertiti in post-pagato"));
    }

    if (error.message.includes("quote_has_prepayment_activity")) {
      throw new Error(t(locale, "Quotes with prepayment activity cannot be switched to post-paid", "I preventivi con attività di prepagamento non possono essere convertiti in post-pagato"));
    }

    throw new Error(error.message);
  }

  revalidateQuotesModule(quoteId);

  after(async () => {
    await notifyQuoteConverted(quoteId);
  });
}

export async function markQuoteAsPaidAction(formData: FormData) {
  const locale = await getLocale();
  await requireRole(["admin"]);
  const quoteId = trimString(formData, "quoteId");
  const adminComment = trimString(formData, "adminComment");

  if (!quoteId) {
    throw new Error(t(locale, "Quote id is required", "L'ID del preventivo è obbligatorio"));
  }

  const existing = await getQuoteForAdmin(quoteId);
  if (existing.status !== "signed") {
    throw new Error(t(locale, "Only signed quotes can be marked as paid", "Solo i preventivi firmati possono essere segnati come pagati"));
  }

  if (!existing.customerSignedAt) {
    throw new Error(t(locale, "Customer signature is required before conversion", "La firma cliente è obbligatoria prima della conversione"));
  }

  const isPostPaid = existing.billingMode === "postpaid";

  if (!isPostPaid && (existing.totalEstimatedHours ?? 0) <= 0) {
    throw new Error(t(locale, "Estimated hours must be greater than zero", "Le ore stimate devono essere maggiori di zero"));
  }

  if (!isPostPaid) {
    const supabase = await assertQuotesBackend();
    const { data: prepaymentSessions, error: prepaymentError } = await supabase
      .from("quote_prepayment_sessions")
      .select("id")
      .eq("quote_id", quoteId)
      .in("status", ["pending", "paid"]);

    if (prepaymentError) {
      throw new Error(prepaymentError.message);
    }

    if ((prepaymentSessions ?? []).length > 0) {
      throw new Error(t(locale, "Quotes with prepayment activity cannot be manually marked as paid", "I preventivi con attività di prepagamento non possono essere segnati manualmente come pagati"));
    }
  }

  const admin = createAdminClient();
  const rpcName = isPostPaid ? "apply_postpaid_quote_conversion" : "apply_manual_quote_conversion";
  const { error } = await admin.rpc(rpcName, {
    p_quote_id: quoteId,
    p_admin_comment: adminComment || null,
  });

  if (error) {
    if (error.message.includes("quote_not_found")) {
      throw new Error(t(locale, "Quote not found", "Preventivo non trovato"));
    }

    if (error.message.includes("quote_not_signed")) {
      throw new Error(t(locale, "Only signed quotes can be marked as paid", "Solo i preventivi firmati possono essere segnati come pagati"));
    }

    if (error.message.includes("quote_invalid_hours")) {
      throw new Error(t(locale, "Estimated hours must be greater than zero", "Le ore stimate devono essere maggiori di zero"));
    }

    if (!isPostPaid && error.message.includes("quote_has_prepayment_activity")) {
      throw new Error(t(locale, "Quotes with prepayment activity cannot be manually marked as paid", "I preventivi con attività di prepagamento non possono essere segnati manualmente come pagati"));
    }

    throw new Error(error.message);
  }

  revalidateQuotesModule(quoteId);

  after(async () => {
    await notifyQuoteConverted(quoteId);
  });
}

export async function createCheckoutForQuotePrepaymentAction(formData: FormData) {
  const locale = await getLocale();
  const profile = await requireRole(["customer"]);
  const user = await getCurrentUser();
  const quoteId = trimString(formData, "quoteId");

  if (!quoteId) {
    throw new Error(t(locale, "Quote id is required", "L'ID del preventivo è obbligatorio"));
  }

  const existing = await getQuoteForCustomer(quoteId, profile.id);
  if (existing.status !== "signed") {
    throw new Error(t(locale, "Only admin-signed quotes can be customer-signed", "Solo i preventivi firmati dall'admin possono essere firmati dal cliente"));
  }

  if (existing.linkedProjectId) {
    throw new Error(t(locale, "Quote already converted", "Preventivo già convertito"));
  }

  if (existing.billingMode === "postpaid") {
    throw new Error(t(locale, "Post-paid quotes are converted immediately after customer signature", "I preventivi post-pagati vengono convertiti subito dopo la firma del cliente"));
  }

  const signatureName = profile.full_name?.trim() || "";
  if (!signatureName) {
    throw new Error(t(locale, "Customer profile name is required to sign quotes", "Il nome del profilo cliente è obbligatorio per firmare i preventivi"));
  }

  const estimatedHours = existing.totalEstimatedHours ?? 0;
  if (estimatedHours <= 0) {
    throw new Error(t(locale, "Estimated hours must be greater than zero", "Le ore stimate devono essere maggiori di zero"));
  }

  const supabase = await assertQuotesBackend();
  const { data: customerProfile, error: customerProfileError } = await supabase
    .from("profiles")
    .select("custom_hourly_rate_cents")
    .eq("id", profile.id)
    .single();

  const missingCustomerRateColumn = customerProfileError?.code === "PGRST204"
    || customerProfileError?.code === "42703"
    || customerProfileError?.message.includes("custom_hourly_rate_cents")
    || false;

  if ((customerProfileError && !missingCustomerRateColumn) || (!customerProfile && !missingCustomerRateColumn)) {
    throw new Error(customerProfileError?.message ?? t(locale, "Customer profile not found", "Profilo cliente non trovato"));
  }

  const unitAmount = customerProfile?.custom_hourly_rate_cents ?? env.stripePricePerHourCents;
  if (!Number.isInteger(unitAmount) || unitAmount <= 0) {
    throw new Error(t(locale, "Invalid hourly rate configuration", "Configurazione tariffa oraria non valida"));
  }

  const amountCents = Math.round(estimatedHours * unitAmount);
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error(t(locale, "Invalid prepayment amount", "Importo prepagamento non valido"));
  }

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user?.email ?? undefined,
    billing_address_collection: "required",
    tax_id_collection: {
      enabled: true,
      required: "if_supported",
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: env.stripeCurrency,
          product_data: {
            name: t(locale, "Quote conversion prepayment", "Prepagamento conversione preventivo"),
            description: `${existing.title} • ${estimatedHours.toFixed(2)}h`,
          },
          unit_amount: amountCents,
        },
      },
    ],
    success_url: `${env.appUrl}/customer/quotes?checkout=success`,
    cancel_url: `${env.appUrl}/customer/quotes?checkout=cancelled`,
    metadata: {
      checkoutKind: "quote_conversion",
      quoteId,
      customerId: profile.id,
      amountCents: String(amountCents),
      currency: env.stripeCurrency,
    },
  });

  if (!session.id || !session.url) {
    throw new Error(t(locale, "Missing checkout session data", "Dati sessione checkout mancanti"));
  }

  if (!existing.customerSignedAt && !existing.customerSignedByUserId) {
    const signatureTimestamp = new Date().toISOString();
    const { error: signatureError } = await supabase
      .from("quotes")
      .update({
        customer_signed_by_name: signatureName,
        customer_signed_by_user_id: profile.id,
        customer_signed_at: signatureTimestamp,
        updated_at: signatureTimestamp,
      })
      .eq("id", quoteId)
      .is("customer_signed_at", null);

    if (signatureError) {
      throw new Error(signatureError.message);
    }
  }

  const { error } = await supabase.from("quote_prepayment_sessions").insert({
    quote_id: quoteId,
    customer_id: profile.id,
    stripe_checkout_session_id: session.id,
    estimated_hours_snapshot: estimatedHours,
    amount_cents: amountCents,
    currency: env.stripeCurrency,
    status: "pending",
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect(session.url);
}

export async function requestQuotePrepaymentAction(formData: FormData) {
  return createCheckoutForQuotePrepaymentAction(formData);
}

export async function requestQuoteConversionAction(formData: FormData) {
  return createCheckoutForQuotePrepaymentAction(formData);
}

export async function startQuoteConversionCheckoutAction(formData: FormData) {
  const locale = await getLocale();
  const profile = await requireRole(["customer"]);
  const quoteId = trimString(formData, "quoteId");

  if (!quoteId) {
    throw new Error(t(locale, "Quote id is required", "L'ID del preventivo è obbligatorio"));
  }

  const existing = await getQuoteForCustomer(quoteId, profile.id);
  if (existing.status !== "signed") {
    throw new Error(t(locale, "Only admin-signed quotes can be customer-signed", "Solo i preventivi firmati dall'admin possono essere firmati dal cliente"));
  }

  if (existing.linkedProjectId) {
    throw new Error(t(locale, "Quote already converted", "Preventivo già convertito"));
  }

  if (existing.billingMode === "postpaid") {
    const signatureName = profile.full_name?.trim() || "";
    if (!signatureName) {
      throw new Error(t(locale, "Customer profile name is required to sign quotes", "Il nome del profilo cliente è obbligatorio per firmare i preventivi"));
    }

    if (existing.customerSignedAt || existing.customerSignedByUserId) {
      throw new Error(t(locale, "Quote already signed by customer", "Preventivo già firmato dal cliente"));
    }

    const now = new Date().toISOString();
    const supabase = await assertQuotesBackend();
    const { error: signatureError } = await supabase
      .from("quotes")
      .update({
        customer_signed_by_name: signatureName,
        customer_signed_by_user_id: profile.id,
        customer_signed_at: now,
        updated_at: now,
      })
      .eq("id", quoteId)
      .is("customer_signed_at", null);

    if (signatureError) {
      throw new Error(signatureError.message);
    }

    const admin = createAdminClient();
    const { error } = await admin.rpc("apply_postpaid_quote_conversion", {
      p_quote_id: quoteId,
      p_admin_comment: null,
    });

    if (error) {
      if (error.message.includes("quote_not_found")) {
        throw new Error(t(locale, "Quote not found", "Preventivo non trovato"));
      }

      if (error.message.includes("quote_not_signed")) {
        throw new Error(t(locale, "Quote must be admin-signed before customer conversion", "Il preventivo deve essere firmato dall'admin prima della conversione cliente"));
      }

      throw new Error(error.message);
    }

    revalidateQuotesModule(quoteId);
    after(async () => {
      await notifyQuoteConverted(quoteId);
    });
    redirect(
      withQueryToast(
        `/customer/quotes/${quoteId}`,
        "success",
        t(locale, "Quote signed and converted successfully", "Preventivo firmato e convertito con successo"),
      ),
    );
  }

  return createCheckoutForQuotePrepaymentAction(formData);
}
