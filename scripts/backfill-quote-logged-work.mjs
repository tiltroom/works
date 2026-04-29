#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}

function usage() {
  return [
    "Usage: node scripts/backfill-quote-logged-work.mjs <quote-id> [--dry-run] [--project-id <project-id>] [--allow-signed] [--apply-migration]",
    "",
    "Options:",
    "  --dry-run          Show what would happen without writing rows.",
    "  --project-id ID    Use this project when the quote is detached or not converted.",
    "  --allow-signed     Allow backfill for a signed quote when --project-id is provided.",
    "  --apply-migration  Apply supabase/2026-04-18-copy-quote-subtask-entries-to-project.sql first.",
  ].join("\n");
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const allowSigned = args.includes("--allow-signed");
const applyMigration = args.includes("--apply-migration");
const quoteId = args.find((arg) => !arg.startsWith("--"));
const projectIdArgIndex = args.indexOf("--project-id");
const explicitProjectId = projectIdArgIndex === -1 ? null : args[projectIdArgIndex + 1];

if (!quoteId) {
  console.error(usage());
  process.exit(1);
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function rpc(sql) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ sql }),
  });

  if (!response.ok) {
    return {
      error: new Error(`exec_sql RPC failed with HTTP ${response.status}: ${await response.text()}`),
    };
  }

  return { error: null };
}

async function applyMigrationSqlIfRequested() {
  if (!applyMigration) {
    return;
  }

  const migrationPath = resolve(process.cwd(), "supabase", "2026-04-18-copy-quote-subtask-entries-to-project.sql");
  const migrationSql = readFileSync(migrationPath, "utf8");

  console.log(`Applying migration: ${migrationPath}`);
  const { error } = await rpc(migrationSql);
  if (error) {
    fail(
      "Failed to apply migration through exec_sql. Apply supabase/2026-04-18-copy-quote-subtask-entries-to-project.sql manually, then rerun this script.",
      error,
    );
  }
  console.log("Migration applied.");
}

function fail(message, error) {
  console.error(message);
  if (error) {
    console.error(error.message ?? error);
  }
  process.exit(1);
}

function formatDescription(subtaskTitle, note) {
  const normalizedNote = (note ?? "").trim();
  return normalizedNote ? `Quote subtask: ${subtaskTitle}\n\n${normalizedNote}` : `Quote subtask: ${subtaskTitle}`;
}

function startFromLoggedHours(createdAt, loggedHours) {
  return new Date(new Date(createdAt).getTime() - Number(loggedHours) * 60 * 60 * 1000).toISOString();
}

await applyMigrationSqlIfRequested();

const { data: quote, error: quoteError } = await supabase
  .from("quotes")
  .select("id,status,linked_project_id,customer_id,title")
  .eq("id", quoteId)
  .single();

if (quoteError || !quote) {
  fail(`Quote ${quoteId} was not found.`, quoteError);
}

if (quote.status !== "converted" && !(allowSigned && quote.status === "signed" && explicitProjectId)) {
  fail(`Quote ${quoteId} is ${quote.status}; only converted quotes can be backfilled unless --allow-signed and --project-id are provided.`);
}

const targetProjectId = quote.linked_project_id ?? explicitProjectId;

if (!targetProjectId) {
  fail(`Quote ${quoteId} has no linked_project_id. Provide --project-id if you need to backfill a detached project.`);
}

const { data: project, error: projectError } = await supabase
  .from("projects")
  .select("id,customer_id,name")
  .eq("id", targetProjectId)
  .single();

if (projectError || !project) {
  fail(`Target project ${targetProjectId} was not found.`, projectError);
}

if (project.customer_id !== quote.customer_id) {
  fail(`Linked project ${project.id} does not belong to quote customer ${quote.customer_id}.`);
}

const { data: subtasks, error: subtasksError } = await supabase
  .from("quote_subtasks")
  .select("id,title,quote_subtask_entries(id,worker_id,logged_hours,note,created_at)")
  .eq("quote_id", quoteId);

if (subtasksError) {
  fail("Failed to read quote logged subtask work.", subtasksError);
}

const entries = (subtasks ?? []).flatMap((subtask) => (
  (subtask.quote_subtask_entries ?? []).map((entry) => ({
    ...entry,
    subtaskTitle: subtask.title,
  }))
));

const entriesWithWorker = entries.filter((entry) => entry.worker_id);
const skippedMissingWorker = entries.length - entriesWithWorker.length;

console.log(`Quote: ${quote.id} (${quote.title})`);
console.log(`Linked project: ${project.id} (${project.name})`);
console.log(`Logged subtask entries found: ${entries.length}`);
console.log(`Eligible entries with worker: ${entriesWithWorker.length}`);
if (skippedMissingWorker > 0) {
  console.log(`Skipped entries without worker: ${skippedMissingWorker}`);
}

if (entriesWithWorker.length === 0) {
  console.log("Nothing to backfill.");
  process.exit(0);
}

const sourceIds = entriesWithWorker.map((entry) => entry.id);
const { data: existingRows, error: existingError } = await supabase
  .from("time_entries")
  .select("id,project_id,quote_subtask_entry_id")
  .in("quote_subtask_entry_id", sourceIds);

if (existingError?.message?.includes("quote_subtask_entry_id")) {
  fail(
    "The live database is missing time_entries.quote_subtask_entry_id. Run this script with --apply-migration, or apply supabase/2026-04-18-copy-quote-subtask-entries-to-project.sql manually first.",
    existingError,
  );
}

if (existingError) {
  fail("Failed to read existing generated time entries.", existingError);
}

const existingBySourceId = new Map((existingRows ?? []).map((row) => [row.quote_subtask_entry_id, row]));
const rows = entriesWithWorker.map((entry) => ({
  project_id: project.id,
  worker_id: entry.worker_id,
  started_at: startFromLoggedHours(entry.created_at, entry.logged_hours),
  ended_at: entry.created_at,
  description: formatDescription(entry.subtaskTitle, entry.note),
  source: "manual",
  quote_subtask_entry_id: entry.id,
}));

const rowsToInsert = rows.filter((row) => !existingBySourceId.has(row.quote_subtask_entry_id)).length;
const rowsToUpdate = rows.length - rowsToInsert;

console.log(`Rows to insert: ${rowsToInsert}`);
console.log(`Rows to update/refresh: ${rowsToUpdate}`);

if (dryRun) {
  console.log("Dry run only; no rows were written.");
  process.exit(0);
}

const { error: upsertError } = await supabase
  .from("time_entries")
  .upsert(rows, {
    onConflict: "quote_subtask_entry_id",
  });

if (upsertError) {
  fail("Failed to upsert generated time entries. Make sure the quote logged-work migration has been applied.", upsertError);
}

const { count: generatedCount, error: countError } = await supabase
  .from("time_entries")
  .select("id", { count: "exact", head: true })
  .eq("project_id", project.id)
  .in("quote_subtask_entry_id", sourceIds);

if (countError) {
  fail("Backfill succeeded, but verification failed.", countError);
}

console.log(`Backfill complete. Generated project time entries for this quote: ${generatedCount ?? 0}`);
