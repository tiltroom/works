import { createCheckoutForHoursAction } from "@/app/actions/billing";
import { LogoutButton } from "@/components/logout-button";
import { hoursToMinutesWithHoursDisplay, millisecondsToHours } from "@/lib/time";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { localeTag, t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { RecentActivityToggle } from "./recent-activity-toggle";

export const dynamic = "force-dynamic";

interface CustomerProjectRow {
  id: string;
  name: string;
  assigned_hours: number;
}

interface ProjectTimeRow {
  id: string;
  project_id: string;
  started_at: string;
  ended_at: string | null;
  description: string | null;
  worker_id: string;
}

interface WorkerProfileRow {
  id: string;
  full_name: string | null;
}

interface PurchaseRow {
  id: string;
  project_id: string;
  hours_added: number;
  amount_cents: number;
  currency: string;
  created_at: string;
}

function totalUsedHours(entries: ProjectTimeRow[]) {
  return entries.reduce((total, entry) => {
    if (!entry.ended_at) {
      return total;
    }
    const ms = new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime();
    return total + millisecondsToHours(Math.max(ms, 0));
  }, 0);
}

function formatEntryDuration(locale: "en" | "it", startedAt: string, endedAt: string | null) {
  if (!endedAt) {
    return t(locale, "Running", "In corso");
  }

  const totalMinutes = Math.max(
    Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60_000),
    0,
  );
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return t(locale, `${hours}h ${minutes}m`, `${hours}h ${minutes} min`);
  }

  if (hours > 0) {
    return t(locale, `${hours}h`, `${hours}h`);
  }

  if (minutes > 0) {
    return t(locale, `${minutes}m`, `${minutes} min`);
  }

  return t(locale, "< 1m", "< 1 min");
}

const sectionCardClass = "rounded-2xl border border-border bg-card/80 backdrop-blur-sm";
const tableShellClass = "overflow-hidden rounded-xl border border-border/70 bg-background/45";
const tableHeadClass = "border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground";
const tableRowClass = "transition-colors hover:bg-accent/60";
const metricCardClass = "rounded-xl border border-border/70 bg-background/60 p-4";
const inputClass = "w-full rounded-lg border border-input bg-background/75 px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all";

export default async function CustomerPage() {
  const locale = await getLocale();
  const tag = localeTag(locale);
  const profile = await requireRole(["customer"]);
  const supabase = await createClient();

  const [{ data: projects }, { data: purchases }] = await Promise.all([
    supabase.from("projects").select("id,name,assigned_hours").eq("customer_id", profile.id),
    supabase
      .from("hour_purchases")
      .select("id,project_id,hours_added,amount_cents,currency,created_at")
      .eq("customer_id", profile.id),
  ]);

  const projectIds = (projects ?? []).map((project) => project.id);
  const { data: timeEntries } = projectIds.length
    ? await supabase
        .from("time_entries")
        .select("id,project_id,started_at,ended_at,description,worker_id")
        .in("project_id", projectIds)
        .order("started_at", { ascending: false })
        .limit(50)
    : { data: [] };

  const customerProjects = (projects ?? []) as CustomerProjectRow[];
  const entries = (timeEntries ?? []) as unknown as ProjectTimeRow[];
  const workerIds = [...new Set(entries.map((entry) => entry.worker_id).filter(Boolean))];
  const { data: workerProfiles } = workerIds.length
    ? await supabase.from("profiles").select("id,full_name").in("id", workerIds)
    : { data: [] };
  const workerNameById = new Map(
    ((workerProfiles ?? []) as WorkerProfileRow[]).map((worker) => [worker.id, worker.full_name?.trim() || null]),
  );
  const billingRows = (purchases ?? []) as PurchaseRow[];

  return (
    <main className="w-full">
      <header className="mb-8 flex flex-col justify-between gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground">
            <span className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
            {t(locale, "Customer Portal", "Portale cliente")}
          </h1>
          <p className="mt-1 text-muted-foreground">{t(locale, "Monitor project progress, track hours used, and manage billing.", "Monitora l'avanzamento dei progetti, le ore utilizzate e la fatturazione.")}</p>
        </div>
        <LogoutButton />
      </header>

      <section className="space-y-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          {t(locale, "Projects & Hours Usage", "Progetti e utilizzo ore")}
        </h2>
        
        <div className="grid gap-6">
          {customerProjects.length === 0 ? (
            <div className={`${sectionCardClass} p-8 text-center text-muted-foreground`}>
              {t(locale, "No projects have been assigned to you yet.", "Non ti sono ancora stati assegnati progetti.")}
            </div>
          ) : (
            customerProjects.map((project) => {
              const projectEntries = entries.filter((entry) => entry.project_id === project.id);
              const used = totalUsedHours(projectEntries);
              const totalAssigned = Number(project.assigned_hours);
              const remaining = Math.max(0, totalAssigned - used);
              const usagePercent = totalAssigned > 0 ? Math.min(100, (used / totalAssigned) * 100) : 0;
              
              const isLowHours = remaining < 5 && remaining > 0;
              const isOutOfHours = remaining <= 0;

              return (
                <div key={project.id} className={`${sectionCardClass} relative overflow-hidden p-6 md:p-8`}>
                  <div className={`absolute top-0 inset-x-0 h-1 ${isOutOfHours ? 'bg-red-500' : isLowHours ? 'bg-amber-500' : 'bg-brand-500'}`}></div>
                  
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                    <div className="flex-1">
                      <h3 className="mb-4 text-2xl font-bold text-foreground">{project.name}</h3>
                      
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className={metricCardClass}>
                          <p className="mb-1 text-sm text-muted-foreground">{t(locale, "Assigned", "Assegnate")}</p>
                          <p className="text-xl font-semibold text-foreground">{hoursToMinutesWithHoursDisplay(totalAssigned)}</p>
                        </div>
                        <div className={metricCardClass}>
                          <p className="mb-1 text-sm text-muted-foreground">{t(locale, "Used", "Usate")}</p>
                          <p className="text-xl font-semibold text-foreground">{hoursToMinutesWithHoursDisplay(used)}</p>
                        </div>
                        <div className={`rounded-xl border bg-background/60 p-4 ${isOutOfHours ? 'border-red-500/30' : isLowHours ? 'border-amber-500/30' : 'border-border/70'}`}>
                          <p className="mb-1 text-sm text-muted-foreground">{t(locale, "Remaining", "Rimanenti")}</p>
                          <p className={`text-xl font-semibold ${isOutOfHours ? 'text-red-600 dark:text-red-400' : isLowHours ? 'text-amber-700 dark:text-amber-400' : 'text-brand-600 dark:text-brand-400'}`}>
                            {hoursToMinutesWithHoursDisplay(remaining)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{t(locale, "Usage", "Utilizzo")}: {usagePercent.toFixed(1)}%</span>
                          {isLowHours && <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400"><span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span> {t(locale, "Running low", "In esaurimento")}</span>}
                          {isOutOfHours && <span className="flex items-center gap-1 text-red-700 dark:text-red-400"><span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></span> {t(locale, "Out of hours", "Ore esaurite")}</span>}
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${isOutOfHours ? 'bg-red-500' : isLowHours ? 'bg-amber-500' : 'bg-brand-500'}`}
                            style={{ width: `${usagePercent}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 rounded-xl border border-border bg-background/60 p-5 md:w-64">
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        {t(locale, "Add Capacity", "Aggiungi capacità")}
                      </h4>
                      <form action={createCheckoutForHoursAction} className="flex flex-col gap-3">
                        <input type="hidden" name="projectId" value={project.id} />
                        <div className="relative">
                          <input
                            type="number"
                            name="hoursToBuy"
                            min="1"
                            step="1"
                            defaultValue="10"
                            className={`${inputClass} pr-12`}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{t(locale, "hrs", "ore")}</span>
                        </div>
                        <button className="w-full rounded-lg border border-primary/20 bg-primary px-4 py-2 font-medium text-primary-foreground transition-all hover:bg-primary/90">
                          {t(locale, "Buy Hours via Stripe", "Acquista ore con Stripe")}
                        </button>
                      </form>
                    </div>
                  </div>

                  {projectEntries.length > 0 && (
                    <RecentActivityToggle
                      title={t(locale, "Recent Activity", "Attività recenti")}
                      showLabel={t(locale, "Show", "Mostra")}
                      hideLabel={t(locale, "Hide", "Nascondi")}
                      exportUrl={`/customer/export/${project.id}`}
                      exportLabel={t(locale, "Export XLS", "Esporta XLS")}
                    >
                        <div className={tableShellClass}>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead className={tableHeadClass}>
                             <tr>
                               <th className="px-4 py-3 font-medium">{t(locale, "Worker", "Operatore")}</th>
                               <th className="px-4 py-3 font-medium">{t(locale, "Started", "Iniziato")}</th>
                               <th className="px-4 py-3 font-medium">{t(locale, "Ended", "Terminato")}</th>
                               <th className="px-4 py-3 font-medium">{t(locale, "Duration", "Durata")}</th>
                               <th className="px-4 py-3 font-medium">{t(locale, "Description", "Descrizione")}</th>
                             </tr>
                           </thead>
                            <tbody className="divide-y divide-border/70">
                              {projectEntries.map((entry) => {
                                const workerName = workerNameById.get(entry.worker_id) || t(locale, "Unknown worker", "Operatore sconosciuto");
                                const durationLabel = formatEntryDuration(locale as "en" | "it", entry.started_at, entry.ended_at);

                                return (
                                  <tr key={entry.id} className={tableRowClass}>
                                    <td className="px-4 py-3 font-medium text-foreground">
                                      <div className="flex items-center gap-2">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted text-xs text-muted-foreground">
                                          {(workerName[0] || "?").toUpperCase()}
                                        </div>
                                        {workerName}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{new Date(entry.started_at).toLocaleString(tag)}</td>
                                    <td className="px-4 py-3">
                                      {entry.ended_at ? (
                                        <span className="text-muted-foreground">{new Date(entry.ended_at).toLocaleString(tag)}</span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1.5 rounded border border-brand-500/20 bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-700 dark:text-brand-300">
                                          <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse"></span>
                                          {t(locale, "Running", "In corso")}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{durationLabel}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{entry.description || <span className="italic text-muted-foreground/80">{t(locale, "No description", "Nessuna descrizione")}</span>}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                             </table>
                           </div>
                         </div>
                    </RecentActivityToggle>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-12 space-y-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          {t(locale, "Purchase History", "Storico acquisti")}
        </h2>
        
        <div className={`${sectionCardClass} p-6`}>
          <div className={tableShellClass}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className={tableHeadClass}>
                  <tr>
                      <th className="px-4 py-3 font-medium">{t(locale, "Project", "Progetto")}</th>
                      <th className="px-4 py-3 font-medium">{t(locale, "Hours Added", "Ore aggiunte")}</th>
                      <th className="px-4 py-3 font-medium">{t(locale, "Amount Paid", "Importo pagato")}</th>
                      <th className="px-4 py-3 font-medium">{t(locale, "Date", "Data")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {billingRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">{t(locale, "No purchases found.", "Nessun acquisto trovato.")}</td>
                      </tr>
                    ) : (
                      billingRows.map((purchase) => {
                        const projectName = customerProjects.find((project) => project.id === purchase.project_id)?.name ?? t(locale, "Unknown", "Sconosciuto");
                        return (
                        <tr key={purchase.id} className={tableRowClass}>
                          <td className="px-4 py-3 font-medium text-foreground">{projectName}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
                              +{Number(purchase.hours_added).toFixed(2)}h
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-foreground">
                            {(purchase.amount_cents / 100).toFixed(2)} <span className="ml-1 text-muted-foreground">{purchase.currency.toUpperCase()}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(purchase.created_at).toLocaleString(tag)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
