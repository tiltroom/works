export const OVER_ESTIMATE_ERROR_PREFIX = "OVER_ESTIMATE::";

export interface OverEstimateWarningPayload {
  message: string;
  subtaskTitle: string;
  estimatedHours: number;
  loggedHours: number;
  addedHours: number;
  projectedHours: number;
  overByHours: number;
}

export function parseOverEstimateWarningMessage(message: string): OverEstimateWarningPayload | null {
  if (!message.startsWith(OVER_ESTIMATE_ERROR_PREFIX)) {
    return null;
  }

  try {
    const payload = JSON.parse(message.slice(OVER_ESTIMATE_ERROR_PREFIX.length)) as Partial<OverEstimateWarningPayload>;

    if (
      typeof payload.message !== "string"
      || typeof payload.subtaskTitle !== "string"
      || typeof payload.estimatedHours !== "number"
      || typeof payload.loggedHours !== "number"
      || typeof payload.addedHours !== "number"
      || typeof payload.projectedHours !== "number"
      || typeof payload.overByHours !== "number"
    ) {
      return null;
    }

    return payload as OverEstimateWarningPayload;
  } catch {
    return null;
  }
}

export function formatEstimateWarningHours(hours: number) {
  return `${Math.max(hours, 0).toFixed(2)}h`;
}
