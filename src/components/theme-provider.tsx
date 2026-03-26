"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  THEME_STORAGE_KEY,
  isThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const SYSTEM_THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(SYSTEM_THEME_MEDIA_QUERY).matches ? "dark" : "light";
}

function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (isThemePreference(storedTheme)) {
      return storedTheme;
    }
  } catch {
    return "system";
  }

  return "system";
}

function applyTheme(theme: ThemePreference, resolvedTheme: ResolvedTheme) {
  const root = document.documentElement;

  root.setAttribute("data-theme", resolvedTheme);
  root.setAttribute("data-theme-preference", theme);
  root.style.colorScheme = resolvedTheme;
}

function subscribeToSystemTheme(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(SYSTEM_THEME_MEDIA_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);

  return () => {
    mediaQuery.removeEventListener("change", onStoreChange);
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => getStoredTheme());
  const systemTheme = useSyncExternalStore(subscribeToSystemTheme, getSystemTheme, (): ResolvedTheme => "light");
  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== null && event.key !== THEME_STORAGE_KEY) {
        return;
      }

      setThemeState(getStoredTheme());
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    applyTheme(theme, resolvedTheme);
  }, [resolvedTheme, theme]);

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setThemeState(nextTheme);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [resolvedTheme, setTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
