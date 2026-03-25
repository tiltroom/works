"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/types";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

const allowedRoles: AppRole[] = ["admin", "customer", "worker"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function inviteUserAction(formData: FormData) {
  const locale = await getLocale();
  const adminProfile = await requireRole(["admin"]);

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const role = String(formData.get("role") ?? "worker").trim() as AppRole;

  if (!email || !allowedRoles.includes(role)) {
    throw new Error(t(locale, "Invalid invitation payload", "Payload invito non valido"));
  }

  const supabase = await createClient();
  const { error } = await supabase.from("invitations").upsert(
    {
      email,
      role,
      full_name: fullName || null,
      invited_by: adminProfile.id,
    },
    { onConflict: "email" },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin");
}

export async function deleteInvitationAction(formData: FormData) {
  const locale = await getLocale();
  await requireRole(["admin"]);

  const invitationId = String(formData.get("invitationId") ?? "").trim();
  if (!invitationId || !uuidPattern.test(invitationId)) {
    throw new Error(t(locale, "Invalid invitation payload", "Payload invito non valido"));
  }

  const admin = createAdminClient();
  const { data: invitation, error: invitationError } = await admin
    .from("invitations")
    .select("id,email")
    .eq("id", invitationId)
    .maybeSingle();

  if (invitationError) {
    throw new Error(invitationError.message);
  }

  if (!invitation) {
    throw new Error(t(locale, "Invitation not found", "Invito non trovato"));
  }

  const invitationEmail = invitation.email.trim().toLowerCase();
  const { error: deleteInvitationsError } = await admin
    .from("invitations")
    .delete()
    .ilike("email", invitationEmail);

  if (deleteInvitationsError) {
    throw new Error(deleteInvitationsError.message);
  }

  const { data: authUsers, error: authUsersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (authUsersError) {
    throw new Error(authUsersError.message);
  }

  const matchingAuthUser = authUsers.users.find((authUser) => (authUser.email ?? "").toLowerCase() === invitationEmail);
  if (!matchingAuthUser) {
    revalidatePath("/admin");
    return;
  }

  const profileId = matchingAuthUser.id;
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,role")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (profile?.role === "worker") {
    const [{ error: timeEntriesError }, { error: projectWorkersError }] = await Promise.all([
      admin.from("time_entries").delete().eq("worker_id", profile.id),
      admin.from("project_workers").delete().eq("worker_id", profile.id),
    ]);

    if (timeEntriesError) {
      throw new Error(timeEntriesError.message);
    }

    if (projectWorkersError) {
      throw new Error(projectWorkersError.message);
    }
  }

  if (profile?.role === "customer") {
    const { error: hourPurchasesError } = await admin
      .from("hour_purchases")
      .delete()
      .eq("customer_id", profile.id);

    if (hourPurchasesError) {
      throw new Error(hourPurchasesError.message);
    }

    const { error: projectsError } = await admin
      .from("projects")
      .delete()
      .eq("customer_id", profile.id);

    if (projectsError) {
      throw new Error(projectsError.message);
    }
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(profileId);
  if (deleteUserError) {
    throw new Error(deleteUserError.message);
  }

  revalidatePath("/admin");
}
