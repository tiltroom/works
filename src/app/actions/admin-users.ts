"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLocale, t } from "@/lib/i18n";

export async function updateCustomerHourlyRateAction(formData: FormData) {
  const locale = await getLocale();
  await requireRole(["admin"]);

  const customerId = String(formData.get("customerId") ?? "").trim();
  const hourlyRateInput = String(formData.get("customHourlyRate") ?? "").trim();

  if (!customerId) {
    throw new Error(t(locale, "Invalid customer payload", "Payload cliente non valido"));
  }

  let customHourlyRateCents: number | null = null;
  if (hourlyRateInput) {
    const hourlyRate = Number(hourlyRateInput);
    if (Number.isNaN(hourlyRate) || hourlyRate <= 0) {
      throw new Error(t(locale, "Hourly rate must be a positive number", "La tariffa oraria deve essere un numero positivo"));
    }
    customHourlyRateCents = Math.round(hourlyRate * 100);

    if (customHourlyRateCents <= 0) {
      throw new Error(t(locale, "Hourly rate must be at least $0.01", "La tariffa oraria deve essere almeno $0.01"));
    }
  }

  const supabase = await createClient();
  const { data: customer, error: customerError } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", customerId)
    .single();

  if (customerError || !customer || customer.role !== "customer") {
    throw new Error(t(locale, "Customer not found", "Cliente non trovato"));
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ custom_hourly_rate_cents: customHourlyRateCents })
    .eq("id", customerId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath("/admin");
}
