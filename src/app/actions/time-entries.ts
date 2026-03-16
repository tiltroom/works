"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export async function startTimerAction(formData: FormData) {
  const profile = await requireRole(["worker", "admin"]);

  const projectId = String(formData.get("projectId") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!projectId) {
    throw new Error("Project is required");
  }

  const supabase = await createClient();

  const { data: existingOpen, error: openError } = await supabase
    .from("time_entries")
    .select("id")
    .eq("worker_id", profile.id)
    .is("ended_at", null)
    .limit(1);

  if (openError) {
    throw new Error(openError.message);
  }

  if ((existingOpen ?? []).length > 0) {
    throw new Error("You already have a running timer");
  }

  const { error } = await supabase.from("time_entries").insert({
    project_id: projectId,
    worker_id: profile.id,
    started_at: new Date().toISOString(),
    ended_at: null,
    description: description || null,
    source: "timer",
  });

  if (error) {
    if (error.message.includes("idx_time_entries_single_open_timer")) {
      throw new Error("A timer is already running");
    }
    throw new Error(error.message);
  }

  revalidatePath("/worker");
}

export async function stopTimerAction(formData: FormData) {
  const profile = await requireRole(["worker", "admin"]);
  const timeEntryId = String(formData.get("timeEntryId") ?? "").trim();

  if (!timeEntryId) {
    throw new Error("Time entry id is required");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("time_entries")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", timeEntryId)
    .eq("worker_id", profile.id)
    .is("ended_at", null);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/worker");
}

export async function createManualTimeEntryAction(formData: FormData) {
  const profile = await requireRole(["worker", "admin"]);

  const projectId = String(formData.get("projectId") ?? "").trim();
  const startedAt = String(formData.get("startedAt") ?? "").trim();
  const endedAt = String(formData.get("endedAt") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!projectId || !startedAt || !endedAt) {
    throw new Error("Project, start and end are required");
  }

  const startDate = new Date(startedAt);
  const endDate = new Date(endedAt);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
    throw new Error("Invalid date range");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").insert({
    project_id: projectId,
    worker_id: profile.id,
    started_at: startDate.toISOString(),
    ended_at: endDate.toISOString(),
    description: description || null,
    source: "manual",
  });

  if (error) {
    if (error.message.includes("time_entry_overlap")) {
      throw new Error("This manual entry overlaps with another existing entry");
    }
    throw new Error(error.message);
  }

  revalidatePath("/worker");
}
