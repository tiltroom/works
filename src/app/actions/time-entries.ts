"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getLocale, t } from "@/lib/i18n";

export async function startTimerAction(formData: FormData) {
  const locale = await getLocale();
  const profile = await requireRole(["worker", "admin"]);

  const projectId = String(formData.get("projectId") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!projectId) {
    throw new Error(t(locale, "Project is required", "Il progetto è obbligatorio"));
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
    throw new Error(t(locale, "You already have a running timer", "Hai già un timer in esecuzione"));
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
      throw new Error(t(locale, "A timer is already running", "Un timer è già in esecuzione"));
    }
    throw new Error(error.message);
  }

  revalidatePath("/worker");
}

export async function stopTimerAction(formData: FormData) {
  const locale = await getLocale();
  const profile = await requireRole(["worker", "admin"]);
  const timeEntryId = String(formData.get("timeEntryId") ?? "").trim();

  if (!timeEntryId) {
    throw new Error(t(locale, "Time entry id is required", "L'ID della voce tempo è obbligatorio"));
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
  const locale = await getLocale();
  const profile = await requireRole(["worker", "admin"]);

  const projectId = String(formData.get("projectId") ?? "").trim();
  const startedAt = String(formData.get("startedAt") ?? "").trim();
  const endedAt = String(formData.get("endedAt") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!projectId || !startedAt || !endedAt) {
    throw new Error(t(locale, "Project, start and end are required", "Progetto, inizio e fine sono obbligatori"));
  }

  const startDate = new Date(startedAt);
  const endDate = new Date(endedAt);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
    throw new Error(t(locale, "Invalid date range", "Intervallo date non valido"));
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
      throw new Error(t(locale, "This manual entry overlaps with another existing entry", "Questa voce manuale si sovrappone a un'altra voce esistente"));
    }
    throw new Error(error.message);
  }

  revalidatePath("/worker");
}
