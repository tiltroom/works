import {
  renderProjectDiscussionMessageEmail,
  renderQuoteConvertedEmail,
  renderQuoteCreatedEmail,
  renderQuoteDiscussionMessageEmail,
  renderQuoteRevertedEmail,
  type EmailEventType,
} from "@/lib/email-templates";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/types";

type NotificationRole = AppRole;

type NotificationLocale = "en" | "it";

interface QuoteNotificationContext {
  quoteId: string;
  quoteTitle: string;
  customerId: string;
  customerName: string;
}

interface ProjectNotificationContext {
  projectId: string;
  projectTitle: string;
  customerId: string;
  customerName: string;
}

interface ResolvedRecipient {
  userId: string;
  role: NotificationRole;
  email: string;
  locale: NotificationLocale;
}

interface RecipientProfileRow {
  id: string;
  role: NotificationRole;
  locale: string | null;
  full_name: string | null;
}

interface QuoteRow {
  id: string;
  title: string | null;
  customer_id: string;
}

interface ProjectRow {
  id: string;
  name: string | null;
  customer_id: string;
}

interface QuoteWorkerRow {
  worker_id: string;
}

interface ProjectWorkerRow {
  worker_id: string;
}

interface NotificationLogInsert {
  id: string;
}

interface NotificationLogRow {
  id: string;
  status: "pending" | "sent" | "failed";
  created_at?: string;
  updated_at?: string;
}

interface QuoteEventNotificationOptions {
  dedupeKey?: string;
  actorUserId?: string | null;
  actorLocale?: string | null;
}

const PENDING_NOTIFICATION_RETRY_AFTER_MS = 5 * 60 * 1000;

function normalizeLocale(locale: string | null | undefined): NotificationLocale {
  return locale === "it" ? "it" : "en";
}

function resolveActorRecipientLocale(
  recipient: ResolvedRecipient,
  actorUserId: string | null | undefined,
  actorLocale: string | null | undefined,
) {
  return actorUserId && recipient.userId === actorUserId
    ? normalizeLocale(actorLocale)
    : recipient.locale;
}

function normalizeQuoteEventNotificationOptions(
  options: string | QuoteEventNotificationOptions | undefined,
  fallbackDedupeKey: string,
) {
  if (typeof options === "string") {
    return {
      dedupeKey: options,
      actorUserId: null,
      actorLocale: null,
    };
  }

  return {
    dedupeKey: options?.dedupeKey ?? fallbackDedupeKey,
    actorUserId: options?.actorUserId ?? null,
    actorLocale: options?.actorLocale ?? null,
  };
}

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

function normalizePreviewText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const withoutTags = value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (!withoutTags) {
    return null;
  }

  return withoutTags.length > 240 ? `${withoutTags.slice(0, 237)}...` : withoutTags;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}

function isDuplicateNotificationError(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }

  return error.code === "23505"
    || error.message?.includes("email_notifications_dedup_unique")
    || error.message?.includes("email_notifications_quote_dedup_unique")
    || error.message?.includes("email_notifications_project_dedup_unique")
    || false;
}

async function getQuoteNotificationContext(quoteId: string): Promise<QuoteNotificationContext> {
  const adminClient = createAdminClient();
  const { data: quote, error: quoteError } = await adminClient
    .from("quotes")
    .select("id,title,customer_id")
    .eq("id", quoteId)
    .maybeSingle<QuoteRow>();

  if (quoteError) {
    throw new Error(quoteError.message);
  }

  if (!quote) {
    throw new Error(`Quote not found: ${quoteId}`);
  }

  const { data: customerProfile, error: customerProfileError } = await adminClient
    .from("profiles")
    .select("id,full_name,locale,role")
    .eq("id", quote.customer_id)
    .maybeSingle<RecipientProfileRow>();

  if (customerProfileError) {
    throw new Error(customerProfileError.message);
  }

  return {
    quoteId: quote.id,
    quoteTitle: quote.title?.trim() || "Untitled quote",
    customerId: quote.customer_id,
    customerName: customerProfile?.full_name?.trim() || "—",
  };
}

async function getProjectNotificationContext(projectId: string): Promise<ProjectNotificationContext> {
  const adminClient = createAdminClient();
  const { data: project, error: projectError } = await adminClient
    .from("projects")
    .select("id,name,customer_id")
    .eq("id", projectId)
    .maybeSingle<ProjectRow>();

  if (projectError) {
    throw new Error(projectError.message);
  }

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const { data: customerProfile, error: customerProfileError } = await adminClient
    .from("profiles")
    .select("id,full_name,locale,role")
    .eq("id", project.customer_id)
    .maybeSingle<RecipientProfileRow>();

  if (customerProfileError) {
    throw new Error(customerProfileError.message);
  }

  return {
    projectId: project.id,
    projectTitle: project.name?.trim() || "Untitled project",
    customerId: project.customer_id,
    customerName: customerProfile?.full_name?.trim() || "—",
  };
}

async function fetchProfilesByIds(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, RecipientProfileRow>();
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("profiles")
    .select("id,role,locale,full_name")
    .in("id", userIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map((data ?? []).map((row) => [String(row.id), row as RecipientProfileRow]));
}

async function resolveEmailForUser(userId: string) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.auth.admin.getUserById(userId);

  if (error || !data.user) {
    throw new Error(error?.message ?? `Auth user not found: ${userId}`);
  }

  const email = normalizeEmail(data.user.email);
  if (!email) {
    throw new Error(`Auth user ${userId} has no email address`);
  }

  return email;
}

export async function resolveRecipients(
  quoteId: string,
  includeAdmins: boolean,
  includeCustomer: boolean,
  includeWorkers: boolean,
) {
  const adminClient = createAdminClient();
  const recipientRoles = new Map<string, NotificationRole>();

  if (includeAdmins) {
    const { data: adminProfiles, error: adminProfilesError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if (adminProfilesError) {
      throw new Error(adminProfilesError.message);
    }

    for (const profile of adminProfiles ?? []) {
      const userId = String(profile.id);
      if (!recipientRoles.has(userId)) {
        recipientRoles.set(userId, "admin");
      }
    }
  }

  let quoteRow: QuoteRow | null = null;
  if (includeCustomer || includeWorkers) {
    const { data, error } = await adminClient
      .from("quotes")
      .select("id,title,customer_id")
      .eq("id", quoteId)
      .maybeSingle<QuoteRow>();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error(`Quote not found: ${quoteId}`);
    }

    quoteRow = data;
  }

  if (includeCustomer && quoteRow?.customer_id && !recipientRoles.has(quoteRow.customer_id)) {
    recipientRoles.set(quoteRow.customer_id, "customer");
  }

  if (includeWorkers) {
    const { data: workerRows, error: workerRowsError } = await adminClient
      .from("quote_workers")
      .select("worker_id")
      .eq("quote_id", quoteId);

    if (workerRowsError) {
      throw new Error(workerRowsError.message);
    }

    for (const row of (workerRows ?? []) as QuoteWorkerRow[]) {
      const userId = String(row.worker_id);
      if (!recipientRoles.has(userId)) {
        recipientRoles.set(userId, "worker");
      }
    }
  }

  const userIds = [...recipientRoles.keys()];
  const profilesById = await fetchProfilesByIds(userIds);

  const recipients = await Promise.all(userIds.map(async (userId) => {
    const profile = profilesById.get(userId);
    const email = await resolveEmailForUser(userId);

    return {
      userId,
      role: recipientRoles.get(userId) ?? profile?.role ?? "worker",
      email,
      locale: normalizeLocale(profile?.locale),
    } satisfies ResolvedRecipient;
  }));

  return recipients;
}

export async function resolveProjectRecipients(
  projectId: string,
  includeAdmins: boolean,
  includeCustomer: boolean,
  includeWorkers: boolean,
) {
  const adminClient = createAdminClient();
  const recipientRoles = new Map<string, NotificationRole>();

  if (includeAdmins) {
    const { data: adminProfiles, error: adminProfilesError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if (adminProfilesError) {
      throw new Error(adminProfilesError.message);
    }

    for (const profile of adminProfiles ?? []) {
      const userId = String(profile.id);
      if (!recipientRoles.has(userId)) {
        recipientRoles.set(userId, "admin");
      }
    }
  }

  let projectRow: ProjectRow | null = null;
  if (includeCustomer || includeWorkers) {
    const { data, error } = await adminClient
      .from("projects")
      .select("id,name,customer_id")
      .eq("id", projectId)
      .maybeSingle<ProjectRow>();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error(`Project not found: ${projectId}`);
    }

    projectRow = data;
  }

  if (includeCustomer && projectRow?.customer_id && !recipientRoles.has(projectRow.customer_id)) {
    recipientRoles.set(projectRow.customer_id, "customer");
  }

  if (includeWorkers) {
    const { data: workerRows, error: workerRowsError } = await adminClient
      .from("project_workers")
      .select("worker_id")
      .eq("project_id", projectId);

    if (workerRowsError) {
      throw new Error(workerRowsError.message);
    }

    for (const row of (workerRows ?? []) as ProjectWorkerRow[]) {
      const userId = String(row.worker_id);
      if (!recipientRoles.has(userId)) {
        recipientRoles.set(userId, "worker");
      }
    }
  }

  const userIds = [...recipientRoles.keys()];
  const profilesById = await fetchProfilesByIds(userIds);

  const recipients = await Promise.all(userIds.map(async (userId) => {
    const profile = profilesById.get(userId);
    const email = await resolveEmailForUser(userId);

    return {
      userId,
      role: recipientRoles.get(userId) ?? profile?.role ?? "worker",
      email,
      locale: normalizeLocale(profile?.locale),
    } satisfies ResolvedRecipient;
  }));

  return recipients;
}

async function insertPendingNotificationLog(params: {
  quoteId?: string;
  projectId?: string;
  eventType: EmailEventType;
  recipient: ResolvedRecipient;
  subject: string;
  dedupeKey: string;
}) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("email_notifications")
    .insert({
      quote_id: params.quoteId ?? null,
      project_id: params.projectId ?? null,
      event_type: params.eventType,
      recipient_user_id: params.recipient.userId,
      dedupe_key: params.dedupeKey,
      recipient_email: params.recipient.email,
      locale: params.recipient.locale,
      subject: params.subject,
      status: "pending",
    })
    .select("id")
    .maybeSingle<NotificationLogInsert>();

  if (isDuplicateNotificationError(error)) {
    return { status: "duplicate" as const, notificationLogId: null };
  }

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("Failed to create email_notifications row");
  }

  return { status: "created" as const, notificationLogId: data.id };
}

async function updateNotificationLogStatus(notificationLogId: string, status: "pending" | "sent" | "failed", errorMessage?: string) {
  const adminClient = createAdminClient();
  const updatePayload: {
    status: "pending" | "sent" | "failed";
    error_message?: string | null;
    updated_at: string;
  } = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === "failed") {
    updatePayload.error_message = errorMessage ?? "Unknown error";
  } else {
    updatePayload.error_message = null;
  }

  const { error } = await adminClient
    .from("email_notifications")
    .update(updatePayload)
    .eq("id", notificationLogId);

  if (error) {
    throw new Error(error.message);
  }
}

async function getLatestNotificationLog(params: {
  quoteId?: string;
  projectId?: string;
  eventType: EmailEventType;
  recipientUserId: string;
  dedupeKey?: string;
}) {
  const adminClient = createAdminClient();
  let query = adminClient
    .from("email_notifications")
    .select("id,status,created_at,updated_at")
    .eq("event_type", params.eventType)
    .eq("recipient_user_id", params.recipientUserId);

  if (params.quoteId) {
    query = query.eq("quote_id", params.quoteId);
  }

  if (params.projectId) {
    query = query.eq("project_id", params.projectId);
  }

  if (params.dedupeKey) {
    query = query.eq("dedupe_key", params.dedupeKey);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as NotificationLogRow[];
  rows.sort((a, b) => {
    const aTime = Date.parse(a.updated_at ?? a.created_at ?? "") || 0;
    const bTime = Date.parse(b.updated_at ?? b.created_at ?? "") || 0;
    return bTime - aTime;
  });

  return rows[0] ?? null;
}

function isStalePendingNotification(row: NotificationLogRow) {
  const lastAttempt = Date.parse(row.updated_at ?? row.created_at ?? "");
  if (!lastAttempt) {
    return true;
  }

  return Date.now() - lastAttempt > PENDING_NOTIFICATION_RETRY_AFTER_MS;
}

async function dispatchNotification(params: {
  quoteId?: string;
  projectId?: string;
  eventType: EmailEventType;
  recipient: ResolvedRecipient;
  subject: string;
  html: string;
}) {
  if (!env.edgeFunctionUrl) {
    throw new Error("Missing EDGE_FUNCTION_URL");
  }

  if (!env.edgeFunctionSecret) {
    throw new Error("Missing EDGE_FUNCTION_SECRET");
  }

  console.info("Sending email notification", {
    email: params.recipient.email,
    eventType: params.eventType,
  });

  const response = await fetch(env.edgeFunctionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.edgeFunctionSecret}`,
    },
    body: JSON.stringify({
      to: params.recipient.email,
      subject: params.subject,
      html: params.html,
      eventType: params.eventType,
      quoteId: params.quoteId,
      projectId: params.projectId,
      recipientUserId: params.recipient.userId,
      locale: params.recipient.locale,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Edge Function request failed (${response.status}): ${responseText}`);
  }
}

function logSettledNotificationFailures(
  results: PromiseSettledResult<void>[],
  context: { quoteId?: string; projectId?: string; eventType: EmailEventType },
) {
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Email notification send failed", {
        quoteId: context.quoteId,
        projectId: context.projectId,
        eventType: context.eventType,
        error: getErrorMessage(result.reason),
      });
    }
  }
}

async function sendNotificationToRecipient(params: {
  quoteId?: string;
  projectId?: string;
  eventType: EmailEventType;
  recipient: ResolvedRecipient;
  subject: string;
  html: string;
  dedupeKey: string;
}) {
  const existingLog = await getLatestNotificationLog({
    quoteId: params.quoteId,
    projectId: params.projectId,
    eventType: params.eventType,
    recipientUserId: params.recipient.userId,
    dedupeKey: params.dedupeKey,
  });

  if (existingLog?.status === "sent") {
    return;
  }

  if (existingLog?.status === "pending" && !isStalePendingNotification(existingLog)) {
    return;
  }

  if (existingLog?.status === "pending" && isStalePendingNotification(existingLog)) {
    try {
      await dispatchNotification(params);
      await updateNotificationLogStatus(existingLog.id, "sent");
    } catch (error) {
      const message = getErrorMessage(error);

      try {
        await updateNotificationLogStatus(existingLog.id, "failed", message);
      } catch (updateError) {
        console.error("Failed to update notification log status", {
          quoteId: params.quoteId,
          projectId: params.projectId,
          eventType: params.eventType,
          recipientUserId: params.recipient.userId,
          error: getErrorMessage(updateError),
        });
      }

      throw error;
    }

    return;
  }

  const pendingResult = await insertPendingNotificationLog({
    quoteId: params.quoteId,
    projectId: params.projectId,
    eventType: params.eventType,
    recipient: params.recipient,
    subject: params.subject,
    dedupeKey: params.dedupeKey,
  });

  if (pendingResult.status === "duplicate") {
    const duplicateLog = await getLatestNotificationLog({
      quoteId: params.quoteId,
      projectId: params.projectId,
      eventType: params.eventType,
      recipientUserId: params.recipient.userId,
      dedupeKey: params.dedupeKey,
    });

    if (duplicateLog?.status === "failed") {
      await updateNotificationLogStatus(duplicateLog.id, "pending");
      try {
        await dispatchNotification(params);
        await updateNotificationLogStatus(duplicateLog.id, "sent");
      } catch (error) {
        const message = getErrorMessage(error);

        try {
          await updateNotificationLogStatus(duplicateLog.id, "failed", message);
        } catch (updateError) {
          console.error("Failed to update notification log status", {
            quoteId: params.quoteId,
            projectId: params.projectId,
            eventType: params.eventType,
            recipientUserId: params.recipient.userId,
            error: getErrorMessage(updateError),
          });
        }

        throw error;
      }
    }

    return;
  }

  try {
    await dispatchNotification(params);
    await updateNotificationLogStatus(pendingResult.notificationLogId, "sent");
  } catch (error) {
    const message = getErrorMessage(error);

    try {
      await updateNotificationLogStatus(pendingResult.notificationLogId, "failed", message);
    } catch (updateError) {
      console.error("Failed to update notification log status", {
        quoteId: params.quoteId,
        projectId: params.projectId,
        eventType: params.eventType,
        recipientUserId: params.recipient.userId,
        error: getErrorMessage(updateError),
      });
    }

    throw error;
  }
}

async function notifyQuoteEvent(params: {
  quoteId: string;
  eventType: EmailEventType;
  includeAdmins: boolean;
  includeCustomer: boolean;
  includeWorkers: boolean;
  dedupeKey: string;
  actorUserId?: string | null;
  actorLocale?: string | null;
  renderEmail: (recipient: ResolvedRecipient, context: QuoteNotificationContext) => { subject: string; html: string };
}) {
  const [context, recipients] = await Promise.all([
    getQuoteNotificationContext(params.quoteId),
    resolveRecipients(params.quoteId, params.includeAdmins, params.includeCustomer, params.includeWorkers),
  ]);

  const results = await Promise.allSettled(
    recipients.map(async (recipient) => {
      const locale = resolveActorRecipientLocale(recipient, params.actorUserId, params.actorLocale);
      const localizedRecipient = { ...recipient, locale };
      const renderedEmail = params.renderEmail(localizedRecipient, context);

      await sendNotificationToRecipient({
        quoteId: params.quoteId,
        eventType: params.eventType,
        recipient: localizedRecipient,
        subject: renderedEmail.subject,
        html: renderedEmail.html,
        dedupeKey: params.dedupeKey,
      });
    }),
  );

  logSettledNotificationFailures(results, {
    quoteId: params.quoteId,
    eventType: params.eventType,
  });
}

export async function notifyQuoteCreated(quoteId: string, customerId: string) {
  try {
    const context = await getQuoteNotificationContext(quoteId);
    if (context.customerId !== customerId) {
      console.error("notifyQuoteCreated customer mismatch", {
        quoteId,
        expectedCustomerId: context.customerId,
        receivedCustomerId: customerId,
      });
    }

    const recipients = await resolveRecipients(quoteId, true, false, false);

    const results = await Promise.allSettled(
      recipients.map(async (recipient) => {
        const renderedEmail = renderQuoteCreatedEmail({
          locale: recipient.locale,
          quoteTitle: context.quoteTitle,
          quoteId: context.quoteId,
          customerName: context.customerName,
          appUrl: env.appUrl,
        });

        await sendNotificationToRecipient({
          quoteId: context.quoteId,
          eventType: "quote_created",
          recipient,
          subject: renderedEmail.subject,
          html: renderedEmail.html,
          dedupeKey: `quote-created:${context.quoteId}`,
        });
      }),
    );

    logSettledNotificationFailures(results, {
      quoteId: context.quoteId,
      eventType: "quote_created",
    });
  } catch (error) {
    console.error("notifyQuoteCreated failed", {
      quoteId,
      customerId,
      error: getErrorMessage(error),
    });
  }
}

export async function notifyQuoteDiscussionMessage(params: {
  quoteId: string;
  actorUserId?: string | null;
  actorLocale?: string | null;
  authorName?: string | null;
  messageHtml?: string | null;
  dedupeKey?: string;
}) {
  try {
    const [context, recipients] = await Promise.all([
      getQuoteNotificationContext(params.quoteId),
      resolveRecipients(params.quoteId, true, true, true),
    ]);
    const dedupeKey = params.dedupeKey ?? `quote-discussion:${params.quoteId}:${Date.now()}`;
    const messagePreview = normalizePreviewText(params.messageHtml);
    const authorName = params.authorName?.trim() || "Someone";

    const results = await Promise.allSettled(
      recipients.map(async (recipient) => {
        const locale = resolveActorRecipientLocale(recipient, params.actorUserId, params.actorLocale);
        const localizedRecipient = { ...recipient, locale };
        const renderedEmail = renderQuoteDiscussionMessageEmail({
          locale,
          quoteTitle: context.quoteTitle,
          quoteId: context.quoteId,
          customerName: context.customerName,
          authorName,
          messagePreview,
          appUrl: env.appUrl,
          recipientRole: recipient.role,
        });

        await sendNotificationToRecipient({
          quoteId: context.quoteId,
          eventType: "quote_discussion_message",
          recipient: localizedRecipient,
          subject: renderedEmail.subject,
          html: renderedEmail.html,
          dedupeKey,
        });
      }),
    );

    logSettledNotificationFailures(results, {
      quoteId: context.quoteId,
      eventType: "quote_discussion_message",
    });
  } catch (error) {
    console.error("notifyQuoteDiscussionMessage failed", {
      quoteId: params.quoteId,
      error: getErrorMessage(error),
    });
  }
}

export async function notifyProjectDiscussionMessage(params: {
  projectId: string;
  actorUserId?: string | null;
  actorLocale?: string | null;
  authorName?: string | null;
  messageHtml?: string | null;
  dedupeKey?: string;
}) {
  try {
    const [context, recipients] = await Promise.all([
      getProjectNotificationContext(params.projectId),
      resolveProjectRecipients(params.projectId, true, true, true),
    ]);
    const dedupeKey = params.dedupeKey ?? `project-discussion:${params.projectId}:${Date.now()}`;
    const messagePreview = normalizePreviewText(params.messageHtml);
    const authorName = params.authorName?.trim() || "Someone";

    const results = await Promise.allSettled(
      recipients.map(async (recipient) => {
        const locale = resolveActorRecipientLocale(recipient, params.actorUserId, params.actorLocale);
        const localizedRecipient = { ...recipient, locale };
        const renderedEmail = renderProjectDiscussionMessageEmail({
          locale,
          projectTitle: context.projectTitle,
          projectId: context.projectId,
          customerName: context.customerName,
          authorName,
          messagePreview,
          appUrl: env.appUrl,
          recipientRole: recipient.role,
        });

        await sendNotificationToRecipient({
          projectId: context.projectId,
          eventType: "project_discussion_message",
          recipient: localizedRecipient,
          subject: renderedEmail.subject,
          html: renderedEmail.html,
          dedupeKey,
        });
      }),
    );

    logSettledNotificationFailures(results, {
      projectId: context.projectId,
      eventType: "project_discussion_message",
    });
  } catch (error) {
    console.error("notifyProjectDiscussionMessage failed", {
      projectId: params.projectId,
      error: getErrorMessage(error),
    });
  }
}

export async function notifyQuoteConverted(
  quoteId: string,
  options?: string | QuoteEventNotificationOptions,
) {
  const notificationOptions = normalizeQuoteEventNotificationOptions(options, `quote-converted:${quoteId}:${Date.now()}`);

  try {
    await notifyQuoteEvent({
      quoteId,
      eventType: "quote_converted",
      includeAdmins: true,
      includeCustomer: true,
      includeWorkers: true,
      dedupeKey: notificationOptions.dedupeKey,
      actorUserId: notificationOptions.actorUserId,
      actorLocale: notificationOptions.actorLocale,
      renderEmail: (recipient, context) => renderQuoteConvertedEmail({
        locale: recipient.locale,
        quoteTitle: context.quoteTitle,
        quoteId: context.quoteId,
        customerName: context.customerName,
        appUrl: env.appUrl,
        recipientRole: recipient.role,
      }),
    });
  } catch (error) {
    console.error("notifyQuoteConverted failed", {
      quoteId,
      error: getErrorMessage(error),
    });
  }
}

export async function notifyQuoteReverted(
  quoteId: string,
  options?: string | QuoteEventNotificationOptions,
) {
  const notificationOptions = normalizeQuoteEventNotificationOptions(options, `quote-reverted:${quoteId}:${Date.now()}`);

  try {
    await notifyQuoteEvent({
      quoteId,
      eventType: "quote_reverted",
      includeAdmins: true,
      includeCustomer: true,
      includeWorkers: true,
      dedupeKey: notificationOptions.dedupeKey,
      actorUserId: notificationOptions.actorUserId,
      actorLocale: notificationOptions.actorLocale,
      renderEmail: (recipient, context) => renderQuoteRevertedEmail({
        locale: recipient.locale,
        quoteTitle: context.quoteTitle,
        quoteId: context.quoteId,
        customerName: context.customerName,
        appUrl: env.appUrl,
        recipientRole: recipient.role,
      }),
    });
  } catch (error) {
    console.error("notifyQuoteReverted failed", {
      quoteId,
      error: getErrorMessage(error),
    });
  }
}
