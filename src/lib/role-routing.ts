import type { AppRole } from "@/lib/types";

const ROLE_DASHBOARD_MAP: Record<AppRole, string> = {
  admin: "/admin",
  customer: "/customer",
  worker: "/worker",
};

export function getDashboardPathForRole(role: AppRole) {
  return ROLE_DASHBOARD_MAP[role];
}

export function getDashboardPathFromUnknownRole(role: string | null | undefined) {
  if (role === "admin" || role === "customer" || role === "worker") {
    return getDashboardPathForRole(role);
  }

  return getDashboardPathForRole("customer");
}
