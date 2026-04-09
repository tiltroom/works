import type { BillingMode, ProjectBillingBalance } from "./types";

export function isPostPaid(billingMode: BillingMode): boolean {
  return billingMode === "postpaid";
}

export function formatBillingMode(mode: BillingMode): string {
  return mode === "postpaid" ? "Post-paid" : "Prepaid";
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

export function parseProjectBillingBalance(row: Record<string, unknown>): ProjectBillingBalance {
  return {
    project_id: asString(row.project_id),
    billing_mode: row.billing_mode === "postpaid" ? "postpaid" : "prepaid",
    prepaid_hours: asNumber(row.prepaid_hours),
    used_hours: asNumber(row.used_hours),
    remaining_prepaid_hours: asNumber(row.remaining_prepaid_hours),
    outstanding_debt_hours: asNumber(row.outstanding_debt_hours),
  };
}

export function formatHours(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(hours)) {
    return "\u2014";
  }
  return `${Number(hours).toFixed(2)}h`;
}
