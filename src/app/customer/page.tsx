import { createCheckoutForHoursAction } from "@/app/actions/billing";
import { LogoutButton } from "@/components/logout-button";
import { hoursToDisplay, millisecondsToHours } from "@/lib/time";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
  profiles: {
    full_name: string | null;
  } | null;
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

export default async function CustomerPage() {
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
        .select("id,project_id,started_at,ended_at,description,worker_id,profiles!time_entries_worker_id_fkey(full_name)")
        .in("project_id", projectIds)
        .order("started_at", { ascending: false })
        .limit(50)
    : { data: [] };

  const customerProjects = (projects ?? []) as CustomerProjectRow[];
  const entries = (timeEntries ?? []) as unknown as ProjectTimeRow[];
  const billingRows = (purchases ?? []) as PurchaseRow[];

  return (
    <main className="w-full">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-white/10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
            Customer Portal
          </h1>
          <p className="text-zinc-400 mt-1">Monitor project progress, track hours used, and manage billing.</p>
        </div>
        <LogoutButton />
      </header>

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Projects & Hours Usage
        </h2>
        
        <div className="grid gap-6">
          {customerProjects.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 border border-zinc-800 text-center text-zinc-400">
              No projects have been assigned to you yet.
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
                <div key={project.id} className="glass-card rounded-2xl p-6 md:p-8 border border-zinc-800 overflow-hidden relative">
                  <div className={`absolute top-0 inset-x-0 h-1 ${isOutOfHours ? 'bg-red-500' : isLowHours ? 'bg-amber-500' : 'bg-brand-500'}`}></div>
                  
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-white mb-4">{project.name}</h3>
                      
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50">
                          <p className="text-sm text-zinc-400 mb-1">Assigned</p>
                          <p className="text-xl font-semibold text-white">{hoursToDisplay(totalAssigned)}</p>
                        </div>
                        <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50">
                          <p className="text-sm text-zinc-400 mb-1">Used</p>
                          <p className="text-xl font-semibold text-white">{hoursToDisplay(used)}</p>
                        </div>
                        <div className={`bg-zinc-900/50 rounded-xl p-4 border ${isOutOfHours ? 'border-red-500/30' : isLowHours ? 'border-amber-500/30' : 'border-zinc-800/50'}`}>
                          <p className="text-sm text-zinc-400 mb-1">Remaining</p>
                          <p className={`text-xl font-semibold ${isOutOfHours ? 'text-red-400' : isLowHours ? 'text-amber-400' : 'text-brand-400'}`}>
                            {hoursToDisplay(remaining)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-zinc-400">
                          <span>Usage: {usagePercent.toFixed(1)}%</span>
                          {isLowHours && <span className="text-amber-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Running low</span>}
                          {isOutOfHours && <span className="text-red-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span> Out of hours</span>}
                        </div>
                        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${isOutOfHours ? 'bg-red-500' : isLowHours ? 'bg-amber-500' : 'bg-brand-500'}`}
                            style={{ width: `${usagePercent}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="md:w-64 shrink-0 bg-zinc-900/30 p-5 rounded-xl border border-zinc-800">
                      <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Capacity
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
                            className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all pr-12"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">hrs</span>
                        </div>
                        <button className="w-full rounded-lg bg-white text-zinc-900 px-4 py-2 font-medium transition-all hover:bg-zinc-200 shadow-sm border border-transparent">
                          Buy Hours via Stripe
                        </button>
                      </form>
                    </div>
                  </div>

                  {projectEntries.length > 0 && (
                    <div className="mt-6 border-t border-zinc-800/60 pt-6">
                      <h4 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">Recent Activity</h4>
                      <div className="overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/20">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50 border-b border-zinc-800">
                              <tr>
                                <th className="px-4 py-3 font-medium">Worker</th>
                                <th className="px-4 py-3 font-medium">Started</th>
                                <th className="px-4 py-3 font-medium">Ended</th>
                                <th className="px-4 py-3 font-medium">Description</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60">
                              {projectEntries.map((entry) => (
                                <tr key={entry.id} className="hover:bg-zinc-800/30 transition-colors">
                                  <td className="px-4 py-3 font-medium text-zinc-200">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400 border border-zinc-700">
                                        {(entry.profiles?.full_name || entry.worker_id || "?")[0].toUpperCase()}
                                      </div>
                                      {entry.profiles?.full_name || entry.worker_id}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-zinc-400">{new Date(entry.started_at).toLocaleString()}</td>
                                  <td className="px-4 py-3">
                                    {entry.ended_at ? (
                                      <span className="text-zinc-400">{new Date(entry.ended_at).toLocaleString()}</span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-brand-500/10 text-brand-400 border border-brand-500/20">
                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
                                        Running
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-zinc-400">{entry.description || <span className="text-zinc-600 italic">No description</span>}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="mt-12 space-y-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          Purchase History
        </h2>
        
        <div className="glass-card rounded-2xl p-6 border border-zinc-800">
          <div className="overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-900/20">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50 border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">Project</th>
                    <th className="px-4 py-3 font-medium">Hours Added</th>
                    <th className="px-4 py-3 font-medium">Amount Paid</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {billingRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">No purchases found.</td>
                    </tr>
                  ) : (
                    billingRows.map((purchase) => {
                      const projectName = customerProjects.find((project) => project.id === purchase.project_id)?.name ?? "Unknown";
                      return (
                        <tr key={purchase.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-zinc-200">{projectName}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                              +{Number(purchase.hours_added).toFixed(2)}h
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-300 font-mono">
                            {(purchase.amount_cents / 100).toFixed(2)} <span className="text-zinc-500 ml-1">{purchase.currency.toUpperCase()}</span>
                          </td>
                          <td className="px-4 py-3 text-zinc-400">{new Date(purchase.created_at).toLocaleString()}</td>
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
