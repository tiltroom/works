import Link from "next/link";
import { getLocale, t } from "@/lib/i18n";

export default async function SignupPage() {
  const locale = await getLocale();

  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center">
      <div className="glass-card max-w-md w-full rounded-2xl p-10 border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500"></div>
        
        <div className="mx-auto w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mb-6 border border-zinc-700">
          <svg className="w-8 h-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-4 text-white">{t(locale, "Invitation Required", "Invito richiesto")}</h1>
        
        <p className="text-base text-zinc-400 leading-relaxed mb-8">
          {t(
            locale,
            "This platform is currently invite-only to ensure quality and security. Please contact your administrator to add your email address.",
            "Questa piattaforma è attualmente solo su invito per garantire qualità e sicurezza. Contatta il tuo amministratore per aggiungere il tuo indirizzo email.",
          )}
        </p>

        <div className="space-y-4">
          <Link
            href="/login"
            className="block w-full rounded-lg bg-zinc-800 px-4 py-3 font-medium text-white transition-all hover:bg-zinc-700 hover:text-white border border-zinc-700 hover:border-zinc-600"
          >
            {t(locale, "Go to Magic-Link Sign In", "Vai all'accesso con link magico")}
          </Link>
          <Link
            href="/"
            className="block w-full text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {t(locale, "Return to Home", "Torna alla home")}
          </Link>
        </div>
      </div>
    </main>
  );
}
