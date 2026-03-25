export const THEME_STORAGE_KEY = "hours_theme";
export const THEME_OPTIONS = ["system", "light", "dark"] as const;

export type ThemePreference = (typeof THEME_OPTIONS)[number];
export type ResolvedTheme = Exclude<ThemePreference, "system">;

const SYSTEM_THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return THEME_OPTIONS.includes(value as ThemePreference);
}

export function getThemeScript() {
  return `(() => {
  const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
  const darkMediaQuery = ${JSON.stringify(SYSTEM_THEME_MEDIA_QUERY)};
  const root = document.documentElement;

  let theme = "system";

  try {
    const storedTheme = window.localStorage.getItem(storageKey);

    if (storedTheme === "system" || storedTheme === "light" || storedTheme === "dark") {
      theme = storedTheme;
    }
  } catch {
    theme = "system";
  }

  const resolvedTheme = theme === "system" && window.matchMedia(darkMediaQuery).matches ? "dark" : theme === "system" ? "light" : theme;

  root.setAttribute("data-theme", resolvedTheme);
  root.setAttribute("data-theme-preference", theme);
  root.style.colorScheme = resolvedTheme;
})();`;
}
