export function millisecondsToHours(ms: number) {
  return ms / 3_600_000;
}

export function hoursToDisplay(hours: number) {
  return `${hours.toFixed(2)}h`;
}

export function timerStartedAtToNowHours(startedAt: string) {
  const startMs = new Date(startedAt).getTime();
  const nowMs = Date.now();
  return millisecondsToHours(Math.max(nowMs - startMs, 0));
}
