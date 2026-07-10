import React, { useState } from "react";
import Login from "./auth/Login";
import AdminDashboard from "./dashboards/AdminDashboard";
import ResidentDashboard from "./dashboards/ResidentDashboard";
import LedgerView from "./components/ledger/LedgerView";
import {
  Shield,
  User,
  Home,
  LogOut,
  Bell,
  Search,
  CheckCircle,
  Menu,
  ChevronRight,
  Sparkles,
  Calculator
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function App() {
  // Simple role-based system (admin default auto-login)
  const [user, setUser] = useState<any>({
    role: "admin",
    name: "Admin Director",
    email: "admin@margalla.com"
  });

  // Switch between panels (default matches current user role, or switchable in sidebar)
  const [activePortal, setActivePortal] = useState<"admin" | "resident" | "ledger">("admin");

  // Handle Login success
  const handleLogin = (loggedInUser: { role: string; name: string; email: string }) => {
    setUser(loggedInUser);
    setActivePortal(loggedInUser.role as any);
  };

  // Handle Sign Out
  const handleSignOut = () => {
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // Sidebar link items
  const sidebarItems = [
    { id: "admin", label: "Admin Operations", icon: Shield, roleRequired: "admin" },
    { id: "resident", label: "Resident Portal", icon: User },
    { id: "ledger", label: "Financial Ledger", icon: Calculator },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans antialiased">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 z-20">
        {/* Brand header */}
        <div className="h-16 flex items-center gap-2 px-6 border-b border-sidebar-border bg-background/20">
          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
            <Home className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="font-display font-bold text-sm tracking-wide text-foreground">Margalla Gateway</div>
            <div className="text-[9px] uppercase tracking-wider text-primary font-semibold">Desktop App</div>
          </div>
        </div>

        {/* Portal selector navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <div className="px-3 mb-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
            Switch Portals
          </div>

          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePortal === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePortal(item.id as any)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
                {isActive && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </nav>

        {/* User profile footer in sidebar */}
        <div className="p-4 border-t border-sidebar-border bg-background/10 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-display text-sm text-primary uppercase font-bold">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate text-foreground">{user.name}</div>
              <div className="text-[10px] text-muted-foreground truncate uppercase tracking-wider">{user.role}</div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full h-8 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/5 cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign Out / Switch User
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-border/60 bg-card/10 backdrop-blur-md flex items-center justify-between px-8 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Active Portal:</span>
            <Badge variant="outline" className="border-primary/30 text-primary capitalize font-medium text-[11px] px-2.5 py-0.5">
              {activePortal} View
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            {/* Live system state */}
            <div className="flex items-center gap-2 px-3 py-1 bg-success/5 border border-success/20 rounded-full text-[10px] text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-ping" />
              <span>Offline Database (SQLite) Connected</span>
            </div>

            {/* Notifications icon */}
            <button className="relative p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer">
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-destructive" />
            </button>
          </div>
        </header>

        {/* Dynamic content view with smooth transitions */}
        <main className="flex-1 overflow-y-auto p-8 bg-gradient-to-b from-background via-background/95 to-background/90 scroll-smooth">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {activePortal === "admin" && <AdminDashboard user={user} />}
            {activePortal === "resident" && <ResidentDashboard user={user} />}
            {activePortal === "ledger" && <LedgerView />}
          </div>
        </main>
      </div>
    </div>
  );
}
