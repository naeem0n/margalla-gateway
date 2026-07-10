import { Bell, Search, CheckCircle, Loader2, WifiOff, PlusCircle, RefreshCw, Sun, Moon, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LanguageSwitcher } from "@/components/site/LanguageSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { QuickTransactionModal } from "./QuickTransactionModal";
import { rawSupabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export function AdminTopbar({ title }: { title: string }) {
  const { lang } = useLanguage();
  const { user, isAdmin } = useAuth();
  const { profile } = useProfile();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const inAdmin = path.startsWith("/admin");
  const inPartner = path.startsWith("/partner");
  // Force role label by current panel so admin panel never shows "Resident".
  const panelDefaultName = inAdmin ? "Admin" : inPartner ? "Partner" : "Resident";
  const panelRoleLabel = inAdmin ? "Super Admin" : inPartner ? "3rd Party" : "Resident";
  const displayName = profile?.full_name || user?.email || panelDefaultName;
  const roleLabel = inAdmin
    ? "Super Admin"
    : profile?.client_id
    ? `ID ${profile.client_id}`
    : panelRoleLabel;
  void isAdmin;
  const initial = (displayName[0] || panelDefaultName[0]).toUpperCase();

  const [syncStatus, setSyncStatus] = useState<{ pendingCount: number; errorCount: number; isOnline: boolean } | null>(null);
  const [quickTxOpen, setQuickTxOpen] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const activeTheme = (localStorage.getItem("theme") as "dark" | "light") || "dark";
      setTheme(activeTheme);
      if (activeTheme === "light") {
        document.documentElement.classList.add("light");
      } else {
        document.documentElement.classList.remove("light");
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    if (nextTheme === "light") {
      document.documentElement.classList.add("light");
      toast.success("Professional Light Theme active");
    } else {
      document.documentElement.classList.remove("light");
      toast.success("Gold Luxury Dark Theme active");
    }
  };

  const handleManualSync = async () => {
    if (isManualSyncing) return;
    setIsManualSyncing(true);
    const toastId = toast.loading("Syncing data to website database...");
    
    try {
      // 1. Fetch local invoices from SQLite using query-bridge
      const invRes = await apiFetch<{ data: any[] }>("/query-bridge", { 
        method: 'POST', 
        body: JSON.stringify({ table: 'invoices', action: 'select' }) 
      });
      
      // 2. Fetch local users from SQLite
      const usersRes = await apiFetch<{ users: any[] }>("/users");

      // 3. Sync resident profiles to Supabase profiles table
      const residents = (usersRes.users || []).filter((u: any) => u.role === "resident");
      const profilesPayload = residents.map((u: any) => ({
        id: u.id,
        full_name: u.full_name,
        apartment_no: u.apartment_no,
        phone: u.phone || u.mobile || null,
        rent_amount: u.rent_amount || 0,
        client_id: u.client_id
      }));

      if (profilesPayload.length > 0) {
        const { error: profErr } = await rawSupabase.from("profiles").upsert(profilesPayload, { onConflict: "id" });
        if (profErr) throw profErr;
      }

      // 4. Sync invoices to Supabase payment_requests table
      const invoicesPayload = (invRes.data || []).map((inv: any) => ({
        id: `local_inv_${inv.id}`,
        resident_id: inv.tenant_id,
        apartment_no: inv.apartment_no,
        bill_type: "utility",
        category: "Monthly Utility Bill",
        type: "debit",
        amount: Number(inv.total_bill_amount || 0),
        due_date: inv.date || new Date().toISOString().slice(0, 10),
        status: Number(inv.amount_received || 0) >= Number(inv.total_bill_amount || 0) ? "approved" : "pending",
        note: `Monthly Invoice #${inv.invoice_no || inv.id}. Elec Units: ${inv.units_consumed || 0}, Elec Cost: ${inv.electricity_amount || 0}, Gas Cost: ${inv.gas_charges || 0}, Rent: ${inv.flat_rent || 0}, Maint: ${inv.maintenance_charges || 0}`,
        created_at: inv.date ? new Date(inv.date).toISOString() : new Date().toISOString()
      }));

      if (invoicesPayload.length > 0) {
        const { error: invErr } = await rawSupabase.from("payment_requests").upsert(invoicesPayload, { onConflict: "id" });
        if (invErr) throw invErr;
      }

      // 5. Sync announcements to Supabase announcements table
      const annRes = await apiFetch<{ data: any[] }>("/query-bridge", { 
        method: 'POST', 
        body: JSON.stringify({ table: 'announcements', action: 'select' }) 
      });
      
      const announcementsPayload = (annRes.data || []).map((ann: any) => ({
        id: ann.id,
        title: ann.title,
        body: ann.body,
        is_active: ann.is_active === 1 || ann.is_active === true,
        created_by: null, // Set to null to satisfy UUID constraint if local admin is not UUID
        created_at: ann.created_at ? new Date(ann.created_at).toISOString() : new Date().toISOString(),
        updated_at: ann.updated_at ? new Date(ann.updated_at).toISOString() : new Date().toISOString()
      }));

      if (announcementsPayload.length > 0) {
        const { error: annErr } = await rawSupabase.from("announcements").upsert(announcementsPayload, { onConflict: "id" });
        if (annErr) {
          console.warn("Supabase public.announcements upsert failed, attempting tower_announcements fallback...", annErr);
          // Try syncing to tower_announcements as fallback
          const towerPayload = (annRes.data || []).map((ann: any, index: number) => ({
            title: ann.title,
            message: ann.body,
            posted_by: "System Admin"
          }));
          await rawSupabase.from("tower_announcements").upsert(towerPayload);
        }
      }

      toast.success("Website synchronization completed successfully!", { id: toastId });
    } catch (err: any) {
      console.error("Website sync failed:", err);
      const isFetchErr = String(err).includes("Failed to fetch") || (err && String(err.message).includes("Failed to fetch"));
      const friendlyMsg = isFetchErr 
        ? "Network offline or Supabase project is paused/deleted. Please check your internet or unpause the project on supabase.com."
        : (err?.message || String(err));
      toast.error(`Website sync failed: ${friendlyMsg}`, { id: toastId });
    } finally {
      setIsManualSyncing(false);
    }
  };

  // Spotlight search states
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{
    residents: any[];
    apartments: any[];
    ledger: any[];
    staff: any[];
    complaints: any[];
  } | null>(null);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    async function checkStatus() {
      try {
        const res = await apiFetch<{ pendingCount: number; errorCount: number; isOnline: boolean }>("/sync/client-status");
        if (active) setSyncStatus(res);
      } catch (err) {
        if (active) {
          setSyncStatus({ pendingCount: 0, errorCount: 0, isOnline: false });
        }
      }
    }
    
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    if (!inAdmin) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inAdmin]);

  // Fetch results when query changes
  useEffect(() => {
    if (!query) {
      setResults(null);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiFetch<any>(`/admin/search?q=${encodeURIComponent(query)}`);
        if (res && res.success) {
          setResults(res.results);
        }
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  const handleItemClick = (to: string) => {
    setOpen(false);
    setQuery("");
    navigate({ to });
  };

  const renderSyncButton = () => {
    return (
      <button
        onClick={handleManualSync}
        disabled={isManualSyncing}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-[#d4af37] hover:bg-amber-500/20 text-xs font-bold transition shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer font-display"
        title="Sync resident profiles and utility bills to the website database"
      >
        {isManualSyncing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5 text-amber-600 dark:text-[#d4af37]" />
        )}
        <span>Sync with Website</span>
      </button>
    );
  };

  const renderSyncIndicator = () => {
    if (!syncStatus) return null;
    
    let icon = <CheckCircle className="h-4 w-4 text-emerald-500" />;
    let label = "Synced";
    let tooltip = "Local database is fully synced to Supabase cloud";

    if (!syncStatus.isOnline) {
      icon = <WifiOff className="h-4 w-4 text-zinc-400" />;
      label = "Offline Mode";
      tooltip = "Local changes will be queued and pushed when cloud is reachable";
    } else if (syncStatus.pendingCount > 0) {
      icon = <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />;
      label = `Syncing (${syncStatus.pendingCount})`;
      tooltip = `Pushing ${syncStatus.pendingCount} local updates to the cloud...`;
    }

    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/40 border border-border/40 text-xs font-medium cursor-default transition-all" title={tooltip}>
        {icon}
        <span className="hidden md:inline text-muted-foreground">{label}</span>
      </div>
    );
  };

  return (
    <header className="border-b border-border/60 bg-card/40 backdrop-blur-sm">
      <div className="h-16 flex items-center justify-between px-6 gap-4">
        <h1 className="font-display text-2xl">{title}</h1>
        <div className="flex items-center gap-3">
          {inAdmin && (
            <>
              <div className="relative hidden md:block cursor-pointer" onClick={() => setOpen(true)}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search... (Ctrl+K)" className="pl-9 w-64 bg-input/60 cursor-pointer" readOnly />
              </div>
              <button
                onClick={() => window.dispatchEvent(new Event("open-central-entry"))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer font-display"
              >
                <Zap className="h-3.5 w-3.5 text-yellow-500 animate-pulse" />
                <span>{lang === "ur" ? "سینٹرل انٹری" : "Central Entry"}</span>
              </button>
              {renderSyncButton()}
              {renderSyncIndicator()}
            </>
          )}
          <button className="relative p-2 rounded-md hover:bg-muted">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
          >
            {theme === "dark" ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-blue-500" />}
          </button>
          <LanguageSwitcher />
          <div className="flex items-center gap-2 pl-3 border-l border-border/60">
            <div className="h-9 w-9 rounded-full gradient-gold flex items-center justify-center text-primary-foreground font-semibold text-sm">{initial}</div>
            <div className="text-xs hidden md:block">
              <div className="font-medium truncate max-w-[140px]">{displayName}</div>
              <div className="text-muted-foreground">{roleLabel}</div>
            </div>
          </div>
        </div>
      </div>
      {inAdmin && !user && (
        <div className="px-6 py-1.5 text-[11px] bg-warning/10 border-t border-warning/20 text-warning flex items-center gap-2">
          <span className="font-semibold uppercase tracking-wider">Demo Mode</span>
          <span className="opacity-80">Auth disabled — all admin actions run as anon. Re-enable login before launch.</span>
        </div>
      )}

      {/* Global Spotlight Search Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-[#0b0f19] border border-slate-800/80 text-white p-0 overflow-hidden shadow-2xl rounded-xl">
          <div className="flex items-center border-b border-slate-800/80 p-4">
            <Search className="h-5 w-5 text-slate-400 mr-3" />
            <input
              autoFocus
              placeholder="Search residents, apartments, staff, complaints, ledgers..."
              className="bg-transparent border-none outline-none text-white w-full text-base placeholder:text-slate-500 focus:ring-0"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
            {searching && (
              <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#d4af37]" />
                <span>Searching...</span>
              </div>
            )}
            {!searching && !query && (
              <div className="text-center py-8 text-slate-500 text-sm">
                Type resident name, flat number, CNIC, or staff name to search...
              </div>
            )}
            {!searching && query && results && (
              <>
                {/* Residents */}
                {results.residents && results.residents.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-[#d4af37] font-semibold mb-2 border-b border-slate-800/40 pb-1">Residents / Tenants</h3>
                    <div className="space-y-1">
                      {results.residents.map((r: any) => (
                        <div
                          key={r.id}
                          onClick={() => handleItemClick(`/admin/ledger/tenant/${r.id}`)}
                          className="flex justify-between items-center p-2.5 rounded-md hover:bg-slate-800/50 cursor-pointer transition"
                        >
                          <div>
                            <div className="font-semibold text-slate-200">{r.full_name}</div>
                            <div className="text-xs text-slate-400">ID: {r.client_id} · CNIC: {r.cnic || "—"} · Phone: {r.phone || "—"}</div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded">
                              Apt {r.apartment_no || "—"}
                            </span>
                            {Number(r.outstanding_balance) > 0 && (
                              <div className="text-xs text-red-400 font-mono mt-1 font-semibold">
                                PKR {Number(r.outstanding_balance).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Apartments */}
                {results.apartments && results.apartments.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-[#d4af37] font-semibold mb-2 border-b border-slate-800/40 pb-1">Apartments</h3>
                    <div className="space-y-1">
                      {results.apartments.map((a: any) => (
                        <div
                          key={a.id}
                          onClick={() => handleItemClick("/admin/apartments")}
                          className="flex justify-between items-center p-2.5 rounded-md hover:bg-slate-800/50 cursor-pointer transition"
                        >
                          <div>
                            <div className="font-semibold text-slate-200">Unit {a.number}</div>
                            <div className="text-xs text-slate-400">Owner: {a.owner_name} · Rent: PKR {Number(a.rent).toLocaleString()}</div>
                          </div>
                          <div>
                            <span className={`text-xs px-2 py-0.5 rounded uppercase font-semibold ${
                              a.status === "occupied" ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"
                            }`}>{a.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Staff */}
                {results.staff && results.staff.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-[#d4af37] font-semibold mb-2 border-b border-slate-800/40 pb-1">Staff Registry</h3>
                    <div className="space-y-1">
                      {results.staff.map((s: any) => (
                        <div
                          key={s.id}
                          onClick={() => handleItemClick(`/admin/ledger/staff/${s.id}`)}
                          className="flex justify-between items-center p-2.5 rounded-md hover:bg-slate-800/50 cursor-pointer transition"
                        >
                          <div>
                            <div className="font-semibold text-slate-200">{s.full_name}</div>
                            <div className="text-xs text-slate-400">Role: {s.role} · CNIC: {s.cnic || "—"} · Phone: {s.phone || "—"}</div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono bg-slate-900 border border-slate-800 text-[#d4af37] px-2 py-0.5 rounded">
                              PKR {Number(s.salary).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Complaints */}
                {results.complaints && results.complaints.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-[#d4af37] font-semibold mb-2 border-b border-slate-800/40 pb-1">Complaints</h3>
                    <div className="space-y-1">
                      {results.complaints.map((c: any) => (
                        <div
                          key={c.id}
                          onClick={() => handleItemClick("/admin/complaints")}
                          className="flex justify-between items-center p-2.5 rounded-md hover:bg-slate-800/50 cursor-pointer transition"
                        >
                          <div>
                            <div className="font-semibold text-slate-200 truncate max-w-[280px] md:max-w-md">{c.title}</div>
                            <div className="text-xs text-slate-400 font-mono">Category: {c.category} · Priority: {c.priority}</div>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs px-2 py-0.5 rounded uppercase font-semibold ${
                              c.status === "open" ? "bg-amber-500/20 text-amber-400" : "bg-slate-500/20 text-slate-400"
                            }`}>{c.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ledger Entries */}
                {results.ledger && results.ledger.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-widest text-[#d4af37] font-semibold mb-2 border-b border-slate-800/40 pb-1">Ledger Entries</h3>
                    <div className="space-y-1">
                      {results.ledger.map((le: any) => (
                        <div
                          key={le.id}
                          onClick={() => handleItemClick(`/admin/ledger/${le.entry_type}/${le.user_id}`)}
                          className="flex justify-between items-center p-2.5 rounded-md hover:bg-slate-800/50 cursor-pointer transition"
                        >
                          <div>
                            <div className="font-semibold text-slate-200 truncate max-w-[280px] md:max-w-md">{le.description}</div>
                            <div className="text-xs text-slate-400 font-mono">Date: {le.entry_date} · Type: {le.entry_type}</div>
                          </div>
                          <div className="text-right">
                            {Number(le.debit) > 0 && <span className="text-xs text-red-400 font-semibold font-mono">DR: {Number(le.debit).toLocaleString()}</span>}
                            {Number(le.credit) > 0 && <span className="text-xs text-green-400 font-semibold font-mono">CR: {Number(le.credit).toLocaleString()}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty check */}
                {(!results.residents || results.residents.length === 0) &&
                 (!results.apartments || results.apartments.length === 0) &&
                 (!results.staff || results.staff.length === 0) &&
                 (!results.complaints || results.complaints.length === 0) &&
                 (!results.ledger || results.ledger.length === 0) && (
                   <div className="text-center py-8 text-slate-500 text-sm">
                     No matches found for "{query}"
                   </div>
                 )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
