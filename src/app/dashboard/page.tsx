import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getDashboardPathForRole } from "@/lib/role-routing";

export const dynamic = "force-dynamic";

export default async function DashboardLandingPage() {
  const profile = await requireProfile();
  redirect(getDashboardPathForRole(profile.role));
}
