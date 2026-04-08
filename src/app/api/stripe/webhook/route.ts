import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getStripeClient } from "@/lib/stripe";

export const dynamic = "force-dynamic";

function logStripeWebhook(level: "info" | "error", message: string, details: Record<string, unknown>) {
  const payload = {
    timestamp: new Date().toISOString(),
    message,
    ...details,
  };

  if (level === "error") {
    console.error("[stripe-webhook]", JSON.stringify(payload));
    return;
  }

  console.info("[stripe-webhook]", JSON.stringify(payload));
}

export async function POST(request: Request) {
  if (!env.stripeWebhookSecret) {
    logStripeWebhook("error", "Missing Stripe webhook secret", {});
    return NextResponse.json({ error: "Missing webhook secret" }, { status: 500 });
  }

  const stripe = getStripeClient();
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    logStripeWebhook("error", "Missing Stripe signature", {});
    return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.stripeWebhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature";
    logStripeWebhook("error", "Invalid Stripe webhook signature", { error: message });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const baseDetails = {
    eventId: event.id,
    eventType: event.type,
  };

  logStripeWebhook("info", "Received Stripe webhook event", baseDetails);

  if (
    event.type === "checkout.session.completed"
    || event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object;
    const metadata = session.metadata ?? {};
    const checkoutKind = metadata.checkoutKind;
    const sessionDetails = {
      ...baseDetails,
      checkoutKind,
      paymentStatus: session.payment_status,
      checkoutSessionId: session.id,
      amountTotal: session.amount_total,
      currency: session.currency ?? null,
    };

    logStripeWebhook("info", "Processing checkout session event", sessionDetails);

    if (checkoutKind !== "project_hours" && checkoutKind !== "quote_conversion") {
      logStripeWebhook("error", "Invalid checkout kind in Stripe metadata", sessionDetails);
      return NextResponse.json({ error: "Invalid checkout kind" }, { status: 400 });
    }

    if (session.payment_status !== "paid") {
      logStripeWebhook("info", "Skipping Stripe event because payment is not marked paid", sessionDetails);
      return NextResponse.json({ received: true });
    }

    if (checkoutKind === "quote_conversion") {
      const quoteId = metadata.quoteId;
      const customerId = metadata.customerId;
      const amountCents = Number(metadata.amountCents ?? "0");
      const currency = metadata.currency ?? env.stripeCurrency;
      const quoteDetails = {
        ...sessionDetails,
        quoteId: quoteId ?? null,
        customerId: metadata.customerId ?? null,
        metadataAmountCents: metadata.amountCents ?? null,
        parsedAmountCents: amountCents,
        metadataCurrency: currency,
      };

      if (
        Number.isNaN(amountCents)
        || amountCents <= 0
        || session.amount_total !== amountCents
        || (session.currency ?? "").toLowerCase() !== currency.toLowerCase()
      ) {
        logStripeWebhook("error", "Invalid quote checkout metadata", quoteDetails);
        return NextResponse.json({ error: "Invalid quote checkout metadata" }, { status: 400 });
      }

      if (!quoteId || !customerId) {
        logStripeWebhook("error", "Missing quote checkout metadata", quoteDetails);
        return NextResponse.json({ error: "Missing quote checkout metadata" }, { status: 400 });
      }

      logStripeWebhook("info", "Applying quote conversion payment", quoteDetails);

      const admin = createAdminClient();
      const { error } = await admin.rpc("apply_quote_conversion_payment", {
        p_event_id: event.id,
        p_quote_id: quoteId,
        p_customer_id: customerId,
        p_checkout_session_id: session.id,
        p_amount_cents: amountCents,
        p_currency: currency,
      });

      if (error) {
        logStripeWebhook("error", "Quote conversion payment RPC failed", {
          ...quoteDetails,
          rpcError: error.message,
        });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      logStripeWebhook("info", "Quote conversion payment applied successfully", quoteDetails);

      return NextResponse.json({ received: true });
    }

    if (event.type !== "checkout.session.completed") {
      logStripeWebhook("info", "Skipping non-completed project hours event", sessionDetails);
      return NextResponse.json({ received: true });
    }

    const projectId = metadata.projectId;
    const customerId = metadata.customerId;
    const hoursToBuy = Number(metadata.hoursToBuy ?? "0");
    const unitAmountCents = Number(metadata.unitAmountCents ?? "0");
    const amountCents = Number(metadata.amountCents ?? "0");
    const currency = metadata.currency ?? env.stripeCurrency;
    const projectDetails = {
      ...sessionDetails,
      projectId: projectId ?? null,
      customerId: customerId ?? null,
      hoursToBuy,
      unitAmountCents,
      parsedAmountCents: amountCents,
      metadataAmountCents: metadata.amountCents ?? null,
      metadataCurrency: currency,
    };

    if (
      Number.isNaN(hoursToBuy)
      || Number.isNaN(unitAmountCents)
      || Number.isNaN(amountCents)
      || unitAmountCents <= 0
      || amountCents <= 0
      || unitAmountCents * hoursToBuy !== amountCents
      || session.amount_total !== amountCents
      || (session.currency ?? "").toLowerCase() !== currency.toLowerCase()
    ) {
      logStripeWebhook("error", "Invalid project checkout metadata", projectDetails);
      return NextResponse.json({ error: "Invalid checkout metadata" }, { status: 400 });
    }

    if (!projectId || !customerId) {
      logStripeWebhook("error", "Missing project checkout metadata", projectDetails);
      return NextResponse.json({ error: "Missing project checkout metadata" }, { status: 400 });
    }

    logStripeWebhook("info", "Applying project hours purchase", projectDetails);

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
      logStripeWebhook("error", "Project hours purchase RPC failed", {
        ...projectDetails,
        rpcError: error.message,
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logStripeWebhook("info", "Project hours purchase applied successfully", projectDetails);
  }

  return NextResponse.json({ received: true });
}
