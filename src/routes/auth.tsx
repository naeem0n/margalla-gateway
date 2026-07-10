import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { Building2, Shield, Users, KeyRound, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/site/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { isDesktopApp } from "@/lib/api-client";

export const Route = createFileRoute("/auth")({
  beforeLoad: () => {
    if (!isDesktopApp()) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({ meta: [{ title: "Open Portal — Margalla Gateway" }] }),
  component: AuthPage,
});

const portals = [
  {
    title: "Admin",
    subtitle: "Management dashboard",
    description: "Open the complete admin panel for apartments, tenants, billing and reports.",
    to: "/admin",
    icon: Shield,
  },
  {
    title: "Resident",
    subtitle: "Resident app",
    description: "Open the resident portal for bills, complaints, notices and visitors.",
    to: "/resident",
    icon: Users,
  },
] as const;

function AuthPage() {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + A
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setShowHidden(true);
        toast.success("Admin portal access unlocked! Redirecting...", {
          duration: 1500,
        });
        setTimeout(() => {
          navigate({ to: "/admin/login" });
        }, 800);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  const visiblePortals = portals.filter((p) => p.title === "Resident" || showHidden);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <span className="font-display text-lg">MARGALLA</span>
        </Link>
        <LanguageSwitcher />
      </div>

      <main className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-5xl flex-col justify-center py-12">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs tracking-[0.3em] text-primary">DEVELOPMENT ACCESS</p>
          <h1 className="font-display text-4xl leading-tight md:text-6xl">
            {lang === "ur" ? "Portal choose karein aur direct open karein" : "Choose a portal and open it directly"}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {lang === "ur"
              ? "Abhi demo/development mode mein password aur ID hata diye gaye hain. Final launch par login wapas add kar denge."
              : "Password and ID checks are removed for demo/development mode. Login will be added back before final launch."}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3 max-w-xl md:max-w-none mx-auto md:mx-0 w-full justify-center">
          {visiblePortals.map((portal) => {
            const Icon = portal.icon;
            return (
              <Link
                key={portal.title}
                to={portal.to}
                className="group rounded-2xl border border-border/60 bg-card p-6 shadow-elegant transition-all hover:-translate-y-1 hover:border-primary/60 hover:shadow-gold w-full md:max-w-sm"
              >
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-secondary/60">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
                <p className="mb-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">{portal.subtitle}</p>
                <h2 className="mb-3 font-display text-2xl">{portal.title}</h2>
                <p className="mb-6 text-sm leading-6 text-muted-foreground">{portal.description}</p>
                <Button className="w-full bg-primary text-primary-foreground" tabIndex={-1}>
                  Open {portal.title}
                </Button>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}