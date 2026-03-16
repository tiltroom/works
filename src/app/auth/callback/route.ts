import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPathFromUnknownRole } from "@/lib/role-routing";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const supabase = await createClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return NextResponse.redirect(
    new URL(getDashboardPathFromUnknownRole(profile?.role), requestUrl.origin),
  );
}
