"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types";
import { getLocale, t } from "@/lib/i18n";

const allowedRoles: AppRole[] = ["admin", "customer", "worker"];

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
