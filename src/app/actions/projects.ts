"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

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

  revalidatePath("/admin");
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

  revalidatePath("/admin");
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

  revalidatePath("/admin");
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

  revalidatePath("/admin");
}
