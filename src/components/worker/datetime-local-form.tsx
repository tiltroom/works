"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useState } from "react";
import { datetimeLocalValueToUtcIso, utcIsoToDatetimeLocalValue } from "@/lib/date-time";

interface DatetimeLocalFormProps extends Omit<ComponentPropsWithoutRef<"form">, "children"> {
  children: ReactNode;
}

function replaceLocalDateTimeField(form: HTMLFormElement, localName: string, utcName: string) {
  const localInput = form.elements.namedItem(localName) as HTMLInputElement | null;
  const utcInput = form.elements.namedItem(utcName) as HTMLInputElement | null;

  if (!localInput || !utcInput || !localInput.value.trim()) {
    if (utcInput) {
      utcInput.value = "";
      utcInput.disabled = true;
    }
    return;
  }

  utcInput.disabled = false;
  utcInput.value = datetimeLocalValueToUtcIso(localInput.value);
}

export function prepareDatetimeLocalForm(form: HTMLFormElement) {
  replaceLocalDateTimeField(form, "startedAtLocal", "startedAtUtc");
  replaceLocalDateTimeField(form, "endedAtLocal", "endedAtUtc");
  replaceLocalDateTimeField(form, "fromLocal", "from");
  replaceLocalDateTimeField(form, "toLocal", "to");
}

export function DatetimeLocalForm({ children, ...props }: DatetimeLocalFormProps) {
  return (
    <form
      {...props}
      onSubmit={(event) => {
        prepareDatetimeLocalForm(event.currentTarget);
        props.onSubmit?.(event);
      }}
    >
      {children}
    </form>
  );
}

interface DatetimeLocalInputProps extends Omit<ComponentPropsWithoutRef<"input">, "type" | "defaultValue" | "value"> {
  defaultUtcValue?: string | null;
  defaultLocalValue?: string | null;
  minUtcValue?: string | null;
  maxUtcValue?: string | null;
}

export function DatetimeLocalInput({ defaultUtcValue, defaultLocalValue, minUtcValue, maxUtcValue, onChange, ...props }: DatetimeLocalInputProps) {
  const [value, setValue] = useState(() => defaultLocalValue ?? utcIsoToDatetimeLocalValue(defaultUtcValue));
  const min = utcIsoToDatetimeLocalValue(minUtcValue);
  const max = utcIsoToDatetimeLocalValue(maxUtcValue);

  return (
    <input
      {...props}
      type="datetime-local"
      value={value}
      min={min || props.min}
      max={max || props.max}
      suppressHydrationWarning
      onChange={(event) => {
        setValue(event.currentTarget.value);
        onChange?.(event);
      }}
    />
  );
}
