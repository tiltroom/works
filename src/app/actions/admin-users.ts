"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function updateCustomerHourlyRateAction(formData: FormData) {
  const locale = await getLocale();
  await requireRole(["admin"]);

  const customerId = String(formData.get("customerId") ?? "").trim();
  const hourlyRateInput = String(formData.get("customHourlyRate") ?? "").trim();

  if (!customerId) {
    throw new Error(t(locale, "Invalid customer payload", "Payload cliente non valido"));
  }

  let customHourlyRateCents: number | null = null;
  if (hourlyRateInput) {
    const hourlyRate = Number(hourlyRateInput);
    if (Number.isNaN(hourlyRate) || hourlyRate <= 0) {
      throw new Error(t(locale, "Hourly rate must be a positive number", "La tariffa oraria deve essere un numero positivo"));
    }
    customHourlyRateCents = Math.round(hourlyRate * 100);

    if (customHourlyRateCents <= 0) {
      throw new Error(t(locale, "Hourly rate must be at least $0.01", "La tariffa oraria deve essere almeno $0.01"));
    }
  }

  const admin = createAdminClient();
  const { data: customer, error: customerError } = await admin
    .from("profiles")
    .select("id,role")
    .eq("id", customerId)
    .single();

  if (customerError || !customer || customer.role !== "customer") {
    throw new Error(t(locale, "Customer not found", "Cliente non trovato"));
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ custom_hourly_rate_cents: customHourlyRateCents })
    .eq("id", customerId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath("/admin");
}

export async function deletePlatformUserAction(formData: FormData) {
  const locale = await getLocale();
  const currentAdmin = await requireRole(["admin"]);

  const userId = String(formData.get("userId") ?? "").trim();

  if (!userId || !uuidPattern.test(userId)) {
    throw new Error(t(locale, "Invalid user payload", "Payload utente non valido"));
  }

  if (userId === currentAdmin.id) {
    throw new Error(t(locale, "You cannot delete your own account", "Non puoi eliminare il tuo account"));
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile) {
    throw new Error(t(locale, "User not found", "Utente non trovato"));
  }

  if (profile.role === "admin") {
    const { count: adminCount, error: adminCountError } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    if (adminCountError) {
      throw new Error(adminCountError.message);
    }

    if ((adminCount ?? 0) <= 1) {
      throw new Error(t(locale, "You cannot delete the last admin", "Non puoi eliminare l'ultimo amministratore"));
    }

    const { error: deleteInvitedUsersError } = await admin
      .from("invitations")
      .delete()
      .eq("invited_by", profile.id);

    if (deleteInvitedUsersError) {
      throw new Error(deleteInvitedUsersError.message);
    }
  }

  if (profile.role === "worker") {
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

  if (profile.role === "customer") {
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

  const { data: authUserData, error: authUserError } = await admin.auth.admin.getUserById(profile.id);

  if (authUserError) {
    throw new Error(authUserError.message);
  }

  const userEmail = authUserData.user.email?.trim().toLowerCase();

  if (userEmail) {
    const { error: deleteUserInvitationsError } = await admin
      .from("invitations")
      .delete()
      .ilike("email", userEmail);

    if (deleteUserInvitationsError) {
      throw new Error(deleteUserInvitationsError.message);
    }
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(profile.id);

  if (deleteUserError) {
    throw new Error(deleteUserError.message);
  }

  revalidatePath("/admin");
}
