"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export async function setLocaleAction(formData: FormData) {
  const requestedLocale = String(formData.get("locale") ?? "");
  const redirectToRaw = String(formData.get("redirectTo") ?? "/");
  const locale = isLocale(requestedLocale) ? requestedLocale : DEFAULT_LOCALE;
  const redirectTo = redirectToRaw.startsWith("/") ? redirectToRaw : "/";

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase
      .from("profiles")
      .update({ locale })
      .eq("id", user.id);
  }

  redirect(redirectTo);
}
