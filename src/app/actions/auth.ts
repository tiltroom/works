"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getLocale, t } from "@/lib/i18n";

export async function sendMagicLinkAction(formData: FormData) {
  const locale = await getLocale();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    redirect(`/login?error=${encodeURIComponent(t(locale, "Email is required", "L'email è obbligatoria"))}`);
  }

  const admin = createAdminClient();
  const { data: invitation, error: invitationError } = await admin
    .from("invitations")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (invitationError) {
    redirect(`/login?error=${encodeURIComponent(invitationError.message)}`);
  }

  if (!invitation) {
    redirect(`/login?error=${encodeURIComponent(t(locale, "This email is not invited", "Questa email non è stata invitata"))}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${env.appUrl}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?sent=1");
}

export async function logoutAction() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }

  redirect("/login");
}
