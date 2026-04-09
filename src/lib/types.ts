export type AppRole = "admin" | "customer" | "worker";

export type BillingMode = "prepaid" | "postpaid";

export interface Profile {
  id: string;
  full_name: string | null;
  role: AppRole;
  custom_hourly_rate_cents?: number | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  customer_id: string;
  assigned_hours: number;
  billing_mode: BillingMode;
  created_at: string;
}

export interface ProjectWorker {
  project_id: string;
  worker_id: string;
}

export interface TimeEntry {
  id: string;
  project_id: string;
  worker_id: string;
  started_at: string;
  ended_at: string | null;
  description: string | null;
  source: "timer" | "manual";
}

export interface HourPurchase {
  id: string;
  project_id: string;
  customer_id: string;
  hours_added: number;
  stripe_checkout_session_id: string | null;
  amount_cents: number | null;
  currency: string | null;
  payment_method: "stripe" | "manual";
  admin_comment: string | null;
  created_at: string;
}

export type QuoteStatus = "draft" | "signed" | "converted";

export interface Quote {
  id: string;
  customer_id: string;
  title: string;
  description: string | null;
  content_html: string | null;
  content_json: Record<string, unknown> | null;
  status: QuoteStatus;
  billing_mode: BillingMode;
  total_estimated_hours: number;
  total_logged_hours: number;
  signed_by_name: string | null;
  signed_at: string | null;
  signed_by_user_id: string | null;
  linked_project_id: string | null;
  converted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteWorker {
  quote_id: string;
  worker_id: string;
  assigned_at: string;
  assigned_by: string | null;
}

export interface QuoteSubtask {
  id: string;
  quote_id: string;
  title: string;
  description: string | null;
  estimated_hours: number;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteSubtaskEntry {
  id: string;
  quote_subtask_id: string;
  worker_id: string | null;
  logged_hours: number;
  note: string | null;
  created_at: string;
}

export interface QuoteComment {
  id: string;
  quote_id: string;
  author_id: string | null;
  author_role: AppRole;
  comment_html: string | null;
  comment_json: Record<string, unknown> | null;
  created_at: string;
}

export interface QuotePrepaymentSession {
  id: string;
  quote_id: string;
  customer_id: string;
  stripe_checkout_session_id: string;
  estimated_hours_snapshot: number;
  amount_cents: number;
  currency: string;
  status: "pending" | "paid";
  stripe_event_id: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface ProjectDebtLedgerEntry {
  id: string;
  project_id: string;
  event_type: "time_entry_accrual" | "time_entry_reversal" | "payment_settlement";
  hours: number;
  source_id: string | null;
  source_type: "time_entry" | "stripe_event" | "manual_adjustment" | null;
  source_event_id: string | null;
  description: string | null;
  created_at: string;
}

export interface ProjectBillingBalance {
  project_id: string;
  billing_mode: BillingMode;
  prepaid_hours: number;
  used_hours: number;
  remaining_prepaid_hours: number;
  outstanding_debt_hours: number;
}
