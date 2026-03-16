"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export async function sendMagicLinkAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    redirect("/login?error=Email%20is%20required");
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
    redirect("/login?error=This%20email%20is%20not%20invited");
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
