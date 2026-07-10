import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Building2, LayoutDashboard, User, Home, Receipt, CreditCard, MessageSquare, UserCheck, Bell, FileText, LogOut, Shield } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";

const items = [
  { to: "/resident", key: "dashboard", icon: LayoutDashboard },
  { to: "/resident/profile", key: "myProfile", icon: User },
  { to: "/resident/apartment", key: "myApartment", icon: Home },
  { to: "/resident/bills", key: "myBills", icon: Receipt },
  { to: "/resident/payments", key: "payments", icon: CreditCard },
  { to: "/resident/complaints", key: "complaints", icon: MessageSquare },
  { to: "/resident/visitors", key: "visitors", icon: UserCheck },
  { to: "/resident/notices", key: "notices", icon: Bell },
  { to: "/resident/documents", key: "documents", icon: FileText },
] as const;

export function ResidentSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const nav = useNavigate();
  const { t, lang } = useLanguage();
  
  const handlePortalExit = () => {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("user_role");
      localStorage.removeItem("auth_token");
      localStorage.clear();
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.clear();
    }
    // Navigate via router instead of hard window.location.href to avoid Electron file path issues
    nav({ to: "/admin/login" });
  };

  const hasBackup = typeof localStorage !== "undefined" && 
    (!!localStorage.getItem("adminTokenBackup") || !!localStorage.getItem("mgt_admin_token"));

  const handleBackToAdmin = () => {
    if (typeof localStorage !== "undefined") {
      const adminToken = localStorage.getItem("adminTokenBackup") || localStorage.getItem("mgt_admin_token");
      if (adminToken) {
        localStorage.setItem("mgt_api_token", adminToken);
        localStorage.removeItem("adminTokenBackup");
        localStorage.removeItem("mgt_admin_token");
        localStorage.removeItem("mgt_impersonating");
        localStorage.removeItem("mgt_impersonate_target");
      }
    }
    // Switch route to admin dashboard
    window.location.href = "#/admin";
  };

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="h-20 flex items-center gap-2 px-6 border-b border-sidebar-border">
        <Building2 className="h-7 w-7 text-primary" />
        <div className="leading-tight">
          <div className="font-display text-lg text-sidebar-foreground">MARGALLA</div>
          <div className="text-[10px] tracking-[0.3em] text-muted-foreground -mt-0.5">RESIDENT</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((it) => {
          const active = path === it.to;
          return (
            <Link key={it.to} to={it.to} className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"}`}>
              <it.icon className="h-4 w-4" /><span>{t(it.key as any)}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border space-y-1">
        {hasBackup && (
          <button
            onClick={handleBackToAdmin}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-amber-500 hover:bg-amber-500/10 hover:text-amber-400 rounded-md transition-colors font-semibold cursor-pointer mb-1 border border-amber-500/30"
          >
            <Shield className="h-4 w-4" /> {lang === "ur" ? "ایڈمن پورٹل واپس" : "Back to Admin"}
          </button>
        )}
        <button onClick={handlePortalExit} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-sidebar-foreground/70 hover:text-primary cursor-pointer"><LogOut className="h-4 w-4" /> {t("exit")}</button>
      </div>
    </aside>
  );
}
