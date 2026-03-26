export function millisecondsToHours(ms: number) {
  return ms / 3_600_000;
}

export function minimumLoggedMilliseconds(ms: number) {
  const safeMilliseconds = Math.max(ms, 0);

  if (safeMilliseconds === 0) {
    return 0;
  }

  return Math.max(safeMilliseconds, 60_000);
}

export function elapsedMilliseconds(startedAt: string, endedAt: string) {
  return new Date(endedAt).getTime() - new Date(startedAt).getTime();
}

export function loggedMilliseconds(startedAt: string, endedAt: string) {
  return minimumLoggedMilliseconds(elapsedMilliseconds(startedAt, endedAt));
}

export function loggedHoursBetween(startedAt: string, endedAt: string) {
  return millisecondsToHours(loggedMilliseconds(startedAt, endedAt));
}

export function loggedMinutesBetween(startedAt: string, endedAt: string) {
  return Math.round(loggedMilliseconds(startedAt, endedAt) / 60_000);
}

export function hoursToDisplay(hours: number) {
  return hoursToMinutesWithHoursDisplay(hours);
}

export function hoursToMinutesWithHoursDisplay(hours: number) {
  const totalMinutes = Math.max(Math.round(hours * 60), 0);
  return `${totalMinutes} min (${hours.toFixed(2)}h)`;
}

export function timerStartedAtToNowHours(startedAt: string) {
  const startMs = new Date(startedAt).getTime();
  const nowMs = Date.now();
  return millisecondsToHours(Math.max(nowMs - startMs, 0));
}
