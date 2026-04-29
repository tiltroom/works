"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { loggedHoursBetween } from "@/lib/time";
import { OVER_ESTIMATE_ERROR_PREFIX } from "@/lib/time-entry-warnings";
import { createAdminClient } from "@/lib/supabase/admin";

interface OpenTimeEntryRow {
  id: string;
  started_at: string;
}

interface RunningTimeEntryRow extends OpenTimeEntryRow {
  project_id: string;
  description: string | null;
  quote_subtask_id: string | null;
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

interface QuoteSubtaskProjectContextRow {
  id: string;
  title: string;
  estimated_hours: number | string | null;
  quote_id: string;
}

interface QuoteLinkedProjectRow {
  id: string;
  linked_project_id: string | null;
}

interface QuoteSubtaskLoggedHoursRow {
  id: string;
  started_at: string;
  ended_at: string | null;
}

interface ProjectAssignmentRow {
  project_id: string;
}

function parseBooleanField(value: FormDataEntryValue | null) {
  return value === "1" || value === "true" || value === "on" || value === "yes";
}

function parseNumericHours(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

function createOverEstimateError(locale: "en" | "it", payload: {
  subtaskTitle: string;
  estimatedHours: number;
  loggedHours: number;
  addedHours: number;
  projectedHours: number;
}) {
  const overByHours = Math.max(payload.projectedHours - payload.estimatedHours, 0);
  const message = t(
    locale,
    "This entry exceeds the subtask estimate. You can still register it if you confirm.",
    "Questa voce supera la stima della sottoattività. Puoi comunque registrarla se confermi.",
  );

  return new Error(`${OVER_ESTIMATE_ERROR_PREFIX}${JSON.stringify({
    message,
    subtaskTitle: payload.subtaskTitle,
    estimatedHours: roundHours(payload.estimatedHours),
    loggedHours: roundHours(payload.loggedHours),
    addedHours: roundHours(payload.addedHours),
    projectedHours: roundHours(payload.projectedHours),
    overByHours: roundHours(overByHours),
  })}`);
}

async function getQuoteSubtaskProjectContext(supabase: Awaited<ReturnType<typeof createClient>>, quoteSubtaskId: string, projectId: string) {
  const { data: subtask, error: subtaskError } = await supabase
    .from("quote_subtasks")
    .select("id,title,estimated_hours,quote_id,quote_subtask_entries(id)")
    .eq("id", quoteSubtaskId)
    .maybeSingle<QuoteSubtaskProjectContextRow>();

  if (subtaskError) {
    throw new Error(subtaskError.message);
  }

  if (!subtask) {
    return null;
  }

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id,linked_project_id")
    .eq("id", subtask.quote_id)
    .eq("linked_project_id", projectId)
    .maybeSingle<QuoteLinkedProjectRow>();

  if (quoteError) {
    throw new Error(quoteError.message);
  }

  if (!quote) {
    return null;
  }

  return subtask;
}

async function assertQuoteSubtaskProjectContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  locale: "en" | "it",
  quoteSubtaskId: string,
  projectId: string,
) {
  const subtask = await getQuoteSubtaskProjectContext(supabase, quoteSubtaskId, projectId);

  if (!subtask) {
    throw new Error(t(locale, "Subtask not found for this project", "Sottoattività non trovata per questo progetto"));
  }

  return subtask;
}

async function getLoggedHoursForQuoteSubtask(quoteSubtaskId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("time_entries")
    .select("id,started_at,ended_at")
    .eq("quote_subtask_id", quoteSubtaskId)
    .not("ended_at", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as QuoteSubtaskLoggedHoursRow[]).reduce((total, entry) => {
    if (!entry.ended_at) {
      return total;
    }

    return total + loggedHoursBetween(entry.started_at, entry.ended_at);
  }, 0);
}

async function getLoggedHoursForQuoteSubtaskFromEntries(supabase: Awaited<ReturnType<typeof createClient>>, quoteSubtaskId: string) {
  const { data, error } = await supabase
    .from("quote_subtask_entries")
    .select("logged_hours")
    .eq("quote_subtask_id", quoteSubtaskId);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{ logged_hours: number | string | null }>).reduce((total, entry) => total + parseNumericHours(entry.logged_hours), 0);
}

async function assertWithinEstimateOrConfirmed({
  supabase,
  locale,
  quoteSubtaskId,
  projectId,
  addedHours,
  confirmed,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  locale: "en" | "it";
  quoteSubtaskId: string;
  projectId: string;
  addedHours: number;
  confirmed: boolean;
}) {
  const subtask = await assertQuoteSubtaskProjectContext(supabase, locale, quoteSubtaskId, projectId);
  const estimatedHours = parseNumericHours(subtask.estimated_hours);

  if (estimatedHours <= 0) {
    return subtask;
  }

  let loggedHours: number;
  try {
    loggedHours = await getLoggedHoursForQuoteSubtask(quoteSubtaskId);
  } catch {
    loggedHours = await getLoggedHoursForQuoteSubtaskFromEntries(supabase, quoteSubtaskId);
  }
  const projectedHours = loggedHours + addedHours;

  if (projectedHours > estimatedHours && !confirmed) {
    throw createOverEstimateError(locale, {
      subtaskTitle: subtask.title,
      estimatedHours,
      loggedHours,
      addedHours,
      projectedHours,
    });
  }

  return subtask;
}

function buildSubtaskTimeEntryDescription(title: string, note: string) {
  return [
    `Quote subtask: ${title}`,
    note,
  ].map((part) => part.trim()).filter(Boolean).join("\n\n");
}

async function assertWorkerAssignedToProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  locale: "en" | "it",
  projectId: string,
  workerId: string,
) {
  const { data, error } = await supabase
    .from("project_workers")
    .select("project_id")
    .eq("project_id", projectId)
    .eq("worker_id", workerId)
    .maybeSingle<ProjectAssignmentRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(t(locale, "Not authorized for this project", "Non autorizzato per questo progetto"));
  }
}

export async function startTimerAction(formData: FormData) {
  const locale = await getLocale();
  const profile = await requireRole(["worker", "admin"]);

  const projectId = String(formData.get("projectId") ?? "").trim();
  const quoteSubtaskId = String(formData.get("quoteSubtaskId") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!projectId) {
    throw new Error(t(locale, "Project is required", "Il progetto è obbligatorio"));
  }

  const supabase = await createClient();
  if (profile.role === "worker") {
    await assertWorkerAssignedToProject(supabase, locale, projectId, profile.id);
  }

  const quoteSubtask = quoteSubtaskId
    ? await assertQuoteSubtaskProjectContext(supabase, locale, quoteSubtaskId, projectId)
    : null;

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
    description: quoteSubtask ? buildSubtaskTimeEntryDescription(quoteSubtask.title, description) : description || null,
    source: "timer",
    quote_subtask_id: quoteSubtask?.id ?? null,
  });

  if (error) {
    if (error.message.includes("idx_time_entries_single_open_timer")) {
      throw new Error(t(locale, "A timer is already running", "Un timer è già in esecuzione"));
    }
    throw new Error(error.message);
  }

  revalidatePath("/worker");
  revalidatePath(`/worker/projects/${projectId}`);
}

export async function stopTimerAction(formData: FormData) {
  const locale = await getLocale();
  const profile = await requireRole(["worker", "admin"]);
  const timeEntryId = String(formData.get("timeEntryId") ?? "").trim();
  const confirmedOverEstimate = parseBooleanField(formData.get("confirmOverEstimate"));

  if (!timeEntryId) {
    throw new Error(t(locale, "Time entry id is required", "L'ID della voce tempo è obbligatorio"));
  }

  const supabase = await createClient();
  const { data: runningEntry, error: runningEntryError } = await supabase
    .from("time_entries")
    .select("id,project_id,started_at,description,quote_subtask_id")
    .eq("id", timeEntryId)
    .eq("worker_id", profile.id)
    .is("ended_at", null)
    .maybeSingle<RunningTimeEntryRow>();

  if (runningEntryError) {
    throw new Error(runningEntryError.message);
  }

  if (!runningEntry) {
    throw new Error(t(locale, "The running timer could not be found", "Il timer in esecuzione non è stato trovato"));
  }

  const stoppedAt = new Date().toISOString();
  if (runningEntry.quote_subtask_id) {
    await assertWithinEstimateOrConfirmed({
      supabase,
      locale,
      quoteSubtaskId: runningEntry.quote_subtask_id,
      projectId: runningEntry.project_id,
      addedHours: loggedHoursBetween(runningEntry.started_at, stoppedAt),
      confirmed: confirmedOverEstimate,
    });
  }

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
          revalidatePath(`/worker/projects/${runningEntry.project_id}`);
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
  revalidatePath(`/worker/projects/${runningEntry.project_id}`);
}

export async function createManualTimeEntryAction(formData: FormData) {
  const locale = await getLocale();
  const profile = await requireRole(["worker", "admin"]);

  const projectId = String(formData.get("projectId") ?? "").trim();
  const quoteSubtaskId = String(formData.get("quoteSubtaskId") ?? "").trim();
  const startedAt = String(formData.get("startedAt") ?? "").trim();
  const endedAt = String(formData.get("endedAt") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const confirmedOverEstimate = parseBooleanField(formData.get("confirmOverEstimate"));

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
  if (profile.role === "worker") {
    await assertWorkerAssignedToProject(supabase, locale, projectId, profile.id);
  }

  const quoteSubtask = quoteSubtaskId
    ? await assertWithinEstimateOrConfirmed({
        supabase,
        locale,
        quoteSubtaskId,
        projectId,
        addedHours: loggedHoursBetween(startDate.toISOString(), endDate.toISOString()),
        confirmed: confirmedOverEstimate,
      })
    : null;

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
    description: quoteSubtask ? buildSubtaskTimeEntryDescription(quoteSubtask.title, description) : description || null,
    source: "manual",
    quote_subtask_id: quoteSubtask?.id ?? null,
  });

  if (error) {
    if (error.message.includes("time_entry_overlap")) {
      throw new Error(t(locale, "This manual entry overlaps with another existing entry", "Questa voce manuale si sovrappone a un'altra voce esistente"));
    }
    throw new Error(error.message);
  }

  revalidatePath("/worker");
  revalidatePath(`/worker/projects/${projectId}`);
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
