import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Building2, LayoutDashboard, Home, Users, Calculator, Car, MessageSquare, UserCheck, UserCog, FileBarChart, Settings, LogOut, KeyRound, IdCard, ShieldCheck, Megaphone, Image, CalendarDays, DoorOpen, Contact2, FolderArchive, Bell, Wallet, DatabaseBackup, Boxes, Zap, ClipboardList, Droplet, Flame, UserRound, Shield, Receipt } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { isDesktopApp } from "@/lib/api-client";
import { grantResidentAccess } from "@/lib/resident-gate";

const items = [
  { to: "/admin", key: "dashboard", icon: LayoutDashboard },
  { to: "/admin/apartments", key: "apartments", icon: Home },
  { to: "/admin/vacant-list" as const, key: "vacantList" as const, icon: ClipboardList, fallback: "Daily Vacant List" },
  { to: "/admin/tenants", key: "tenants", icon: Users },
  
  { to: "/admin/directory", key: "directory", icon: IdCard },
  { to: "/admin/daily-rent", key: "dailyRent", icon: CalendarDays },
  { to: "/admin/parking" as const, key: "parking" as const, icon: Car, fallback: "Parking Slots" },

  { to: "/admin/assets-inventory" as const, key: "assetsInventory" as const, icon: Boxes, fallback: "Assets & Inventory" },
  { to: "/admin/documents", key: "documentsAdmin" as const, icon: FolderArchive, fallback: "Documents" },
  { to: "/admin/complaints", key: "complaints", icon: MessageSquare },
  { to: "/admin/announcements", key: "announcements", icon: Megaphone },
  { to: "/admin/notifications", key: "notifications" as const, icon: Bell, fallback: "Notifications" },
  { to: "/admin/visitors", key: "visitors", icon: UserCheck },
  { to: "/admin/staff", key: "staff", icon: UserCog },
  { to: "/admin/credentials", key: "credentials", icon: KeyRound },
  { to: "/admin/access-control", key: "accessControl", icon: ShieldCheck },
  { to: "/admin/backup" as const, key: "backup" as const, icon: DatabaseBackup, fallback: "Backup & Restore" },
  { to: "/admin/settings", key: "settings", icon: Settings },
  { to: "/admin/home-content", key: "homeContent", icon: Image },
] as const;

export function AdminSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { t, lang } = useLanguage();
  const { signOut } = useAuth();
  const nav = useNavigate();
  const handleLogout = async () => {
    try {
      await signOut();
      toast.success(lang === "ur" ? "آپ لاگ آؤٹ ہو گئے" : "Signed out");
      nav({ to: "/auth" });
    } catch (e: any) {
      toast.error(e?.message ?? "Logout failed");
    }
  };

  const openResidentPortal = () => {
    if (typeof localStorage !== "undefined") {
      const adminToken = localStorage.getItem("mgt_api_token");
      if (adminToken) {
        localStorage.setItem("adminTokenBackup", adminToken);
      }
    }
    grantResidentAccess();
    nav({ to: "/" });
  };

  const openThirdPartyPortal = () => {
    nav({ to: "/thirdparty" });
  };
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="h-20 flex items-center gap-2 px-6 border-b border-sidebar-border">
        <Building2 className="h-7 w-7 text-primary" />
        <div className="leading-tight">
          <div className="font-display text-lg text-sidebar-foreground">MARGALLA</div>
          <div className="text-[10px] tracking-[0.3em] text-muted-foreground -mt-0.5">GATEWAY</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("open-central-entry"))}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm bg-gradient-to-r from-blue-900/40 via-blue-950/50 to-slate-900 border border-blue-800/40 text-blue-300 hover:text-white hover:border-blue-700 transition shadow-sm mb-4 cursor-pointer font-bold uppercase tracking-wider"
        >
          <Zap className="h-4 w-4 text-yellow-500 animate-pulse" />
          <span>{lang === "ur" ? "یونیورسل انٹری کونسول" : "Central Entry Console"}</span>
        </button>
        {items.map((it) => {
          const active = path === it.to;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              }`}
            >
              <it.icon className="h-4 w-4" />
              <span>{(it as any).fallback ?? t(it.key as any)}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border space-y-1">
        {isDesktopApp() && (
          <>
            <button
              type="button"
              onClick={openResidentPortal}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-primary/10 hover:text-primary rounded-md transition-colors"
            >
              <UserRound className="h-4 w-4" /> {lang === "ur" ? "رہائشی پورٹل" : "Users Portal"}
            </button>
            <button
              type="button"
              onClick={openThirdPartyPortal}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-purple-500/10 hover:text-purple-400 rounded-md transition-colors"
            >
              <Shield className="h-4 w-4" /> {lang === "ur" ? "تھرڈ پارٹی" : "Third Party"}
            </button>
          </>
        )}
        <Link to="/" className="flex items-center gap-3 px-3 py-2 text-sm text-sidebar-foreground/70 hover:text-primary rounded-md">
          <DoorOpen className="h-4 w-4" /> {t("exitToSite")}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors"
        >
          <LogOut className="h-4 w-4" /> {lang === "ur" ? "لاگ آؤٹ" : "Log out"}
        </button>
      </div>
    </aside>
  );
}
