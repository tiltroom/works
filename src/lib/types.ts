export type AppRole = "admin" | "customer" | "worker";

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
  stripe_checkout_session_id: string;
  amount_cents: number;
  currency: string;
  created_at: string;
}
