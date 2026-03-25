import { logoutAction } from "@/app/actions/auth";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export async function LogoutButton() {
  const locale = await getLocale();

  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="flex items-center gap-2 rounded-lg border border-border bg-background/65 px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground"
      >
        <span>{t(locale, "Sign Out", "Esci")}</span>
        <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </form>
  );
}
