"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { getStripeClient } from "@/lib/stripe";

export async function createCheckoutForHoursAction(formData: FormData) {
  const profile = await requireRole(["customer"]);

  const projectId = String(formData.get("projectId") ?? "").trim();
  const hoursToBuy = Number(formData.get("hoursToBuy") ?? "0");

  if (!projectId || Number.isNaN(hoursToBuy) || hoursToBuy <= 0) {
    throw new Error("Invalid checkout payload");
  }

  const supabase = await createClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,name,customer_id")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    throw new Error(projectError?.message ?? "Project not found");
  }

  if (project.customer_id !== profile.id) {
    throw new Error("Not authorized for this project");
  }

  const { data: customerProfile, error: customerProfileError } = await supabase
    .from("profiles")
    .select("custom_hourly_rate_cents")
    .eq("id", profile.id)
    .single();

  if (customerProfileError || !customerProfile) {
    throw new Error(customerProfileError?.message ?? "Customer profile not found");
  }

  const stripe = getStripeClient();
  const unitAmount = customerProfile.custom_hourly_rate_cents ?? env.stripePricePerHourCents;

  if (!Number.isInteger(unitAmount) || unitAmount <= 0) {
    throw new Error("Invalid hourly rate configuration");
  }

  const totalCents = unitAmount * hoursToBuy;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: env.stripeCurrency,
          product_data: {
            name: `${hoursToBuy} additional project hour${hoursToBuy > 1 ? "s" : ""}`,
            description: `Top-up for project ${project.name}`,
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
    throw new Error("Missing checkout url");
  }

  redirect(session.url);
}
