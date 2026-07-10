import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import {
  Shield, Users, Building2, Wallet, Car, Bell, MessageSquare,
  FileText, BarChart3, ArrowRight, CheckCircle2, LogIn, Key,
} from "lucide-react";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demo Walkthrough — Margalla Gateway Management" },
      { name: "description", content: "Step-by-step walkthrough of the Margalla Gateway management platform: Admin, Resident and 3rd Party portals." },
    ],
  }),
  component: DemoGuide,
});

const portals = [
  {
    title: "Admin Portal",
    badge: "Building Manager",
    color: "from-primary/20 to-primary/5",
    icon: Shield,
    path: "/admin",
    desc: "Full control panel — manage tenants, apartments, rent, complaints, visitors and reports in one place.",
    features: [
      "Tenant & apartment management",
      "Daily rent + monthly billing",
      "Auto-generate Resident IDs (RES-101)",
      "Complaint tracking & resolution",
      "Accounting & reports export",
      "Announcements & access control",
    ],
  },
  {
    title: "Resident Portal",
    badge: "Tenant",
    color: "from-success/20 to-success/5",
    icon: Users,
    path: "/resident",
    desc: "Residents pay bills, view notices, raise complaints and manage visitors from any device.",
    features: [
      "Sign in with Resident ID + password",
      "Online bill view & payment",
      "Raise & track complaints",
      "Pre-approve visitors",
      "Download receipts & documents",
      "Read building announcements",
    ],
  },
  {
    title: "3rd Party Portal",
    badge: "Service Partner",
    color: "from-warning/20 to-warning/5",
    icon: Key,
    path: "/partner",
    desc: "Vendors and service providers get a limited access portal for their assigned tasks only.",
    features: [
      "Scoped login (no admin data)",
      "Job assignments & schedules",
      "Visit logging",
      "Communication with admin",
    ],
  },
];

const steps = [
  { n: 1, title: "Admin creates apartments & residents", desc: "From the Admin → Tenants page, add a resident with their flat number. The system auto-generates a Resident ID like RES-305." },
  { n: 2, title: "Credentials are shared", desc: "Resident receives their ID and password. They sign in at the public site using the orange Sign In button." },
  { n: 3, title: "Resident uses their portal", desc: "Pays bills, books visitors, raises complaints — all activity is reflected back in the Admin dashboard in real time." },
  { n: 4, title: "Admin runs reports", desc: "Monthly accounting, daily rent, complaints, occupancy — exportable reports for owners and accountants." },
];

const modules = [
  { icon: Building2, name: "Apartments" },
  { icon: Users, name: "Tenants" },
  { icon: Wallet, name: "Accounting" },
  { icon: Car, name: "Parking" },
  { icon: MessageSquare, name: "Complaints" },
  { icon: Bell, name: "Announcements" },
  { icon: FileText, name: "Documents" },
  { icon: BarChart3, name: "Reports" },
];

function DemoGuide() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* Hero */}
      <section className="container mx-auto px-4 lg:px-8 pt-16 pb-10 text-center max-w-3xl">
        <p className="text-primary tracking-[0.3em] text-xs mb-3">CLIENT WALKTHROUGH</p>
        <h1 className="font-display text-4xl lg:text-6xl mb-4">
          A complete tour of the <span className="text-gradient-gold">Margalla</span> platform
        </h1>
        <p className="text-muted-foreground text-lg">
          Three portals, one connected system. Use this page to walk a client through how the app works in under 5 minutes.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold">
            <Link to="/auth"><LogIn className="h-4 w-4" /> Sign In to Try</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="bg-transparent">
            <Link to="/contact">Book a Live Demo</Link>
          </Button>
        </div>
      </section>

      {/* Portals */}
      <section className="container mx-auto px-4 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-6">
          {portals.map((p) => (
            <div key={p.title} className={`relative rounded-2xl border border-border/60 bg-gradient-to-br ${p.color} p-6 flex flex-col`}>
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-xl bg-background/60 border border-border/60 flex items-center justify-center">
                  <p.icon className="h-6 w-6 text-primary" />
                </div>
                <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">{p.badge}</span>
              </div>
              <h3 className="font-display text-2xl mb-2">{p.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{p.desc}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="bg-transparent w-full">
                <Link to={p.path}>Open {p.title} <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Flow */}
      <section className="container mx-auto px-4 lg:px-8 py-16">
        <div className="text-center mb-12">
          <p className="text-primary tracking-[0.3em] text-xs mb-2">HOW IT WORKS</p>
          <h2 className="font-display text-3xl lg:text-4xl">From onboarding to monthly reports</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s) => (
            <div key={s.n} className="rounded-xl bg-card border border-border/60 p-6 hover:border-primary/60 transition-colors">
              <div className="h-10 w-10 rounded-full gradient-gold text-primary-foreground font-display text-lg flex items-center justify-center mb-4">{s.n}</div>
              <h3 className="font-display text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Modules grid */}
      <section className="container mx-auto px-4 lg:px-8 py-16">
        <div className="text-center mb-10">
          <p className="text-primary tracking-[0.3em] text-xs mb-2">MODULES</p>
          <h2 className="font-display text-3xl lg:text-4xl">Everything a building manager needs</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {modules.map((m) => (
            <div key={m.name} className="rounded-lg bg-secondary/40 border border-border/40 p-5 text-center hover:bg-secondary/60 transition-colors">
              <m.icon className="h-6 w-6 text-primary mx-auto mb-2" />
              <div className="font-display text-base">{m.name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 lg:px-8 py-20">
        <div className="rounded-2xl gradient-gold p-10 lg:p-14 text-center shadow-elegant">
          <h2 className="font-display text-3xl lg:text-5xl text-primary-foreground mb-4">Ready to onboard your building?</h2>
          <p className="text-primary-foreground/80 text-lg max-w-xl mx-auto mb-8">
            We deploy the platform with your branding, residents, and rent plan in under a week.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/contact">Talk to Sales</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/auth">Try the Login</Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
