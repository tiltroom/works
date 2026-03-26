"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { getStripeClient } from "@/lib/stripe";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export async function createCheckoutForHoursAction(formData: FormData) {
  const locale = await getLocale();
  const profile = await requireRole(["customer"]);
  const user = await getCurrentUser();

  const projectId = String(formData.get("projectId") ?? "").trim();
  const hoursToBuy = Number(formData.get("hoursToBuy") ?? "0");

  if (!projectId || Number.isNaN(hoursToBuy) || hoursToBuy <= 0) {
    throw new Error(t(locale, "Invalid checkout payload", "Payload checkout non valido"));
  }

  const supabase = await createClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,name,customer_id")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    throw new Error(projectError?.message ?? t(locale, "Project not found", "Progetto non trovato"));
  }

  if (project.customer_id !== profile.id) {
    throw new Error(t(locale, "Not authorized for this project", "Non autorizzato per questo progetto"));
  }

  const { data: customerProfile, error: customerProfileError } = await supabase
    .from("profiles")
    .select("custom_hourly_rate_cents")
    .eq("id", profile.id)
    .single();

  const missingCustomerRateColumn = customerProfileError?.code === "PGRST204"
    || customerProfileError?.code === "42703"
    || customerProfileError?.message.includes("custom_hourly_rate_cents")
    || false;

  if ((customerProfileError && !missingCustomerRateColumn) || (!customerProfile && !missingCustomerRateColumn)) {
    throw new Error(customerProfileError?.message ?? t(locale, "Customer profile not found", "Profilo cliente non trovato"));
  }

  const stripe = getStripeClient();
  const unitAmount = customerProfile?.custom_hourly_rate_cents ?? env.stripePricePerHourCents;

  if (!Number.isInteger(unitAmount) || unitAmount <= 0) {
    throw new Error(t(locale, "Invalid hourly rate configuration", "Configurazione tariffa oraria non valida"));
  }

  const totalCents = unitAmount * hoursToBuy;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user?.email ?? undefined,
    billing_address_collection: "required",
    tax_id_collection: {
      enabled: true,
      required: "if_supported",
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: env.stripeCurrency,
          product_data: {
            name: `${hoursToBuy} additional project hour${hoursToBuy > 1 ? "s" : ""}`,
            description: t(locale, `Top-up for project ${project.name}`, `Ricarica per il progetto ${project.name}`),
          },
          unit_amount: totalCents,
        },
      },
    ],
    success_url: `${env.appUrl}/customer?billing=success`,
    cancel_url: `${env.appUrl}/customer?billing=cancelled`,
    metadata: {
      projectId: project.id,
      customerId: profile.id,
      hoursToBuy: String(hoursToBuy),
      unitAmountCents: String(unitAmount),
      amountCents: String(totalCents),
      currency: env.stripeCurrency,
    },
  });

  if (!session.url) {
    throw new Error(t(locale, "Missing checkout url", "URL checkout mancante"));
  }

  redirect(session.url);
}
