import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState, FormEvent } from "react";
import { ResidentLayout } from "@/components/resident/ResidentLayout";
import { RentalPolicy } from "@/components/site/RentalPolicy";
import { StatCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Calendar, Receipt, Bell, Award, AlertTriangle, Car, Megaphone, Home, Loader2, Wrench, Plus, Check, Shield } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { hasResidentAccess, grantResidentAccess } from "@/lib/resident-gate";
import { apiLogin, apiPhoneLogin, apiMe, getToken, isDesktopApp, apiFetch, apiChangeInitialPassword } from "@/lib/api-client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("mgt_api_token");
      const residentGate = sessionStorage.getItem("mgt_resident_gate") === "1";
      const hasSupabaseToken = Object.keys(localStorage).some(
        (key) => key.startsWith("sb-") && key.endsWith("-auth-token")
      );
      if (!token && !residentGate && !hasSupabaseToken) {
        throw redirect({ to: "/welcome" });
      }
    }
  },
  head: () => ({ meta: [{ title: "Resident Portal — Margalla Gateway" }] }),
  component: ResidentHome,
});

type Announcement = { id: string; title: string; body: string; created_at: string };
type ResidentStats = { reward_points: number; warning_count: number; extra_parking_spots: number; outstanding_balance?: number };

function ResidentLogin({ onSuccess }: { onSuccess: () => void }) {
  const [loginMode, setLoginMode] = useState<"standard" | "phone">(isDesktopApp() ? "standard" : "phone");
  const [clientId, setClientId] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [changePasswordState, setChangePasswordState] = useState<{ userId: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (loginMode === "phone") {
        if (!clientId || !phone) throw new Error("Client ID and Phone number are required");
        try {
          const { user } = await apiPhoneLogin(clientId.trim(), phone.trim(), "resident");
          if (user.role !== "resident") throw new Error("Resident credentials required");
        } catch (localErr) {
          if (isDesktopApp()) {
            throw localErr;
          }
          throw new Error("Phone Login is only available in the secure Desktop App. Please use 'ID & Password' login on the website.");
        }
      } else {
        try {
          // Attempt local SQLite authentication first
          const { user } = await apiLogin(clientId.trim(), password, "resident");
          if (user.role !== "resident") throw new Error("Resident credentials required");
        } catch (localErr: any) {
          if (localErr.message === "REQUIRE_PASSWORD_CHANGE") {
            setChangePasswordState({ userId: localErr.user_id });
            return;
          }
          // Fallback to Supabase if not on desktop app or if local auth fails
          if (isDesktopApp()) {
            throw localErr;
          }
          const loginEmail = clientId.includes("@")
            ? clientId.trim()
            : `${clientId.trim().toLowerCase()}@margalla.local`;
          const { error } = await supabase.auth.signInWithPassword({
            email: loginEmail,
            password,
          });
          if (error) throw error;
        }
      }
      toast.success("Welcome home");
      grantResidentAccess();
      localStorage.removeItem("mgt_impersonating");
      localStorage.removeItem("mgt_impersonate_target");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      await apiChangeInitialPassword(changePasswordState!.userId, password, newPassword);
      toast.success("Password updated successfully. Welcome home!");
      grantResidentAccess();
      localStorage.removeItem("mgt_impersonating");
      localStorage.removeItem("mgt_impersonate_target");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setBusy(false);
    }
  };

  if (changePasswordState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <form onSubmit={handlePasswordChange} className="w-full max-w-md bg-card border border-border/60 rounded-xl p-8 space-y-4 shadow-elegant">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl">Set New Password</h1>
          </div>
          <p className="text-sm text-muted-foreground">For security, you must change your temporary password before accessing your account.</p>
          <div>
            <Label>New Password</Label>
            <Input type="password" minLength={8} className="mt-1" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div>
            <Label>Confirm Password</Label>
            <Input type="password" minLength={8} className="mt-1" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving…</> : "Update Password & Login"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-md bg-card border border-border/60 rounded-xl p-8 space-y-4 shadow-elegant">
        <div className="flex items-center gap-2 mb-2">
          <Home className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl">Resident Portal</h1>
        </div>
        <p className="text-sm text-muted-foreground">Sign in to access your dashboard.</p>

        <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg border border-border/40">
          <button
            type="button"
            onClick={() => setLoginMode("phone")}
            className={`py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              loginMode === "phone" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Phone Login
          </button>
          <button
            type="button"
            onClick={() => setLoginMode("standard")}
            className={`py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              loginMode === "standard" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ID & Password
          </button>
        </div>

        <div>
          <Label>Resident ID / Client ID (e.g. RES-XXXX)</Label>
          <Input className="mt-1 font-mono" value={clientId} onChange={(e) => setClientId(e.target.value)} required placeholder="RES-101" />
        </div>

        {loginMode === "phone" ? (
          <div>
            <Label>Registered Phone Number</Label>
            <Input type="tel" className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="e.g. 03001234567" />
          </div>
        ) : (
          <div>
            <Label>Password</Label>
            <Input type="password" className="mt-1" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
        )}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Signing in…</> : "Enter Portal"}
        </Button>
        <Link to="/welcome" className="block text-center text-xs text-muted-foreground hover:text-primary">← Back to site</Link>
      </form>
    </div>
  );
}

function ResidentHome() {
  const { profile } = useProfile();
  const { user } = useAuth();
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState<ResidentStats>({ reward_points: 0, warning_count: 0, extra_parking_spots: 0 });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [apiUser, setApiUser] = useState<{ id: string; full_name: string; apartment_no: string | null; client_id: string; permissions_json?: string } | null>(null);
  const [siteContent, setSiteContent] = useState<Record<string, string>>({});
  const [lastPayment, setLastPayment] = useState<number | null>(null);
  const [nextDue, setNextDue] = useState<{ amount: number; due_date: string } | null>(null);

  // Delegated access permissions state
  const [perms, setPerms] = useState({
    canManageUtilities: false,
    canCreateAnnouncements: false,
    canResolveComplaints: false,
  });

  // Modal open states
  const [utilitiesModalOpen, setUtilitiesModalOpen] = useState(false);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [complaintsModalOpen, setComplaintsModalOpen] = useState(false);

  // Utilities Dues Form State
  const [residents, setResidents] = useState<any[]>([]);
  const [selectedResId, setSelectedResId] = useState("");
  const [gasUnits, setGasUnits] = useState("");
  const [waterUnits, setWaterUnits] = useState("");
  const [electricityUnits, setElectricityUnits] = useState("");
  const [fixedMaintenance, setFixedMaintenance] = useState("");
  const [submittingUtility, setSubmittingUtility] = useState(false);

  // Announcements Form State
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [submittingAnn, setSubmittingAnn] = useState(false);

  // Complaints Resolver Board State
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loadingComplaints, setLoadingComplaints] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    if (isDesktopApp() && getToken()) {
      apiMe().then(({ user }) => {
        setApiUser(user);
        setAuthed(user.role === "resident");
      }).catch(() => setAuthed(false));
    } else if (user) {
      setAuthed(true);
    }
  }, [user]);

  useEffect(() => {
    if (apiUser?.permissions_json) {
      try {
        const parsed = JSON.parse(apiUser.permissions_json);
        setPerms({
          canManageUtilities: !!parsed.canManageUtilities,
          canCreateAnnouncements: !!parsed.canCreateAnnouncements,
          canResolveComplaints: !!parsed.canResolveComplaints,
        });
      } catch (e) {
        console.error(e);
      }
    }
  }, [apiUser]);

  useEffect(() => {
    if (!authed) return;
    const uid = user?.id;
    
    // Always fetch site content for bilingual alerts and rules
    supabase
      .from("site_content")
      .select("key, value")
      .then(({ data }: any) => {
        const map: Record<string, string> = {};
        (data ?? []).forEach((r: any) => { map[r.key] = r.value; });
        setSiteContent(map);
      });

    if (uid) {
      supabase.from("profiles").select("reward_points, warning_count, extra_parking_spots, outstanding_balance").eq("id", uid).maybeSingle()
        .then(({ data }: any) => { if (data) setStats(data as ResidentStats); });
      supabase.from("announcements").select("id, title, body, created_at").eq("is_active", true)
        .order("created_at", { ascending: false }).limit(10)
        .then(({ data }: any) => setAnnouncements((data ?? []) as Announcement[]));

      // Fetch last payment request
      supabase
        .from("payment_requests")
        .select("amount, reviewed_at")
        .eq("resident_id", uid)
        .eq("status", "approved")
        .order("reviewed_at", { ascending: false })
        .limit(1)
        .then(({ data }: any) => {
          if (data && data.length > 0) {
            setLastPayment(data[0].amount);
          } else {
            setLastPayment(0);
          }
        });

      // Fetch next pending due request
      supabase
        .from("payment_requests")
        .select("amount, due_date")
        .eq("resident_id", uid)
        .eq("status", "pending")
        .order("due_date", { ascending: true })
        .limit(1)
        .then(({ data }: any) => {
          if (data && data.length > 0) {
            setNextDue({ amount: data[0].amount, due_date: data[0].due_date });
          } else {
            setNextDue(null);
          }
        });
    }
  }, [authed, user]);

  // Load residents for utility input
  const loadResidents = async () => {
    try {
      const res = await apiFetch<{ users: any[] }>("/users");
      setResidents(res.users.filter((u: any) => u.role === "resident"));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (utilitiesModalOpen) {
      loadResidents();
    }
  }, [utilitiesModalOpen]);

  // Load all complaints
  const loadComplaints = async () => {
    setLoadingComplaints(true);
    try {
      const res = await apiFetch<{ complaints: any[] }>("/complaints");
      setComplaints(res.complaints);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingComplaints(false);
    }
  };

  useEffect(() => {
    if (complaintsModalOpen) {
      loadComplaints();
    }
  }, [complaintsModalOpen]);

  // Handle utility billing submit
  const handleUtilitySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedResId) {
      toast.error("Please select a resident");
      return;
    }
    if (!perms.canManageUtilities) {
      toast.error("Access denied — Missing delegated permission to manage utilities");
      return;
    }
    setSubmittingUtility(true);

    const gas = Number(gasUnits) || 0;
    const water = Number(waterUnits) || 0;
    const elec = Number(electricityUnits) || 0;
    const maint = Number(fixedMaintenance) || 0;
    const grandTotal = (gas + water + elec) * 100 + maint;

    try {
      // 1. Post to SQLite local ledger
      await apiFetch("/ledger", {
        method: "POST",
        body: JSON.stringify({
          user_id: selectedResId,
          entry_date: new Date().toISOString().slice(0, 10),
          entry_type: "maintenance",
          description: `Utility Dues (Gas: ${gas}, Water: ${water}, Elec: ${elec}) + Maint`,
          debit: grandTotal,
          credit: 0
        })
      });

      // 2. Try to sync with Supabase profiles/finance_entries if online
      try {
        await supabase.from("profiles").update({
          gas_units: gas,
          water_units: water,
          electricity_units: elec,
          fixed_maintenance: maint,
          outstanding_balance: grandTotal,
          last_billing_date: new Date().toISOString()
        }).eq("id", selectedResId);
        
        await supabase.from("finance_entries").insert({
          resident_id: selectedResId,
          entry_date: new Date().toISOString().slice(0, 10),
          description: `Utility Dues (Gas: ${gas}, Water: ${water}, Elec: ${elec}) + Maint`,
          category: "Utilities",
          type: "debit",
          amount: grandTotal,
          created_by: apiUser?.id || user?.id
        });
      } catch (sbErr) {
        console.warn("Supabase background update skipped:", sbErr);
      }

      toast.success("Utility dues calculated and recorded!");
      setUtilitiesModalOpen(false);
      setGasUnits("");
      setWaterUnits("");
      setElectricityUnits("");
      setSelectedResId("");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to record utilities");
    } finally {
      setSubmittingUtility(false);
    }
  };

  // Handle announcement submit
  const handleAnnouncementSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annBody.trim()) return;
    if (!perms.canCreateAnnouncements) {
      toast.error("Access denied — Missing delegated permission to publish announcements");
      return;
    }
    setSubmittingAnn(true);
    try {
      const { error } = await supabase.from("announcements").insert({
        title: annTitle.trim(),
        body: annBody.trim(),
        created_by: apiUser?.id || user?.id
      });
      if (error) throw error;
      toast.success("Announcement published successfully!");
      setAnnouncementModalOpen(false);
      setAnnTitle("");
      setAnnBody("");
      // Refetch
      const { data } = await supabase.from("announcements").select("id, title, body, created_at").eq("is_active", true)
        .order("created_at", { ascending: false }).limit(10);
      setAnnouncements((data ?? []) as Announcement[]);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to publish announcement");
    } finally {
      setSubmittingAnn(false);
    }
  };

  // Handle complaint resolution
  const handleResolveComplaint = async (complaintId: string) => {
    if (!perms.canResolveComplaints) {
      toast.error("Access denied — Missing delegated permission to resolve complaints");
      return;
    }
    setResolvingId(complaintId);
    try {
      await apiFetch(`/complaints/${complaintId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "resolved" })
      });
      try {
        await supabase.from("complaints").update({ status: "resolved" }).eq("id", complaintId);
      } catch (e) {
        console.warn(e);
      }
      toast.success("Complaint resolved");
      await loadComplaints();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to resolve complaint");
    } finally {
      setResolvingId(null);
    }
  };

  if (!authed) return <ResidentLogin onSuccess={() => setAuthed(true)} />;

  const name = apiUser?.full_name || profile?.full_name || user?.email || "Resident";
  const initial = (name[0] || "R").toUpperCase();
  const extraSpots = stats.extra_parking_spots ?? 0;
  const parkingCharge = 0; // Not globally configured here yet

  const hasAnyDelegatedPerm = perms.canManageUtilities || perms.canCreateAnnouncements || perms.canResolveComplaints;

  const { lang } = useLanguage();
  const isUr = lang === "ur";

  // Parse permissions from the user/profile to enforce Admin-controlled locks
  const getPermissions = () => {
    let raw = "";
    if (apiUser?.permissions_json) {
      raw = apiUser.permissions_json;
    } else if ((profile as any)?.permissions_json) {
      raw = typeof (profile as any).permissions_json === "string" ? (profile as any).permissions_json : JSON.stringify((profile as any).permissions_json);
    }
    
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return {
          canManageUtilities: !!parsed.canManageUtilities,
          canCreateAnnouncements: !!parsed.canCreateAnnouncements,
          canResolveComplaints: !!parsed.canResolveComplaints,
          canViewLedger: parsed.canViewLedger !== false,
          canViewDocuments: parsed.canViewDocuments !== false,
          canViewMaintenance: parsed.canViewMaintenance !== false,
        };
      } catch (e) {
        console.error("Failed to parse permissions_json", e);
      }
    }
    return {
      canManageUtilities: false,
      canCreateAnnouncements: false,
      canResolveComplaints: false,
      canViewLedger: true,
      canViewDocuments: true,
      canViewMaintenance: true,
    };
  };

  const activePerms = getPermissions();
  const canViewLedger = activePerms.canViewLedger;
  const canViewDocuments = activePerms.canViewDocuments;
  const canViewMaintenance = activePerms.canViewMaintenance;

  const alertText = isUr ? siteContent["dashboard_alert_ur"] : siteContent["dashboard_alert_en"];
  const parkingRulesText = isUr ? siteContent["parking_rules_ur"] : siteContent["parking_rules_en"];
  const rentalPolicyText = isUr ? siteContent["rental_policy_ur"] : siteContent["rental_policy_en"];

  const hasNoData = !alertText && !parkingRulesText && !rentalPolicyText && announcements.length === 0;

  return (
    <ResidentLayout title="Resident Portal">
      {/* Welcome Card */}
      <div className="bg-card border border-border/60 rounded-lg p-6 mb-6 flex items-center gap-4 flex-wrap">
        <div className="h-14 w-14 rounded-full gradient-gold flex items-center justify-center font-display text-2xl text-primary-foreground">{initial}</div>
        <div className="flex-1 min-w-[200px]">
          <div className="text-xs text-muted-foreground">{isUr ? "خوش آمدید،" : "Welcome back,"}</div>
          <div className="font-display text-2xl">{name}</div>
          <div className="text-xs text-muted-foreground">{apiUser?.apartment_no || profile?.apartment_no ? (isUr ? `اپارٹمنٹ ${apiUser?.apartment_no || profile?.apartment_no}` : `Apt ${apiUser?.apartment_no || profile?.apartment_no}`) : "—"}</div>
        </div>

      </div>

      {/* Delegated Admin Panel */}
      {hasAnyDelegatedPerm && (
        <div className="bg-[#111] border border-[#d4af37]/30 rounded-lg p-6 mb-6">
          <h3 className="font-display text-xl mb-2 text-[#d4af37] border-l-2 border-[#d4af37] pl-4 uppercase tracking-wider">
            {isUr ? "ڈیلیگیٹڈ ایڈمنسٹریشن کنسول" : "Delegated Administration Console"}
          </h3>
          <p className="text-xs text-gray-400 mb-6">
            {isUr ? "ایڈمنسٹریٹر نے آپ کو عمارت کے کچھ فرائض سنبھالنے کا اختیار دیا ہے۔" : "The administrator has authorized your account to assist in managing specific building duties."}
          </p>

          <div className="grid sm:grid-cols-3 gap-4">
            {perms.canManageUtilities && (
              <Button onClick={() => setUtilitiesModalOpen(true)} className="bg-transparent border border-[#d4af37]/40 text-[#d4af37] hover:bg-[#d4af37]/10 h-12 font-semibold">
                <Wrench className="h-4 w-4 mr-2" /> {isUr ? "یوٹیلیٹی بلنگ" : "Utility Dues Billing"}
              </Button>
            )}
            {perms.canCreateAnnouncements && (
              <Button onClick={() => setAnnouncementModalOpen(true)} className="bg-transparent border border-[#d4af37]/40 text-[#d4af37] hover:bg-[#d4af37]/10 h-12 font-semibold">
                <Megaphone className="h-4 w-4 mr-2" /> {isUr ? "اعلان پوسٹ کریں" : "Post Announcement"}
              </Button>
            )}
            {perms.canResolveComplaints && (
              <Button onClick={() => setComplaintsModalOpen(true)} className="bg-transparent border border-[#d4af37]/40 text-[#d4af37] hover:bg-[#d4af37]/10 h-12 font-semibold">
                <AlertTriangle className="h-4 w-4 mr-2" /> {isUr ? "شکایات کا حل" : "Resolve Complaints"}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Warnings & Parking Info */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={AlertTriangle} label={isUr ? "انتباہ" : "Warnings"} value={String(stats.warning_count ?? 0)} accent={(stats.warning_count ?? 0) > 0 ? "destructive" : "success"} />
        <StatCard icon={Car} label={isUr ? "اضافی پارکنگ" : "Extra Parking"} value={`${extraSpots} ${isUr ? "کارڈ" : `card${extraSpots === 1 ? "" : "s"}`}`} accent="secondary" />
        <StatCard icon={Wallet} label={isUr ? "پارکنگ چارجز" : "Parking Charges"} value={`PKR ${parkingCharge.toLocaleString()}`} accent={parkingCharge > 0 ? "destructive" : "success"} />
      </div>

      {/* Empty State Centered Notice */}
      {hasNoData ? (
        <div className="bg-card border border-border/60 rounded-xl p-10 text-center my-6 shadow-sm">
          <Megaphone className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-60" />
          <p className="text-sm text-muted-foreground font-medium">
            {isUr ? "انتظامیہ کی طرف سے کوئی فعال اعلانات یا لاگز نہیں ہیں۔" : "No active announcements or logs from administration"}
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Dynamic Alerts */}
          {alertText ? (
            <div className="bg-card border border-border/60 rounded-lg p-6">
              <h3 className="font-display text-xl mb-3 flex items-center gap-2 text-yellow-500">
                <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
                {isUr ? "انتظامی انتباہ اور لاگز" : "Administrative Alerts & Logs"}
              </h3>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-yellow-500/5 border border-yellow-500/20 p-4 rounded-xl font-medium">
                {alertText}
              </p>
            </div>
          ) : null}

          {/* Dynamic Parking Rules */}
          {parkingRulesText ? (
            <div className="bg-card border border-border/60 rounded-lg p-6">
              <h3 className="font-display text-xl mb-3 flex items-center gap-2 text-primary">
                <Car className="h-5 w-5 text-primary shrink-0" />
                {isUr ? "پارکنگ کے قوانین" : "Parking Rules"}
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {parkingRulesText}
              </p>
            </div>
          ) : null}

          {/* Dynamic Announcements */}
          {announcements.length > 0 ? (
            <div className="bg-card border border-border/60 rounded-lg p-6 lg:col-span-2">
              <h3 className="font-display text-xl mb-3 flex items-center gap-2 text-primary">
                <Megaphone className="h-5 w-5 text-primary shrink-0" />
                {isUr ? "انتظامی اعلانات" : "Announcements"}
              </h3>
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {announcements.map((a) => (
                  <div key={a.id} className="p-3 bg-secondary/40 rounded-md">
                    <div className="flex items-center gap-2 mb-1">
                      <Bell className="h-4 w-4 text-primary shrink-0" />
                      <div className="text-sm font-medium">{a.title}</div>
                    </div>
                    <div className="text-xs text-muted-foreground pl-6 whitespace-pre-line leading-relaxed">{a.body}</div>
                    <div className="text-[10px] text-muted-foreground/60 pl-6 mt-1.5">{new Date(a.created_at).toLocaleDateString(isUr ? "ur-PK" : "en-PK")}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Dues Summary */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={Wallet} label={isUr ? "واجب الادا رقم" : "Outstanding"} value={`PKR ${(stats.outstanding_balance ?? 0).toLocaleString()}`} accent={(stats.outstanding_balance ?? 0) > 0 ? "destructive" : "success"} />
        <StatCard 
          icon={Receipt} 
          label={isUr ? "آخری ادائیگی" : "Last Payment"} 
          value={lastPayment !== null && lastPayment > 0 ? `PKR ${lastPayment.toLocaleString()}` : "—"} 
          accent="primary" 
        />
        <StatCard 
          icon={Calendar} 
          label={isUr ? "اگلی مقررہ تاریخ" : "Next Due"} 
          value={nextDue !== null && nextDue.due_date ? (isUr ? new Date(nextDue.due_date).toLocaleDateString("ur-PK") : new Date(nextDue.due_date).toLocaleDateString("en-PK")) : "—"} 
          accent="secondary" 
        />
      </div>

      {/* Quick Nav Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        {canViewLedger ? (
          <Button asChild variant="outline">
            <Link to="/resident/bills">{isUr ? "لیجر دیکھیں" : "View Ledger"}</Link>
          </Button>
        ) : (
          <Button disabled variant="outline" className="opacity-50 cursor-not-allowed flex items-center gap-1.5">
            <span>🔒 {isUr ? "لیجر (بلاک شدہ)" : "Ledger (Locked)"}</span>
          </Button>
        )}
        
        {canViewDocuments ? (
          <Button asChild variant="outline">
            <Link to="/resident/documents">{isUr ? "دستاویزات" : "Documents"}</Link>
          </Button>
        ) : (
          <Button disabled variant="outline" className="opacity-50 cursor-not-allowed flex items-center gap-1.5">
            <span>🔒 {isUr ? "دستاویزات (بلاک شدہ)" : "Documents (Locked)"}</span>
          </Button>
        )}

        {canViewMaintenance ? (
          <Button asChild variant="outline">
            <Link to="/resident/complaints">{isUr ? "مینٹیننس" : "Maintenance"}</Link>
          </Button>
        ) : (
          <Button disabled variant="outline" className="opacity-50 cursor-not-allowed flex items-center gap-1.5">
            <span>🔒 {isUr ? "مینٹیننس (بلاک شدہ)" : "Maintenance (Locked)"}</span>
          </Button>
        )}
      </div>

      {/* Dynamic Rental Policy Alert (Bottom) */}
      {rentalPolicyText && (
        <div className="bg-card border border-border/60 rounded-lg p-6 mb-6">
          <h3 className="font-display text-xl mb-3 flex items-center gap-2 text-primary">
            <Award className="h-5 w-5 text-primary shrink-0" />
            {isUr ? "رینٹل پالیسی اور اعلانات" : "Rental Policy & Announcements"}
          </h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {rentalPolicyText}
          </p>
        </div>
      )}

      {/* Utility Dues Dialog */}
      <Dialog open={utilitiesModalOpen} onOpenChange={setUtilitiesModalOpen}>
        <DialogContent className="bg-[#111] border border-[#d4af37]/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2 text-[#d4af37]">
              <Wrench className="h-5 w-5" /> Input Utility Readings
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUtilitySubmit} className="space-y-4 py-2">
            <div>
              <Label>Select Resident Account</Label>
              <select
                value={selectedResId}
                onChange={(e) => setSelectedResId(e.target.value)}
                className="w-full mt-1 bg-black border border-white/10 text-white p-2.5 rounded text-sm outline-none"
                required
              >
                <option value="" className="text-gray-500">Select resident...</option>
                {residents.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.full_name} ({r.apartment_no ? `Apt ${r.apartment_no}` : "Apt —"}) - {r.client_id}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Gas Units</Label>
                <Input type="number" className="mt-1 bg-black/50 border-white/10" value={gasUnits} onChange={(e) => setGasUnits(e.target.value)} required />
              </div>
              <div>
                <Label>Water Units</Label>
                <Input type="number" className="mt-1 bg-black/50 border-white/10" value={waterUnits} onChange={(e) => setWaterUnits(e.target.value)} required />
              </div>
              <div>
                <Label>Elec Units</Label>
                <Input type="number" className="mt-1 bg-black/50 border-white/10" value={electricityUnits} onChange={(e) => setElectricityUnits(e.target.value)} required />
              </div>
            </div>
            <div>
              <Label>Fixed Monthly Maintenance (PKR)</Label>
              <Input type="number" className="mt-1 bg-black/50 border-white/10" value={fixedMaintenance} onChange={(e) => setFixedMaintenance(e.target.value)} required />
            </div>
            <div className="pt-2 text-xs text-gray-400">
              *Utility formula: <code>(Gas + Water + Elec) * 100 PKR</code>. Grand total will add fixed maintenance.
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUtilitiesModalOpen(false)} className="h-9 hover:bg-white/5">Cancel</Button>
              <Button type="submit" disabled={submittingUtility} className="h-9 bg-[#d4af37] text-black hover:bg-[#b8962e] font-semibold">
                {submittingUtility ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Submit Utility Dues
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Announcement Dialog */}
      <Dialog open={announcementModalOpen} onOpenChange={setAnnouncementModalOpen}>
        <DialogContent className="bg-[#111] border border-[#d4af37]/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2 text-[#d4af37]">
              <Megaphone className="h-5 w-5" /> Publish New Announcement
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAnnouncementSubmit} className="space-y-4 py-2">
            <div>
              <Label>Announcement Title</Label>
              <Input className="mt-1 bg-black/50 border-white/10" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} required placeholder="e.g. Eid Holiday Office Timings" />
            </div>
            <div>
              <Label>Announcement Message</Label>
              <Textarea className="mt-1 bg-black/50 border-white/10 min-h-[100px]" value={annBody} onChange={(e) => setAnnBody(e.target.value)} required placeholder="Write the announcement description..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAnnouncementModalOpen(false)} className="h-9 hover:bg-white/5">Cancel</Button>
              <Button type="submit" disabled={submittingAnn} className="h-9 bg-[#d4af37] text-black hover:bg-[#b8962e] font-semibold">
                {submittingAnn ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Publish Announcement
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Complaints board dialog */}
      <Dialog open={complaintsModalOpen} onOpenChange={setComplaintsModalOpen}>
        <DialogContent className="bg-[#111] border border-[#d4af37]/20 text-white max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2 text-[#d4af37]">
              <AlertTriangle className="h-5 w-5" /> Active Complaints Board
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {loadingComplaints ? (
              <div className="text-sm text-gray-400 py-4">Loading active complaints...</div>
            ) : complaints.filter((c: any) => c.status === "open").length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center">No active open complaints right now. Good job!</div>
            ) : (
              complaints.filter((c: any) => c.status === "open").map((c: any) => (
                <div key={c.id} className="p-3.5 bg-white/5 rounded border border-white/10 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="bg-[#d4af37]/25 text-[#d4af37] border border-[#d4af37]/40 text-[9px] font-bold px-1.5 py-0.5 rounded mr-2 uppercase tracking-wide">
                        {c.category || "Maintenance"}
                      </span>
                      <strong className="text-white text-sm">{c.title}</strong>
                    </div>
                    <span className="text-[10px] text-gray-500">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{c.description || "No description provided."}</p>
                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleResolveComplaint(c.id)}
                      disabled={resolvingId === c.id}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 px-3"
                    >
                      {resolvingId === c.id ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                      Mark Resolved
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setComplaintsModalOpen(false)} className="h-9 hover:bg-white/5">Close Board</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ResidentLayout>
  );
}
