import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getStripeClient } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!env.stripeWebhookSecret) {
    return NextResponse.json({ error: "Missing webhook secret" }, { status: 500 });
  }

  const stripe = getStripeClient();
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.stripeWebhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const metadata = session.metadata ?? {};

    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }

    const projectId = metadata.projectId;
    const customerId = metadata.customerId;
    const hoursToBuy = Number(metadata.hoursToBuy ?? "0");
    const unitAmountCents = Number(metadata.unitAmountCents ?? "0");
    const amountCents = Number(metadata.amountCents ?? "0");
    const currency = metadata.currency ?? env.stripeCurrency;

    if (
      Number.isNaN(hoursToBuy) ||
      Number.isNaN(unitAmountCents) ||
      Number.isNaN(amountCents) ||
      unitAmountCents <= 0 ||
      amountCents <= 0 ||
      unitAmountCents * hoursToBuy !== amountCents ||
      session.amount_total !== amountCents ||
      (session.currency ?? "").toLowerCase() !== currency.toLowerCase()
    ) {
      return NextResponse.json({ error: "Invalid checkout metadata" }, { status: 400 });
    }

    if (projectId && customerId && hoursToBuy > 0) {
      const admin = createAdminClient();
      const { error } = await admin.rpc("apply_hour_purchase", {
        p_event_id: event.id,
        p_project_id: projectId,
        p_customer_id: customerId,
        p_hours_added: hoursToBuy,
        p_checkout_session_id: session.id,
        p_amount_cents: amountCents,
        p_currency: currency,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
