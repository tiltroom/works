import Link from "next/link";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function Home() {
  const locale = await getLocale();

  const features = [
    t(locale, "Role-Based Access", "Accesso basato sui ruoli"),
    t(locale, "Stripe Integration", "Integrazione Stripe"),
    t(locale, "Real-Time Tracking", "Monitoraggio in tempo reale"),
    t(locale, "Project Management", "Gestione progetti"),
  ];

  return (
    <main className="home-hero relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden p-6 text-center">
      <div className="home-hero__backdrop absolute inset-0 -z-20"></div>
      <div className="home-hero__grid absolute inset-0 -z-10 opacity-60"></div>

      <div className="home-hero__card glass-card relative max-w-3xl overflow-hidden rounded-3xl border border-border/70 p-10 shadow-2xl md:p-16">
        <div className="home-hero__accent home-hero__accent--primary absolute -top-24 -right-24 h-48 w-48 rounded-full animate-blob"></div>
        <div className="home-hero__accent home-hero__accent--secondary absolute -bottom-24 -left-24 h-48 w-48 rounded-full animate-blob animation-delay-2000"></div>
        <div className="home-hero__shine absolute inset-x-10 top-0 h-px"></div>

        <div className="relative z-10 mx-auto inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground shadow-[0_12px_24px_-22px_rgba(15,23,42,0.55)] backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-brand-500 shadow-[0_0_14px_rgba(99,102,241,0.45)]"></span>
          {t(locale, "Operations Suite", "Suite operativa")}
        </div>

        <h1 className="relative z-10 mb-6 mt-6 text-5xl font-bold tracking-tighter md:text-7xl">
          <span className="gradient-text">Hours Platform</span>
        </h1>

        <p className="relative z-10 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-foreground/78 md:text-xl dark:text-muted-foreground">
          {t(
            locale,
            "Precision time tracking with role-based dashboards. Manage projects, monitor resource allocation, and scale effortlessly with integrated billing.",
            "Monitoraggio preciso del tempo con dashboard basate sui ruoli. Gestisci progetti, controlla l'allocazione delle risorse e scala facilmente con la fatturazione integrata.",
          )}
        </p>

        <div className="relative z-10 mt-10 flex items-center justify-center">
          <Link
            href="/login"
            className="home-hero__cta group relative inline-flex w-full items-center justify-center overflow-hidden rounded-full px-8 py-3 font-medium text-white transition-all duration-300 ease-in-out sm:w-auto"
          >
            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.24),transparent_42%,transparent_58%,rgba(255,255,255,0.16))] opacity-60 transition-opacity duration-300 group-hover:opacity-100"></span>
            <span className="relative">{t(locale, "Sign In", "Accedi")}</span>
          </Link>
        </div>
      </div>

      <div className="mt-16 flex max-w-4xl flex-wrap justify-center gap-3">
        {features.map((feature) => (
          <span
            key={feature}
            className="home-hero__chip rounded-full border px-4 py-1.5 text-sm font-medium backdrop-blur-sm"
          >
            {feature}
          </span>
        ))}
      </div>
    </main>
  );
}
