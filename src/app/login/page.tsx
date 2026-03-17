import { sendMagicLinkAction } from "@/app/actions/auth";
import { getLocale, t } from "@/lib/i18n";

interface LoginPageProps {
  searchParams?: Promise<{
    sent?: string;
    error?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const locale = await getLocale();
  const params = searchParams ? await searchParams : undefined;
  const showWaitingScreen = params?.sent === "1";
  const errorMessage = params?.error;

  if (showWaitingScreen) {
    return (
      <main className="flex min-h-[80vh] flex-col items-center justify-center p-6">
        <div className="glass-card w-full max-w-md rounded-2xl border border-white/10 p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand-600 via-purple-500 to-brand-400"></div>

          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-brand-400/30 bg-brand-500/10">
            <svg className="h-8 w-8 text-brand-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-2 10H5a2 2 0 01-2-2V8a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2z"
              />
            </svg>
          </div>

          <h1 className="text-center text-3xl font-bold tracking-tight">{t(locale, "Check your inbox", "Controlla la tua casella email")}</h1>
          <p className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">
            {t(
              locale,
              "We sent a secure magic link to your invited email address. Keep this tab open and return once you click the link.",
              "Abbiamo inviato un link magico sicuro al tuo indirizzo email invitato. Tieni aperta questa scheda e torna qui dopo aver cliccato il link.",
            )}
          </p>

          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-xs text-zinc-400">
            {t(
              locale,
              "Tip: If you don't see the email, check your spam/promotions folder after a few moments.",
              "Suggerimento: se non vedi l'email, controlla la cartella spam/promozioni dopo qualche istante.",
            )}
          </div>

          <a
            href="/login"
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-sm font-medium text-zinc-200 transition-all hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
          >
            {t(locale, "Use a different email", "Usa un'email diversa")}
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center p-6">
      <div className="glass-card w-full max-w-md rounded-2xl p-8 border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand-600 via-purple-500 to-brand-400"></div>
        
        <h1 className="text-3xl font-bold tracking-tight mb-2">{t(locale, "Welcome back", "Bentornato")}</h1>
        <p className="text-sm text-muted-foreground mb-8">
          {t(
            locale,
            "Enter your invited email and we will send a secure sign-in link.",
            "Inserisci la tua email invitata e ti invieremo un link di accesso sicuro.",
          )}
        </p>

        {errorMessage ? (
          <div
            role="alert"
            aria-live="polite"
            className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {errorMessage}
          </div>
        ) : null}

        <form action={sendMagicLinkAction} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
              {t(locale, "Email Address", "Indirizzo email")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder={t(locale, "you@example.com", "tuo.nome@esempio.com")}
              required
              className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-brand-600 px-4 py-3 font-medium text-white transition-all hover:bg-brand-500 hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] border border-brand-400/20"
          >
            {t(locale, "Send magic link", "Invia link magico")}
          </button>
        </form>
      </div>
    </main>
  );
}
