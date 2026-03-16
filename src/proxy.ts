import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { getDashboardPathFromUnknownRole } from "@/lib/role-routing";

const authRoutes = ["/login", "/signup"];
const adminRoutes = ["/admin"];
const workerRoutes = ["/worker"];
const customerRoutes = ["/customer"];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const { response, user, supabase } = await updateSession(request);

  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/worker") ||
    pathname.startsWith("/customer");

  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;
    if (adminRoutes.some((route) => pathname.startsWith(route)) && role !== "admin") {
      return NextResponse.redirect(new URL(getDashboardPathFromUnknownRole(role), request.url));
    }
    if (workerRoutes.some((route) => pathname.startsWith(route)) && role !== "worker") {
      return NextResponse.redirect(new URL(getDashboardPathFromUnknownRole(role), request.url));
    }
    if (customerRoutes.some((route) => pathname.startsWith(route)) && role !== "customer") {
      return NextResponse.redirect(new URL(getDashboardPathFromUnknownRole(role), request.url));
    }

    if (authRoutes.includes(pathname)) {
      return NextResponse.redirect(new URL(getDashboardPathFromUnknownRole(role), request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
