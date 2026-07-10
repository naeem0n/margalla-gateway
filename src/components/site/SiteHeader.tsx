import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Menu, X, Building2, LogOut, Home, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/site/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { grantResidentAccess } from "@/lib/resident-gate";

const nav = [
  { to: "/welcome", key: "home" },
  { to: "/about", key: "about" },
  { to: "/apartments", key: "apartments" },
  { to: "/amenities", key: "amenities" },
  { to: "/gallery", key: "gallery" },
  { to: "/location", key: "location" },
  { to: "/contact", key: "contact" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, signOut } = useAuth();

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
    } else {
      document.documentElement.classList.remove("light");
    }
  };

  const enterResidentPortal = () => {
    if (typeof localStorage !== "undefined") {
      const adminToken = localStorage.getItem("mgt_api_token");
      if (adminToken) {
        localStorage.setItem("adminTokenBackup", adminToken);
      }
    }
    grantResidentAccess();
    navigate({ to: "/" });
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border/60">
      <div className="container mx-auto px-4 lg:px-8 flex h-20 items-center justify-between">
        <Link to="/welcome" className="flex items-center gap-3 group">
          <Building2 className="h-7 w-7 text-primary" />
          <div className="leading-tight">
            <div className="font-display text-xl font-semibold tracking-wide">MARGALLA GATEWAY</div>
            <div className="text-[10px] tracking-[0.3em] text-muted-foreground -mt-0.5">LUXURY RESIDENCES</div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-7">
          {nav.map((n) => {
            const active = path === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`text-sm tracking-wide transition-colors relative py-1 ${active ? "text-primary" : "text-foreground/80 hover:text-primary"}`}
              >
                {t(n.key as any).toUpperCase()}
                {active && <span className="absolute -bottom-0.5 left-0 right-0 h-px bg-primary" />}
              </Link>
            );
          })}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
          >
            {theme === "dark" ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-blue-500" />}
          </button>
          <LanguageSwitcher />
          {user && (
            <Button onClick={signOut} variant="outline" size="sm"><LogOut className="h-4 w-4" />{t("signOut")}</Button>
          )}
          <Button onClick={enterResidentPortal} variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold">
            <Home className="h-4 w-4" />RESIDENCE PORTAL
          </Button>
        </nav>

        <button className="lg:hidden text-foreground" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border/60 bg-background">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-3">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="text-sm tracking-wide py-1">
                {t(n.key as any)}
              </Link>
            ))}
            <button
              onClick={() => { toggleTheme(); setOpen(false); }}
              className="flex items-center gap-2 text-sm tracking-wide py-1 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-blue-500" />}
              <span>{theme === "dark" ? "Light Theme" : "Dark Theme"}</span>
            </button>
            <Button onClick={enterResidentPortal} className="bg-primary text-primary-foreground">
              <Home className="h-4 w-4" /> Resident Portal
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
