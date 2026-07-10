import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { CentralEntryPanel } from "@/components/admin/CentralEntryPanel";
import {
  Users, Shield, Wrench, LayoutDashboard, ChevronRight, XCircle,
  Building2, Wallet, KeyRound, FileBarChart, IdCard, Lock, TrendingUp,
  AlertCircle, Plus, Download, FileText, DollarSign, Activity, Settings, Zap
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { printInvoiceReceipt } from "@/lib/print-invoice";
import { apiFetch, downloadDbBackup } from "@/lib/api-client";
import { QuickTransactionModal } from "@/components/admin/QuickTransactionModal";
import { useLanguage } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Margalla Gateway — Admin Control Center" }] }),
  component: Dashboard,
});

async function downloadBackup() {
  toast.info("Preparing backup...");
  try {
    await downloadDbBackup();
    toast.success("Local backup downloaded successfully");
  } catch (e: any) {
    toast.error(e.message ?? "Backup failed");
  }
}

function Dashboard() {
  const { lang } = useLanguage();
  const { canSeeFinancials, canManageRent, isOwner } = useRole();
  const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "security" | "maintenance">("dashboard");
  const [suspensions, setSuspensions] = useState<{ id: string; name: string; apartment_no: string; days: number }[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  const [quickTxOpen, setQuickTxOpen] = useState(false);
  const [residents, setResidents] = useState<{ id: string; full_name: string | null; apartment_no: string | null; client_id: string | null }[]>([]);

  const refreshDashboardData = async () => {
    // 1. Reload suspensions
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    try {
      const { data } = await supabase.from("profiles")
        .select("id, full_name, apartment_no, last_billing_date, outstanding_balance")
        .gt("outstanding_balance", 0)
        .lt("last_billing_date", ninetyDaysAgo.toISOString());
      
      if (data) {
        const mapped = data.map((p: any) => {
          const lastDate = new Date(p.last_billing_date!);
          const diffTime = Math.abs(Date.now() - lastDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return {
            id: p.id,
            name: p.full_name || "Resident",
            apartment_no: p.apartment_no || "—",
            days: diffDays,
          };
        });
        setSuspensions(mapped);
      }
    } catch (e) { console.warn(e); }

    // 2. Reload stats
    try {
      const res = await apiFetch<{ stats: any }>("/admin/dashboard/stats");
      if (res && res.stats) setStats(res.stats);
    } catch (err) { console.warn(err); }

    // 3. Reload recent payments
    try {
      const { data } = await supabase
        .from("ledger_entries")
        .select("id, entry_date, description, credit, debit, account_label, apartment_no")
        .order("entry_date", { ascending: false })
        .limit(5);
      if (data) {
        const mapped = data.map((le: any) => {
          const isPayment = Number(le.credit) > 0;
          return {
            tenant: le.account_label || "Resident",
            apt: le.apartment_no || "—",
            amount: `PKR ${Number(isPayment ? le.credit : le.debit).toLocaleString()}`,
            date: le.entry_date,
            status: isPayment ? "Paid" : "Invoiced",
          };
        });
        setRecentPayments(mapped);
      }
    } catch (err) { console.warn(err); }

    // 4. Reload activities
    try {
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(10);
      if (data) setActivities(data);
    } catch (err) { console.warn(err); }

    // 5. Reload residents
    try {
      const res = await apiFetch<{ users: any[] }>("/users");
      if (res && res.users) {
        setResidents(res.users
          .filter((u: any) => u.role === "resident")
          .map((u: any) => ({
            id: u.id,
            full_name: u.full_name,
            apartment_no: u.apartment_no,
            client_id: u.client_id,
            security_deposit: Number(u.security_deposit || 0),
          }))
        );
      }
    } catch (localErr) { console.error(localErr); }
  };

  useEffect(() => {
    refreshDashboardData();
  }, []);

  // Real-time auto-refresh when Central Entry Console posts a transaction
  useEffect(() => {
    const handler = () => refreshDashboardData();
    window.addEventListener("central-entry-submitted", handler);
    return () => window.removeEventListener("central-entry-submitted", handler);
  }, []);

  return (
    <div className="min-h-full bg-[#090d1a] text-slate-100 -m-6 p-6 lg:p-8 font-sans">
      {/* Executive Header */}
      <div className="flex flex-wrap gap-5 justify-between items-center mb-8 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-3xl font-display font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-[#d4af37] drop-shadow-sm">
            MARGALLA GATEWAY
          </h1>
          <p className="text-[9px] text-slate-400 uppercase tracking-[0.35em] font-black mt-1.5 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Executive Administration Suite
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={downloadBackup}
            className="bg-[#131a2d] border border-slate-800 text-slate-300 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:border-[#d4af37]/50 hover:text-[#d4af37] transition duration-300 inline-flex items-center gap-2 h-10 shadow-md cursor-pointer"
          >
            <Download size={14} className="text-[#d4af37]" /> BACKUP DATABASE
          </button>
          <a
            href="/api/download-setup"
            download="Margalla_Gateway_Setup_1.0.0.exe"
            className="bg-[#131a2d] border border-amber-500/30 text-amber-300 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-amber-500/10 hover:border-amber-400 hover:text-amber-100 transition duration-300 inline-flex items-center gap-2 h-10 shadow-lg cursor-pointer"
          >
            <Download size={14} className="text-amber-400" /> DOWNLOAD LATEST DESKTOP SETUP
          </a>
          <button
            onClick={() => window.dispatchEvent(new Event("open-central-entry"))}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 border border-blue-500/30 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:from-blue-500 hover:to-indigo-500 hover:text-white hover:border-blue-400 transition duration-300 inline-flex items-center gap-2 h-10 shadow-[0_4px_15px_rgba(59,130,246,0.2)] cursor-pointer"
          >
            <Zap size={14} className="text-yellow-400 animate-pulse" />
            <span>{lang === "ur" ? "سینٹرل انٹری کونسول" : "Central Entry Console"}</span>
          </button>

          <Link
            to="/admin/credentials"
            className="bg-gradient-to-r from-amber-500 to-[#d4af37] text-black px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:from-amber-600 hover:to-[#b8962e] transition duration-300 shadow-[0_4px_15px_rgba(212,175,55,0.15)] inline-flex items-center gap-2 h-10"
          >
            <Plus size={14} /> ADD NEW RESIDENT
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <div className="col-span-1 space-y-2.5">
          <NavBtn icon={<LayoutDashboard size={16} />} label="Overview Panel" active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} />
          <NavBtn icon={<Users size={16} />} label="Accounts Registry" active={activeTab === "users"} onClick={() => setActiveTab("users")} />
          <NavBtn icon={<Shield size={16} />} label="Security Deposits" active={activeTab === "security"} onClick={() => setActiveTab("security")} />
          <NavBtn icon={<Wrench size={16} />} label="Maintenance Center" active={activeTab === "maintenance"} onClick={() => setActiveTab("maintenance")} />
        </div>

        {/* Main Content Area */}
        <div className="col-span-1 lg:col-span-3 bg-[#111625] border border-slate-800/80 rounded-3xl p-6 lg:p-8 shadow-2xl shadow-black/40 space-y-8">
          
          {activeTab === "dashboard" && (
            <div className="space-y-8 animate-fade-in">
              
              {/* Flashing Service Suspension Alerts */}
              {suspensions.length > 0 && (
                <div className="p-4 bg-rose-950/20 border border-rose-500/20 text-rose-400 rounded-2xl flex flex-col gap-2.5 shadow-lg shadow-rose-950/20">
                  <div className="flex items-center gap-2 font-black uppercase text-[10px] tracking-widest">
                    <AlertCircle size={15} className="text-rose-500 animate-pulse" />
                    Utility Suspension Warning Dues Limit Exceeded
                  </div>
                  <div className="text-xs space-y-2 font-mono text-slate-300">
                    {suspensions.map((c) => (
                      <div key={c.id} className="flex justify-between items-center border-b border-slate-800/30 pb-1.5 last:border-0 last:pb-0">
                        <span className="font-semibold text-slate-200">Apt {c.apartment_no} — {c.name}</span>
                        <span className="text-rose-500 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">{c.days} Days Overdue</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Profit & Loss Section */}
              {canSeeFinancials && (
                <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-[#161c2e] to-[#111625] p-6 shadow-xl relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/5 rounded-full filter blur-xl pointer-events-none" />
                  <div className="flex items-center justify-between mb-5 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-[#d4af37]" />
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-[#d4af37]">Profit & Loss Statement (Encrypted Ledger)</h3>
                    </div>
                    <span className="text-[8px] bg-amber-500/10 text-[#d4af37] border border-amber-500/20 px-2 py-0.5 rounded font-black tracking-wider uppercase">Owner View</span>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-6">
                    <div className="p-4 bg-black/10 rounded-xl border border-slate-800/30">
                      <div className="text-[9px] text-slate-400 uppercase tracking-widest mb-2 font-black">Gross Revenue</div>
                      <div className="font-mono text-2xl font-bold text-slate-200">PKR {(stats?.revenue ?? 0).toLocaleString()}</div>
                    </div>
                    <div className="p-4 bg-black/10 rounded-xl border border-slate-800/30">
                      <div className="text-[9px] text-slate-400 uppercase tracking-widest mb-2 font-black">Operational Expenses</div>
                      <div className="font-mono text-2xl font-bold text-slate-200">PKR {(stats?.expenses ?? 0).toLocaleString()}</div>
                    </div>
                    <div className="p-4 bg-black/15 rounded-xl border border-amber-500/10">
                      <div className="text-[9px] text-[#d4af37] uppercase tracking-widest mb-2 font-black">Net Income</div>
                      <div className={`font-mono text-2xl font-black flex items-center gap-1.5 ${
                        (stats?.netProfit ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        <TrendingUp className="h-5 w-5" />
                        PKR {(stats?.netProfit ?? 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Stats Grid */}
              <div className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#d4af37] border-l-2 border-[#d4af37] pl-3">
                  Property Inventory Status
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatBox label="Total Units" value={String(stats?.totalUnits ?? 0)} />
                  <StatBox label="Occupied Units" value={String(stats?.occupied ?? 0)} color="text-emerald-400" />
                  <StatBox label="Available Units" value={String(stats?.available ?? 0)} color="text-amber-400" />
                  {canManageRent && <StatBox label="Expected Rent/Mo" value={`PKR ${(stats?.monthlyIncome ?? 0).toLocaleString()}`} color="text-[#d4af37]" />}
                </div>
              </div>

              {/* Pending Collections Card */}
              {canManageRent && (
                <div className="p-6 bg-gradient-to-br from-rose-950/10 to-rose-950/2 border border-rose-500/10 rounded-2xl shadow-lg relative overflow-hidden">
                  <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-rose-500/5 to-transparent pointer-events-none" />
                  <div className="flex items-center justify-between text-rose-400 mb-3">
                    <h3 className="font-black flex items-center gap-2 uppercase text-xs tracking-wider">
                      <XCircle size={15} /> Pending Collections
                    </h3>
                    <span className="text-[9px] bg-rose-500/15 border border-rose-500/25 text-rose-400 px-2.5 py-0.5 rounded-md font-black uppercase tracking-wider">
                      Deadline: 5th of Month
                    </span>
                  </div>
                  <p className="text-3xl font-mono font-black text-rose-400 drop-shadow-[0_2px_10px_rgba(244,63,94,0.1)]">PKR {(stats?.pendingCollections ?? 0).toLocaleString()}/-</p>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Electricity, Sui Gas, and flat rent charges are still outstanding for <span className="text-rose-400 font-bold font-mono">{stats?.overdueCount ?? 0}</span> apartments.
                  </p>
                </div>
              )}

              {/* Quick Actions */}
              <div className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#d4af37] border-l-2 border-[#d4af37] pl-3">
                  System Quick Actions
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {isOwner && <QuickLink to="/admin/credentials" icon={<KeyRound size={15} />} label="Authorize Resident Credentials" />}
                  {canManageRent && <QuickLink to="/admin/financial-ledger" icon={<FileBarChart size={15} />} label="Generate Statements & Reports" />}
                  <QuickLink to="/admin/directory" icon={<IdCard size={15} />} label="Resident Directory Book" />
                  <QuickLink to="/admin/apartments" icon={<Building2 size={15} />} label="Manage Properties & Units" />
                  <QuickLink to="/admin/daily-rent" icon={<Wallet size={15} />} label="Daily Guest Bookings" />
                  <button
                    onClick={() => window.dispatchEvent(new Event("open-central-entry"))}
                    className="flex items-center gap-4 px-5 py-4 bg-[#0d1a33] border border-blue-900/50 rounded-2xl hover:border-blue-500/40 hover:bg-[#102040] transition duration-300 text-xs text-blue-300 hover:text-white font-bold uppercase tracking-wider group shadow-md text-left cursor-pointer"
                  >
                    <span className="text-blue-400 bg-blue-500/10 p-2.5 rounded-xl group-hover:bg-blue-500/20 transition duration-300"><Zap size={15} /></span>
                    <span>Central Entry Console</span>
                    <ChevronRight size={14} className="ml-auto text-slate-500 group-hover:text-white transition group-hover:translate-x-1" />
                  </button>
                </div>
              </div>

              {/* Recent Payments and Activity Timeline */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 border-t border-slate-800/60">
                {/* Recent Payments */}
                <div className="space-y-4">
                  <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#d4af37] border-l-2 border-[#d4af37] pl-3">
                    Recent Payments Log
                  </h2>
                  <div className="overflow-hidden border border-slate-800/60 rounded-2xl bg-black/10">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-[9px] text-slate-500 uppercase tracking-widest bg-black/45">
                          <th className="p-3.5">Tenant</th>
                          <th className="p-3.5">Unit</th>
                          <th className="p-3.5">Amount</th>
                          <th className="p-3.5 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentPayments.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-xs text-slate-500">No payment logs recorded.</td>
          </tr>
                        ) : (
                          recentPayments.map((p, i) => (
                            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20 text-xs transition-colors">
                              <td className="p-3.5 font-medium text-slate-200">{p.tenant}</td>
                              <td className="p-3.5 text-slate-400 font-bold font-mono">{p.apt}</td>
                              <td className="p-3.5 font-mono font-bold text-slate-300">{p.amount}</td>
                              <td className="p-3.5 text-right">
                                <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${
                                  p.status === "Paid" 
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                }`}>{p.status}</span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Activity Timeline */}
                <div className="space-y-4">
                  <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#d4af37] border-l-2 border-[#d4af37] pl-3">
                    System Audit Logs
                  </h2>
                  <div className="border border-slate-800/60 rounded-2xl bg-black/15 p-5 space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar">
                    {activities.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">No system activities logged.</p>
                    ) : (
                      activities.map((act) => {
                        const isInsert = act.action?.includes("INSERT");
                        const isUpdate = act.action?.includes("UPDATE");
                        const isDelete = act.action?.includes("DELETE");
                        
                        let badgeColor = "bg-slate-800/55 text-slate-400 border border-slate-700/30";
                        if (isInsert) badgeColor = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                        else if (isUpdate) badgeColor = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
                        else if (isDelete) badgeColor = "bg-rose-500/10 text-rose-400 border border-rose-500/20";

                        return (
                          <div key={act.id} className="relative pl-6 border-l border-slate-800 py-1">
                            <div className="absolute -left-[5px] top-2.5 h-2.5 w-2.5 rounded-full bg-[#d4af37] border-2 border-[#111625]" />
                            <div className="flex justify-between items-center mb-1 gap-2 flex-wrap">
                              <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${badgeColor}`}>
                                {act.action}
                              </span>
                              <span className="font-mono text-[9px] text-slate-500">
                                {act.timestamp ? (
                                  (() => {
                                    const d = new Date(act.timestamp);
                                    return isNaN(d.getTime()) ? act.timestamp : `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                                  })()
                                ) : "—"}
                              </span>
                            </div>
                            <p className="text-slate-400 text-[11px] leading-relaxed font-semibold">{act.details}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <h2 className="text-[#d4af37] text-xs font-black uppercase tracking-widest">Personnel Accounts Registry</h2>
                <Link to="/admin/staff" className="text-xs text-[#d4af37] hover:underline font-bold">Manage Shift Rotations →</Link>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">Modify permissions, shift timings, duties, security scopes, and staff logins.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <QuickLink to="/admin/staff" icon={<Users size={14} />} label="Staff Payroll & Duties" />
                <QuickLink to="/admin/credentials" icon={<KeyRound size={14} />} label="Resident Credentials Directory" />
                <QuickLink to="/admin/access-control" icon={<Shield size={14} />} label="Access & Scopes Registry" />
                <QuickLink to="/admin/tenants" icon={<IdCard size={14} />} label="Tenants Roster" />
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-[#d4af37] text-xs font-black uppercase tracking-widest border-b border-slate-800 pb-4">
                Security Deposit Registry
              </h2>
              {residents.filter(r => (r as any).security_deposit > 0).length === 0 ? (
                <div className="bg-black/20 p-6 rounded-2xl border border-slate-800 text-center text-slate-500 text-xs font-medium">
                  No active security deposits held in database.
                </div>
              ) : (
                residents.filter(r => (r as any).security_deposit > 0).map(r => (
                  <div key={r.id} className="bg-black/20 p-5 rounded-2xl border border-slate-800 border-l-4 border-emerald-500 flex justify-between items-center mb-3">
                    <div>
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest font-black">Unit {r.apartment_no || "—"} — Refundable Security</p>
                      <p className="text-sm font-bold text-slate-200 mt-1">{r.full_name}</p>
                      <p className="text-base font-mono text-emerald-400 font-bold mt-1.5">PKR {Number((r as any).security_deposit).toLocaleString()} Held</p>
                    </div>
                    <button 
                      onClick={async () => {
                        try {
                          await apiFetch('/query-bridge', {
                            method: 'POST',
                            body: JSON.stringify({
                              table: 'tenants',
                              action: 'update',
                              filters: [{ column: 'id', value: r.id }],
                              data: { security_deposit: 0 }
                            })
                          });
                          toast.success(`Security deposit refunded for Unit ${r.apartment_no}`);
                          refreshDashboardData();
                        } catch (e) {
                          toast.error("Failed to refund security deposit");
                        }
                      }}
                      className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-black uppercase tracking-wider transition cursor-pointer"
                    >
                      Process Refund
                    </button>
                  </div>
                ))
              )}
              <p className="text-[10px] text-slate-500 italic leading-relaxed">
                * Note: Security deposits are held in escrow accounts and returned upon lease termination checkups.
              </p>
            </div>
          )}

          {activeTab === "maintenance" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <h2 className="text-[#d4af37] text-xs font-black uppercase tracking-widest">Maintenance Ticket Center</h2>
                <Link to="/admin/complaints" className="text-xs text-[#d4af37] hover:underline font-bold">Complaints Board →</Link>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">Review incoming resident complaints, repairs costs, and assign technicians.</p>
              <QuickLink to="/admin/complaints" icon={<Wrench size={14} />} label="Open Complaints Ticket Board" />
            </div>
          )}

        </div>
      </div>

      <CentralEntryPanel />
    </div>
  );
}

function NavBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-5 py-4 rounded-xl transition-all duration-300 group cursor-pointer ${
        active 
          ? "bg-gradient-to-r from-amber-500 to-[#d4af37] text-[#0b0f19] font-black shadow-lg shadow-amber-500/10" 
          : "hover:bg-white/5 border border-transparent hover:border-slate-800/30 text-slate-400 hover:text-white"
      }`}
    >
      <div className="flex items-center gap-3.5 font-bold uppercase tracking-wider text-xs">
        {icon} <span>{label}</span>
      </div>
      <ChevronRight size={14} className={active ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity"} />
    </button>
  );
}

function StatBox({ label, value, color = "text-white" }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#141b2e]/50 border border-slate-800/80 p-5 rounded-2xl hover:border-[#d4af37]/30 hover:bg-[#1b253f] transition-all duration-300 shadow-md group relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-0 bg-[#d4af37] group-hover:h-full transition-all duration-300" />
      <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-2 font-black">{label}</p>
      <p className={`text-2xl font-black font-mono tracking-tight ${color}`}>{value}</p>
    </div>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 px-5 py-4 bg-[#141b2e] border border-slate-800/80 rounded-2xl hover:border-[#d4af37]/30 hover:bg-[#1b253f] transition-all duration-300 text-xs text-slate-300 hover:text-white font-bold uppercase tracking-wider group shadow-md"
    >
      <span className="text-[#d4af37] bg-[#d4af37]/10 p-2.5 rounded-xl group-hover:bg-[#d4af37]/20 transition duration-300">{icon}</span>
      <span>{label}</span>
      <ChevronRight size={14} className="ml-auto text-slate-500 group-hover:text-white transition group-hover:translate-x-1" />
    </Link>
  );
}
