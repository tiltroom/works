"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useTheme } from "@/components/theme-provider";
import { t, type Locale } from "@/lib/i18n";
import type { ThemePreference } from "@/lib/theme";

interface ThemeSwitcherProps {
  locale: Locale;
}

interface ThemeOption {
  value: ThemePreference;
  label: string;
  icon: React.ReactNode;
}

function subscribeToClientReady() {
  return () => {};
}

export function ThemeSwitcher({ locale }: ThemeSwitcherProps) {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const mounted = useSyncExternalStore(subscribeToClientReady, () => true, () => false);

  const options = useMemo<ThemeOption[]>(
    () => [
      {
        value: "system",
        label: t(locale, "System", "Sistema"),
        icon: (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M4.75 6.75A2.75 2.75 0 0 1 7.5 4h9a2.75 2.75 0 0 1 2.75 2.75v6.5A2.75 2.75 0 0 1 16.5 16h-2.14l.92 2.75h1.22a.75.75 0 0 1 0 1.5h-9a.75.75 0 0 1 0-1.5h1.22L9.64 16H7.5a2.75 2.75 0 0 1-2.75-2.75zM6.25 13.25c0 .69.56 1.25 1.25 1.25h9c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25h-9c-.69 0-1.25.56-1.25 1.25z"
            />
          </svg>
        ),
      },
      {
        value: "light",
        label: t(locale, "Light", "Chiaro"),
        icon: (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M12 3.75v2.5m0 11.5v2.5m8.25-8.25h-2.5M6.25 12h-2.5m13.834 5.834-1.768-1.768M8.184 8.184 6.416 6.416m11.168 0-1.768 1.768M8.184 15.816l-1.768 1.768M15.25 12A3.25 3.25 0 1 1 8.75 12a3.25 3.25 0 0 1 6.5 0Z"
            />
          </svg>
        ),
      },
      {
        value: "dark",
        label: t(locale, "Dark", "Scuro"),
        icon: (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M21 12.79A9 9 0 0 1 11.21 3a.75.75 0 0 0-.86.97 7.5 7.5 0 1 0 9.68 9.68.75.75 0 0 0 .97-.86Z"
            />
          </svg>
        ),
      },
    ],
    [locale],
  );

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-border bg-card/80 p-1 text-xs font-semibold uppercase tracking-wider shadow-[0_10px_30px_-18px_rgba(15,23,42,0.55)] backdrop-blur-sm ${mounted ? "" : "invisible"}`}
      role="group"
      aria-label={t(locale, "Theme switcher", "Selettore tema")}
    >
      {options.map((option) => {
        const isActive = mounted && theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            disabled={!mounted}
            aria-pressed={isActive}
            aria-label={
              option.value === "system"
                ? `${option.label} · ${t(locale, "Current", "Attuale")}: ${resolvedTheme}`
                : option.label
            }
            title={option.label}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all ${
              isActive
                ? "bg-brand-600 text-white shadow-[0_0_18px_rgba(99,102,241,0.3)]"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {option.icon}
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
