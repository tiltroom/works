export const LOCALE_COOKIE = "hours_locale";
export const SUPPORTED_LOCALES = ["en", "it"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string | null | undefined): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export function t(locale: Locale, english: string, italian: string) {
  return locale === "it" ? italian : english;
}

export function localeTag(locale: Locale) {
  return locale === "it" ? "it-IT" : "en-US";
}
