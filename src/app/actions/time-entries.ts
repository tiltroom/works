"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getLocale, t } from "@/lib/i18n";

interface OpenTimeEntryRow {
  id: string;
  started_at: string;
}

interface ClosedTimeEntryRow {
  started_at: string;
  ended_at: string;
}

interface EditableTimeEntryRow {
  id: string;
  ended_at: string | null;
}

interface ProjectWorkerRow {
  project_id: string;
}

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
  const { data: runningEntry, error: runningEntryError } = await supabase
    .from("time_entries")
    .select("id,started_at")
    .eq("id", timeEntryId)
    .eq("worker_id", profile.id)
    .is("ended_at", null)
    .maybeSingle<OpenTimeEntryRow>();

  if (runningEntryError) {
    throw new Error(runningEntryError.message);
  }

  if (!runningEntry) {
    throw new Error(t(locale, "The running timer could not be found", "Il timer in esecuzione non è stato trovato"));
  }

  const stoppedAt = new Date().toISOString();
  const { error } = await supabase
    .from("time_entries")
    .update({ ended_at: stoppedAt })
    .eq("id", timeEntryId)
    .eq("worker_id", profile.id)
    .is("ended_at", null);

  if (error) {
    if (error.message.includes("time_entry_overlap")) {
      const conflictResult = await supabase
        .from("time_entries")
        .select("started_at,ended_at")
        .eq("worker_id", profile.id)
        .neq("id", timeEntryId)
        .not("ended_at", "is", null)
        .lt("started_at", stoppedAt)
        .gt("ended_at", runningEntry.started_at)
        .order("started_at", { ascending: true })
        .limit(1);

      const conflicts = (conflictResult.data ?? []) as ClosedTimeEntryRow[];
      const conflictError = conflictResult.error;

      if (conflictError) {
        throw new Error(conflictError.message);
      }

      const firstConflict = conflicts?.[0];
      if (firstConflict && firstConflict.started_at > runningEntry.started_at) {
        const { error: retryError } = await supabase
          .from("time_entries")
          .update({ ended_at: firstConflict.started_at })
          .eq("id", timeEntryId)
          .eq("worker_id", profile.id)
          .is("ended_at", null);

        if (!retryError) {
          revalidatePath("/worker");
          return;
        }

        if (!retryError.message.includes("time_entry_overlap")) {
          throw new Error(retryError.message);
        }
      }

      throw new Error(
        t(
          locale,
          "This timer overlaps with an existing time entry. Adjust the conflicting entry and try again.",
          "Questo timer si sovrappone a una voce di tempo esistente. Modifica la voce in conflitto e riprova.",
        ),
      );
    }

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
  const now = new Date();
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
    throw new Error(t(locale, "Invalid date range", "Intervallo date non valido"));
  }

  if (endDate > now) {
    throw new Error(t(locale, "Manual entries can only be logged for past time", "Le voci manuali possono essere registrate solo per tempo passato"));
  }

  const supabase = await createClient();
  const { data: openTimer, error: openTimerError } = await supabase
    .from("time_entries")
    .select("id,started_at")
    .eq("worker_id", profile.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<OpenTimeEntryRow>();

  if (openTimerError) {
    throw new Error(openTimerError.message);
  }

  if (openTimer && endDate.toISOString() > openTimer.started_at) {
    throw new Error(
      t(
        locale,
        "This manual entry overlaps with your running timer. Stop the timer first or choose an earlier time range.",
        "Questa voce manuale si sovrappone al timer in esecuzione. Ferma prima il timer o scegli un intervallo precedente.",
      ),
    );
  }

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

export async function updateTimeEntryAction(formData: FormData) {
  const locale = await getLocale();
  const profile = await requireRole(["worker"]);

  const timeEntryId = String(formData.get("timeEntryId") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const startedAt = String(formData.get("startedAt") ?? "").trim();
  const endedAt = String(formData.get("endedAt") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!timeEntryId || !projectId || !startedAt || !endedAt) {
    throw new Error(t(locale, "Time entry id, project, start, and end are required", "ID voce tempo, progetto, inizio e fine sono obbligatori"));
  }

  const startDate = new Date(startedAt);
  const endDate = new Date(endedAt);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
    throw new Error(t(locale, "Invalid date range", "Intervallo date non valido"));
  }

  const now = new Date();
  if (endDate > now) {
    throw new Error(t(locale, "You cannot edit entries from the future", "Non puoi modificare voci in futuro"));
  }

  const supabase = await createClient();

  const { data: existingEntry, error: existingEntryError } = await supabase
    .from("time_entries")
    .select("id,ended_at")
    .eq("id", timeEntryId)
    .eq("worker_id", profile.id)
    .maybeSingle<EditableTimeEntryRow>();

  if (existingEntryError) {
    throw new Error(existingEntryError.message);
  }

  if (!existingEntry) {
    throw new Error(t(locale, "Time entry not found", "Voce tempo non trovata"));
  }

  if (existingEntry.ended_at === null) {
    throw new Error(t(locale, "A running timer cannot be edited", "Un timer in corso non può essere modificato"));
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("project_workers")
    .select("project_id")
    .eq("project_id", projectId)
    .eq("worker_id", profile.id)
    .maybeSingle<ProjectWorkerRow>();

  if (assignmentError) {
    throw new Error(assignmentError.message);
  }

  if (!assignment) {
    throw new Error(t(locale, "Not authorized for this project", "Non autorizzato per questo progetto"));
  }

  const { error } = await supabase
    .from("time_entries")
    .update({
      project_id: projectId,
      started_at: startDate.toISOString(),
      ended_at: endDate.toISOString(),
      description: description || null,
    })
    .eq("id", timeEntryId)
    .eq("worker_id", profile.id);

  if (error) {
    if (error.message.includes("time_entry_overlap")) {
      throw new Error(
        t(
          locale,
          "This time entry overlaps with another existing entry.",
          "Questa voce si sovrappone a un'altra voce esistente.",
        ),
      );
    }

    if (error.message.includes("project_workers_project_id_fkey") || error.message.includes("project_workers_worker_id_fkey")) {
      throw new Error(t(locale, "Not authorized for this project", "Non autorizzato per questo progetto"));
    }

    throw new Error(error.message);
  }

  revalidatePath("/worker");
}

export async function deleteTimeEntryAction(formData: FormData) {
  const locale = await getLocale();
  const profile = await requireRole(["worker"]);

  const timeEntryId = String(formData.get("timeEntryId") ?? "").trim();

  if (!timeEntryId) {
    throw new Error(t(locale, "Time entry id is required", "L'ID della voce tempo è obbligatorio"));
  }

  const supabase = await createClient();

  const { data: existingEntry, error: existingEntryError } = await supabase
    .from("time_entries")
    .select("id,ended_at")
    .eq("id", timeEntryId)
    .eq("worker_id", profile.id)
    .maybeSingle<EditableTimeEntryRow>();

  if (existingEntryError) {
    throw new Error(existingEntryError.message);
  }

  if (!existingEntry) {
    throw new Error(t(locale, "Time entry not found", "Voce tempo non trovata"));
  }

  if (existingEntry.ended_at === null) {
    throw new Error(t(locale, "A running timer cannot be deleted", "Un timer in corso non può essere eliminato"));
  }

  const { error } = await supabase.from("time_entries").delete().eq("id", timeEntryId).eq("worker_id", profile.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/worker");
}
