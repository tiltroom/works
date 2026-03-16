import { redirect } from "next/navigation";
import type { AppRole } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPathForRole } from "@/lib/role-routing";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,full_name,role")
    .eq("id", user.id)
    .single();

  return profile;
}

export async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  return profile;
}

export async function requireRole(roles: AppRole[]) {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) {
    redirect(getDashboardPathForRole(profile.role));
  }
  return profile;
}
