"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import {
  parseProjectDiscussionMessageRecord,
  sanitizeRichTextHtml,
  type ProjectDiscussionMessageRecord,
} from "@/lib/quotes";

type RawRow = Record<string, unknown>;

interface DiscussionPayload {
  html: string | null;
  json: Record<string, unknown> | null;
}

function trimString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
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

function assertDiscussionPayload(payload: DiscussionPayload, locale: "en" | "it") {
  if (!payload.html && !payload.json) {
    throw new Error(t(locale, "Message content is required", "Il contenuto del messaggio è obbligatorio"));
  }
}

function revalidateProjectsModule(projectId?: string) {
  revalidatePath("/admin");
  revalidatePath("/customer");
  revalidatePath("/worker");

  if (projectId) {
    revalidatePath(`/admin/projects/${projectId}`);
    revalidatePath(`/customer/projects/${projectId}`);
    revalidatePath(`/worker/projects/${projectId}`);
  }
}

async function getProjectForAdmin(projectId: string) {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id,customer_id")
    .eq("id", projectId)
    .maybeSingle<{ id: string; customer_id: string }>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(t(locale, "Project not found", "Progetto non trovato"));
  }

  return data;
}

async function getProjectForCustomer(projectId: string, customerId: string) {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id,customer_id")
    .eq("id", projectId)
    .eq("customer_id", customerId)
    .maybeSingle<{ id: string; customer_id: string }>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(t(locale, "Project not found", "Progetto non trovato"));
  }

  return data;
}

async function assertWorkerAccessToProject(projectId: string, workerId: string) {
  const locale = await getLocale();
  const supabase = await createClient();
  const [projectResult, assignmentResult] = await Promise.all([
    supabase.from("projects").select("id,customer_id").eq("id", projectId).maybeSingle<{ id: string; customer_id: string }>(),
    supabase
      .from("project_workers")
      .select("project_id")
      .eq("project_id", projectId)
      .eq("worker_id", workerId)
      .maybeSingle<{ project_id: string }>(),
  ]);

  if (projectResult.error) {
    throw new Error(projectResult.error.message);
  }

  if (!projectResult.data) {
    throw new Error(t(locale, "Project not found", "Progetto non trovato"));
  }

  if (assignmentResult.error) {
    throw new Error(assignmentResult.error.message);
  }

  if (!assignmentResult.data) {
    throw new Error(t(locale, "Not authorized for this project", "Non autorizzato per questo progetto"));
  }

  return projectResult.data;
}

async function assertProjectDiscussionAccess(role: "admin" | "customer" | "worker", profileId: string, projectId: string) {
  if (role === "admin") {
    return getProjectForAdmin(projectId);
  }

  if (role === "customer") {
    return getProjectForCustomer(projectId, profileId);
  }

  return assertWorkerAccessToProject(projectId, profileId);
}

async function getProjectDiscussionMessageForMutation(projectId: string, messageId: string) {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_discussion_messages")
    .select("*")
    .eq("id", messageId)
    .eq("project_id", projectId)
    .maybeSingle<RawRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(t(locale, "Discussion message not found", "Messaggio della discussione non trovato"));
  }

  return parseProjectDiscussionMessageRecord(data);
}

async function loadProjectDiscussionMessages(projectId: string): Promise<ProjectDiscussionMessageRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_discussion_messages")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const messages = (data ?? []).map((row) => parseProjectDiscussionMessageRecord(row as RawRow));
  const profileIds = [...new Set(messages.map((message) => message.authorId).filter((value): value is string => Boolean(value)))];
  const profilesResult = profileIds.length > 0
    ? await supabase.from("profiles").select("id,full_name").in("id", profileIds)
    : { data: [], error: null };

  if (profilesResult.error) {
    throw new Error(profilesResult.error.message);
  }

  const profileNameById = new Map((profilesResult.data ?? []).map((profile) => [String(profile.id), profile.full_name?.trim() || null]));

  return messages.map((message) => ({
    ...message,
    authorName: message.authorName ?? (message.authorId ? profileNameById.get(message.authorId) ?? null : null),
    workerName: message.authorRole === "worker" && message.authorId ? profileNameById.get(message.authorId) ?? null : message.workerName,
  }));
}

export async function createProjectAction(formData: FormData) {
  const locale = await getLocale();
  await requireRole(["admin"]);

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const assignedHours = Number(formData.get("assignedHours") ?? "0");
  const workerIds = formData
    .getAll("workerIds")
    .map((value) => String(value).trim())
    .filter((value): value is string => value.length > 0);

  if (!name || !customerId || Number.isNaN(assignedHours) || assignedHours < 0) {
    throw new Error(t(locale, "Invalid project payload", "Payload progetto non valido"));
  }

  const supabase = await createClient();
  const projectId = crypto.randomUUID();
  const { error } = await supabase
    .from("projects")
    .insert({
    id: projectId,
    name,
    description: description || null,
    customer_id: customerId,
    assigned_hours: assignedHours,
    });

  if (error) {
    throw new Error(error.message);
  }

  if (workerIds.length > 0) {
    const uniqueWorkerIds = [...new Set(workerIds)];
    const { error: assignError } = await supabase.from("project_workers").upsert(
      uniqueWorkerIds.map((workerId) => ({
        project_id: projectId,
        worker_id: workerId,
      })),
      { onConflict: "project_id,worker_id" },
    );

    if (assignError) {
      throw new Error(assignError.message);
    }
  }

  revalidateProjectsModule(projectId);
}

export async function assignWorkerAction(formData: FormData) {
  const locale = await getLocale();
  await requireRole(["admin"]);

  const projectId = String(formData.get("projectId") ?? "").trim();
  const workerId = String(formData.get("workerId") ?? "").trim();

  if (!projectId || !workerId) {
    throw new Error(t(locale, "Invalid assignment payload", "Payload assegnazione non valido"));
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_workers")
    .upsert({ project_id: projectId, worker_id: workerId }, { onConflict: "project_id,worker_id" });

  if (error) {
    throw new Error(error.message);
  }

  revalidateProjectsModule(projectId);
}

export async function updateProjectAction(formData: FormData) {
  const locale = await getLocale();
  await requireRole(["admin"]);

  const projectId = String(formData.get("projectId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const workerIds = formData
    .getAll("workerIds")
    .map((value) => String(value).trim())
    .filter((value): value is string => value.length > 0);

  if (!projectId || !name || !customerId) {
    throw new Error(t(locale, "Invalid project payload", "Payload progetto non valido"));
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      name,
      description: description || null,
      customer_id: customerId,
    })
    .eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  const { error: clearAssignmentsError } = await supabase.from("project_workers").delete().eq("project_id", projectId);

  if (clearAssignmentsError) {
    throw new Error(clearAssignmentsError.message);
  }

  if (workerIds.length > 0) {
    const uniqueWorkerIds = [...new Set(workerIds)];
    const { error: assignError } = await supabase.from("project_workers").insert(
      uniqueWorkerIds.map((workerId) => ({
        project_id: projectId,
        worker_id: workerId,
      })),
    );

    if (assignError) {
      throw new Error(assignError.message);
    }
  }

  revalidateProjectsModule(projectId);
}

export async function deleteProjectAction(formData: FormData) {
  const locale = await getLocale();
  await requireRole(["admin"]);

  const projectId = String(formData.get("projectId") ?? "").trim();

  if (!projectId) {
    throw new Error(t(locale, "Invalid project payload", "Payload progetto non valido"));
  }

  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateProjectsModule(projectId);
}

export async function adjustProjectHoursAction(formData: FormData) {
  const locale = await getLocale();
  await requireRole(["admin"]);

  const projectId = String(formData.get("projectId") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const hoursDelta = Number(formData.get("hoursDelta") ?? "0");
  const adminComment = String(formData.get("adminComment") ?? "").trim();

  if (!projectId || !customerId || Number.isNaN(hoursDelta) || hoursDelta === 0 || !adminComment) {
    throw new Error(t(locale, "Invalid project adjustment payload", "Payload regolazione progetto non valido"));
  }

  const admin = createAdminClient();
  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id,customer_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    throw new Error(projectError.message);
  }

  if (!project || project.customer_id !== customerId) {
    throw new Error(t(locale, "Project not found", "Progetto non trovato"));
  }

  const { error: adjustmentError } = await admin.rpc("apply_manual_hour_adjustment", {
    p_project_id: projectId,
    p_customer_id: customerId,
    p_hours_added: hoursDelta,
    p_admin_comment: adminComment,
  });

  if (adjustmentError) {
    if (adjustmentError.message.includes("project_hours_negative")) {
      throw new Error(t(locale, "This adjustment would reduce project hours below zero", "Questa regolazione porterebbe le ore del progetto sotto zero"));
    }

    if (adjustmentError.message.includes("project_customer_mismatch")) {
      throw new Error(t(locale, "Project not found", "Progetto non trovato"));
    }

    if (adjustmentError.message.includes("invalid_hours_adjustment")) {
      throw new Error(t(locale, "Adjustment must be different from zero", "La regolazione deve essere diversa da zero"));
    }

    throw new Error(adjustmentError.message);
  }

  revalidateProjectsModule(projectId);
}

export async function loadProjectDiscussionAction(formData: FormData): Promise<ProjectDiscussionMessageRecord[]> {
  const locale = await getLocale();
  const profile = await requireRole(["admin", "customer", "worker"]);
  const projectId = trimString(formData, "projectId");

  if (!projectId) {
    throw new Error(t(locale, "Project not found", "Progetto non trovato"));
  }

  await assertProjectDiscussionAccess(profile.role, profile.id, projectId);

  return loadProjectDiscussionMessages(projectId);
}

export async function addProjectDiscussionMessageAction(formData: FormData) {
  const locale = await getLocale();
  const profile = await requireRole(["admin", "customer", "worker"]);
  const projectId = trimString(formData, "projectId");
  const payload = parseDiscussionPayload(formData, {
    htmlKeys: ["messageHtml", "message", "commentHtml", "comment"],
    jsonKeys: ["messageJson", "commentJson"],
  });

  if (!projectId) {
    throw new Error(t(locale, "Invalid discussion payload", "Payload discussione non valido"));
  }

  assertDiscussionPayload(payload, locale);
  await assertProjectDiscussionAccess(profile.role, profile.id, projectId);

  const supabase = await createClient();
  const { error } = await supabase.from("project_discussion_messages").insert({
    project_id: projectId,
    author_id: profile.id,
    author_role: profile.role,
    message_html: payload.html,
    message_json: payload.json,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidateProjectsModule(projectId);
}

export async function updateProjectDiscussionMessageAction(formData: FormData) {
  const locale = await getLocale();
  const profile = await requireRole(["admin", "customer", "worker"]);
  const projectId = trimString(formData, "projectId");
  const messageId = trimString(formData, "messageId");
  const payload = parseDiscussionPayload(formData, {
    htmlKeys: ["messageHtml", "message", "commentHtml", "comment"],
    jsonKeys: ["messageJson", "commentJson"],
  });

  if (!projectId || !messageId) {
    throw new Error(t(locale, "Invalid discussion payload", "Payload discussione non valido"));
  }

  assertDiscussionPayload(payload, locale);
  await assertProjectDiscussionAccess(profile.role, profile.id, projectId);

  const existingMessage = await getProjectDiscussionMessageForMutation(projectId, messageId);
  if (profile.role !== "admin" && existingMessage.authorId !== profile.id) {
    throw new Error(t(locale, "You can only edit your own discussion messages", "Puoi modificare solo i tuoi messaggi di discussione"));
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_discussion_messages")
    .update({
      message_html: payload.html,
      message_json: payload.json,
    })
    .eq("id", messageId)
    .eq("project_id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateProjectsModule(projectId);
}
