"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function updateCustomerHourlyRateAction(formData: FormData) {
  await requireRole(["admin"]);

  const customerId = String(formData.get("customerId") ?? "").trim();
  const hourlyRateInput = String(formData.get("customHourlyRate") ?? "").trim();

  if (!customerId) {
    throw new Error("Invalid customer payload");
  }

  let customHourlyRateCents: number | null = null;
  if (hourlyRateInput) {
    const hourlyRate = Number(hourlyRateInput);
    if (Number.isNaN(hourlyRate) || hourlyRate <= 0) {
      throw new Error("Hourly rate must be a positive number");
    }
    customHourlyRateCents = Math.round(hourlyRate * 100);

    if (customHourlyRateCents <= 0) {
      throw new Error("Hourly rate must be at least $0.01");
    }
  }

  const supabase = await createClient();
  const { data: customer, error: customerError } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", customerId)
    .single();

  if (customerError || !customer || customer.role !== "customer") {
    throw new Error("Customer not found");
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
