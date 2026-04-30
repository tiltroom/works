type NumericHours = number | string | null | undefined;

export interface QuoteEstimatedHoursRow {
  total_estimated_hours: NumericHours;
}

export interface SubtaskEstimatedHoursRow {
  estimated_hours: NumericHours;
}

export interface PurchasedHoursRow {
  hours_added: NumericHours;
}

export function parseProjectHours(value: NumericHours) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sumSubtaskEstimatedHours(subtasks: SubtaskEstimatedHoursRow[]) {
  return subtasks.reduce((total, subtask) => total + parseProjectHours(subtask.estimated_hours), 0);
}

export function assignedHoursFromQuoteEstimateOrSubtasks(
  quote: QuoteEstimatedHoursRow | null | undefined,
  subtasks: SubtaskEstimatedHoursRow[],
) {
  return quote ? parseProjectHours(quote.total_estimated_hours) : sumSubtaskEstimatedHours(subtasks);
}

export function sumPurchasedHours(purchases: PurchasedHoursRow[]) {
  return purchases.reduce((total, purchase) => total + parseProjectHours(purchase.hours_added), 0);
}

export function outstandingDebtFromBilledHours(usedHours: number, billedHours: number) {
  return Math.max(0, usedHours - billedHours);
}
