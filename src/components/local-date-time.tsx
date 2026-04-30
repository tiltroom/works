"use client";

import { formatLocalDate, formatLocalDateTime, formatLocalTime } from "@/lib/date-time";

interface LocalDateTimeProps {
  value: string | null | undefined;
  tag: string;
  fallback?: string;
  options?: Intl.DateTimeFormatOptions;
}

export function LocalDateTime({ value, tag, fallback = "—", options }: LocalDateTimeProps) {
  return <>{formatLocalDateTime(value, tag, options, fallback)}</>;
}

export function LocalDate({ value, tag, fallback = "—" }: LocalDateTimeProps) {
  return <>{formatLocalDate(value, tag, fallback)}</>;
}

export function LocalTime({ value, tag, fallback = "—", options }: LocalDateTimeProps) {
  return <>{formatLocalTime(value, tag, options, fallback)}</>;
}
