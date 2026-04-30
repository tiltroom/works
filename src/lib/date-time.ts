const utcIsoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z$/;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function toUtcIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function parseUtcDateTimeInput(value: FormDataEntryValue | string | null, fieldName: string) {
  const rawValue = typeof value === "string" ? value.trim() : "";

  if (!rawValue || !utcIsoPattern.test(rawValue)) {
    throw new Error(`${fieldName} must be a UTC ISO timestamp`);
  }

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is invalid`);
  }

  return date;
}

export function parseOptionalUtcDateTime(value: string | null | undefined) {
  if (!value || !utcIsoPattern.test(value.trim())) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function datetimeLocalValueToUtcIso(value: FormDataEntryValue | string | null, fieldName = "Date/time") {
  const rawValue = typeof value === "string" ? value.trim() : "";

  if (!rawValue) {
    throw new Error(`${fieldName} is required`);
  }

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is invalid`);
  }

  return date.toISOString();
}

export function dateToDatetimeLocalValue(date: Date) {
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function utcIsoToDatetimeLocalValue(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  return dateToDatetimeLocalValue(date);
}

export function formatLocalDateTime(
  value: Date | string | null | undefined,
  tag: string,
  options?: Intl.DateTimeFormatOptions,
  fallback = "—",
) {
  if (!value) {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleString(tag, options);
}

export function formatLocalDate(value: Date | string | null | undefined, tag: string, fallback = "—") {
  if (!value) {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleDateString(tag);
}

export function formatLocalTime(
  value: Date | string | null | undefined,
  tag: string,
  options?: Intl.DateTimeFormatOptions,
  fallback = "—",
) {
  if (!value) {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleTimeString(tag, options);
}
