import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ResidentLayout } from "@/components/resident/ResidentLayout";
import { RentalPolicy } from "@/components/site/RentalPolicy";
import { StatCard } from "@/components/admin/StatCard";
import { Button } from "@/components/ui/button";
import { Wallet, Calendar, Receipt, Bell, Award, AlertTriangle, Car, Megaphone, Wrench } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { getToken } from "@/lib/api-client";

export const Route = createFileRoute("/resident/")({
  component: ResidentDashboard,
});

type Announcement = { id: string; title: string; body: string; created_at: string };
type ResidentStats = { reward_points: number; warning_count: number; extra_parking_spots: number; outstanding_balance?: number };

function ResidentDashboard() {
  const { profile } = useProfile();
  const { user } = useAuth();
  const [stats, setStats] = useState<ResidentStats>({ reward_points: 0, warning_count: 0, extra_parking_spots: 0 });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [siteContent, setSiteContent] = useState<Record<string, string>>({});
  const [lastPayment, setLastPayment] = useState<number | null>(null);
  const [nextDue, setNextDue] = useState<{ amount: number; due_date: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    
    const loadStats = () => {
      supabase
        .from("profiles")
        .select("reward_points, warning_count, extra_parking_spots, outstanding_balance")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }: any) => {
          if (data) setStats(data as ResidentStats);
        });
    };

    const loadAnnouncements = () => {
      supabase
        .from("announcements")
        .select("id, title, body, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(10)
        .then(({ data }: any) => setAnnouncements((data ?? []) as Announcement[]));
    };

    const loadSiteContent = () => {
      supabase
        .from("site_content")
        .select("key, value")
        .then(({ data }: any) => {
          const map: Record<string, string> = {};
          (data ?? []).forEach((r: any) => { map[r.key] = r.value; });
          setSiteContent(map);
        });
    };

    const loadLastPayment = () => {
      supabase
        .from("payment_requests")
        .select("amount, reviewed_at")
        .eq("resident_id", user.id)
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
    };

    const loadNextDue = () => {
      supabase
        .from("payment_requests")
        .select("amount, due_date")
        .eq("resident_id", user.id)
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
    };

    loadStats();
    loadAnnouncements();
    loadSiteContent();
    loadLastPayment();
    loadNextDue();

    // Subscribe to real-time changes
    const profilesChannel = supabase
      .channel("profiles-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, () => {
        loadStats();
      })
      .subscribe();

    const announcementsChannel = supabase
      .channel("announcements-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
        loadAnnouncements();
      })
      .subscribe();

    const paymentsChannel = supabase
      .channel("dashboard-payments-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_requests", filter: `resident_id=eq.${user.id}` }, () => {
        loadLastPayment();
        loadNextDue();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(announcementsChannel);
      supabase.removeChannel(paymentsChannel);
    };
  }, [user]);

  const name = profile?.full_name || user?.email || "Resident";
  const initial = (name[0] || "R").toUpperCase();
  const extraSpots = stats.extra_parking_spots ?? 0;
  const parkingCharge = 0; // Now configured dynamically elsewhere

  const { lang } = useLanguage();
  const isUr = lang === "ur";

  // Parse permissions from profile to enforce locks
  const getPermissions = () => {
    let raw = "";
    if ((profile as any)?.permissions_json) {
      raw = typeof (profile as any).permissions_json === "string" ? (profile as any).permissions_json : JSON.stringify((profile as any).permissions_json);
    }
    
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return {
          canViewLedger: parsed.canViewLedger !== false,
          canViewDocuments: parsed.canViewDocuments !== false,
          canViewMaintenance: parsed.canViewMaintenance !== false,
        };
      } catch (e) {
        console.error("Failed to parse permissions_json", e);
      }
    }
    return {
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
          <div className="text-xs text-muted-foreground">{profile?.apartment_no ? (isUr ? `اپارٹمنٹ ${profile.apartment_no}` : `Apt ${profile.apartment_no}`) : "—"}</div>
        </div>
        {profile?.client_id && (
          <div className="px-4 py-2 rounded-md bg-primary/10 border border-primary/30">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{isUr ? "کلائنٹ آئی ڈی" : "Client ID"}</div>
            <div className="font-mono font-semibold text-primary">{profile.client_id}</div>
          </div>
        )}
      </div>

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
        <StatCard 
          icon={Wallet} 
          label={isUr ? "واجب الادا رقم" : "Outstanding"} 
          value={`PKR ${(getToken() ? (profile?.outstanding_balance ?? 0) : (stats.outstanding_balance ?? profile?.outstanding_balance ?? 0)).toLocaleString()}`} 
          accent={(getToken() ? (profile?.outstanding_balance ?? 0) : (stats.outstanding_balance ?? profile?.outstanding_balance ?? 0)) > 0 ? "destructive" : "success"} 
        />
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
    </ResidentLayout>
  );
}
