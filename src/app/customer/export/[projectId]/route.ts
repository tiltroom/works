import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { createClient } from "@/lib/supabase/server";
import { loggedMinutesBetween } from "@/lib/time";

interface ProjectRow {
  id: string;
  name: string;
}

interface TimeEntryRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  description: string | null;
  worker_id: string;
}

interface WorkerProfileRow {
  id: string;
  full_name: string | null;
}

interface ProfileRow {
  id: string;
  role: "admin" | "customer" | "worker";
}

function createSafeFilename(input: string) {
  const trimmed = (input || "project").trim();
  return trimmed
    .replace(/[^a-zA-Z0-9-_\s.]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80) || "project";
}

function formatDateValue(value: string | null) {
  if (!value) {
    return "Running";
  }

  return new Date(value).toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z");
}

function formatDurationMinutes(startedAt: string, endedAt: string | null) {
  if (!endedAt) {
    return "Running";
  }

  const totalMinutes = loggedMinutesBetween(startedAt, endedAt);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return "< 1m";
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const supabase = await createClient();
  const { projectId } = await context.params;

  if (!projectId) {
    return NextResponse.json({ error: "Project id is required" }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single<ProfileRow>();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 401 });
  }

  if (profile.role !== "customer") {
    return NextResponse.json({ error: "Only customers can export project activity logs" }, { status: 403 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,name")
    .eq("id", projectId)
    .eq("customer_id", profile.id)
    .single<ProjectRow>();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found or not accessible" }, { status: 404 });
  }

  const { data: timeEntries, error: timeEntriesError } = await supabase
    .from("time_entries")
    .select("id,started_at,ended_at,description,worker_id")
    .eq("project_id", project.id)
    .order("started_at", { ascending: false });

  if (timeEntriesError) {
    return NextResponse.json({ error: timeEntriesError.message }, { status: 500 });
  }

  const workerIds = [...new Set((timeEntries ?? []).map((entry) => entry.worker_id).filter(Boolean))];
  const { data: workerProfiles } = workerIds.length
    ? await supabase.from("profiles").select("id,full_name").in("id", workerIds)
    : { data: [] as WorkerProfileRow[] };

  const workerNameById = new Map(
    ((workerProfiles ?? []) as WorkerProfileRow[]).map((worker) => [worker.id, worker.full_name?.trim() || "(Unknown)"]),
  );

  const rows: Array<[string, string, string, string, string]> = [
    ["Worker", "Started", "Ended", "Duration", "Description"],
  ];

  ((timeEntries ?? []) as TimeEntryRow[]).forEach((entry) => {
    rows.push([
      workerNameById.get(entry.worker_id) || "(Unknown)",
      formatDateValue(entry.started_at),
      formatDateValue(entry.ended_at),
      formatDurationMinutes(entry.started_at, entry.ended_at),
      entry.description ?? "",
    ]);
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  worksheet["!cols"] = [
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
    { wch: 14 },
    { wch: 70 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Activity Log");

  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  });

  const safeProjectName = createSafeFilename(project.name);
  const startedSuffix = new Date().toISOString().replace(/:/g, "-").slice(0, 19);
  const filename = `${safeProjectName}-activity-${startedSuffix}.xlsx`;

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
