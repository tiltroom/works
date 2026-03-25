import Link from "next/link";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function SignupPage() {
  const locale = await getLocale();

  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card/85 p-10 shadow-2xl backdrop-blur-sm">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500"></div>
        
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-border bg-background/65">
          <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground">{t(locale, "Invitation Required", "Invito richiesto")}</h1>
        
        <p className="mb-8 text-base leading-relaxed text-muted-foreground">
          {t(
            locale,
            "This platform is currently invite-only to ensure quality and security. Please contact your administrator to add your email address.",
            "Questa piattaforma è attualmente solo su invito per garantire qualità e sicurezza. Contatta il tuo amministratore per aggiungere il tuo indirizzo email.",
          )}
        </p>

        <div className="space-y-4">
          <Link
            href="/login"
            className="block w-full rounded-lg border border-border bg-background/70 px-4 py-3 font-medium text-foreground transition-all hover:bg-accent hover:text-accent-foreground"
          >
            {t(locale, "Go to Magic-Link Sign In", "Vai all'accesso con link magico")}
          </Link>
          <Link
            href="/"
            className="block w-full text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t(locale, "Return to Home", "Torna alla home")}
          </Link>
        </div>
      </div>
    </main>
  );
}
