"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { setLocaleAction } from "@/app/actions/locale";
import type { Locale } from "@/lib/i18n";

interface LanguageSwitcherProps {
  locale: Locale;
}

export function LanguageSwitcher({ locale }: LanguageSwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const redirectTo = query ? `${pathname}?${query}` : pathname;

  return (
    <div className="inline-flex items-center rounded-lg border border-zinc-800 bg-zinc-900/70 p-1 text-xs font-semibold uppercase tracking-wider">
      <form action={setLocaleAction}>
        <input type="hidden" name="locale" value="en" />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <button
          type="submit"
          className={`rounded-md px-3 py-1.5 transition-colors ${
            locale === "en" ? "bg-brand-600 text-white" : "text-zinc-400 hover:text-zinc-200"
          }`}
          aria-label="Switch language to English"
        >
          EN
        </button>
      </form>

      <form action={setLocaleAction}>
        <input type="hidden" name="locale" value="it" />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <button
          type="submit"
          className={`rounded-md px-3 py-1.5 transition-colors ${
            locale === "it" ? "bg-brand-600 text-white" : "text-zinc-400 hover:text-zinc-200"
          }`}
          aria-label="Passa la lingua in italiano"
        >
          IT
        </button>
      </form>
    </div>
  );
}
