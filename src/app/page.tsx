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
    <main className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-900/40 via-background to-background"></div>
      
      <div className="glass-card relative max-w-3xl overflow-hidden rounded-3xl border border-border/70 p-10 shadow-2xl md:p-16">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 relative z-10">
          <span className="gradient-text">Hours Platform</span>
        </h1>
        
        <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto relative z-10">
          {t(
            locale,
            "Precision time tracking with role-based dashboards. Manage projects, monitor resource allocation, and scale effortlessly with integrated billing.",
            "Monitoraggio preciso del tempo con dashboard basate sui ruoli. Gestisci progetti, controlla l'allocazione delle risorse e scala facilmente con la fatturazione integrata.",
          )}
        </p>

        <div className="mt-10 flex justify-center items-center relative z-10">
          <Link 
            href="/login" 
            className="group relative px-8 py-3 w-full sm:w-auto font-medium text-white transition-all duration-300 ease-in-out bg-brand-600 hover:bg-brand-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] border border-brand-400/20"
          >
            <span>{t(locale, "Sign In", "Accedi")}</span>
          </Link>
        </div>
      </div>
      
      <div className="mt-16 flex flex-wrap justify-center gap-3 max-w-4xl opacity-80">
        {features.map((feature) => (
          <span key={feature} className="rounded-full border border-border bg-card/75 px-4 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur-sm">
            {feature}
          </span>
        ))}
      </div>
    </main>
  );
}
