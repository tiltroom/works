import { sendMagicLinkAction } from "@/app/actions/auth";

interface LoginPageProps {
  searchParams?: Promise<{
    sent?: string;
    error?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
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

          <h1 className="text-center text-3xl font-bold tracking-tight">Check your inbox</h1>
          <p className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">
            We sent a secure magic link to your invited email address. Keep this tab open and return once you click the link.
          </p>

          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-xs text-zinc-400">
            Tip: If you don&apos;t see the email, check your spam/promotions folder after a few moments.
          </div>

          <a
            href="/login"
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-sm font-medium text-zinc-200 transition-all hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
          >
            Use a different email
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center p-6">
      <div className="glass-card w-full max-w-md rounded-2xl p-8 border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand-600 via-purple-500 to-brand-400"></div>
        
        <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Enter your invited email and we will send a secure sign-in link.
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
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              className="w-full rounded-lg bg-zinc-900/50 border border-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-brand-600 px-4 py-3 font-medium text-white transition-all hover:bg-brand-500 hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] border border-brand-400/20"
          >
            Send magic link
          </button>
        </form>
      </div>
    </main>
  );
}
