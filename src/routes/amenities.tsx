import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { Shield, Car, Zap, Wifi, Camera, Building2, UserCheck, Building, Flame } from "lucide-react";

const items = [
  { icon: Shield, title: "24/7 Security", desc: "Trained guards and round-the-clock monitoring." },
  { icon: Camera, title: "CCTV Surveillance", desc: "Complete coverage of common areas and parking." },
  { icon: Car, title: "Basement Parking", desc: "Secure reserved parking for residents and guests." },
  { icon: Zap, title: "Power Backup", desc: "Uninterrupted electricity for every apartment." },
  { icon: Flame, title: "Sui Gas Supply", desc: "Round-the-clock natural gas supply to every kitchen." },
  { icon: Wifi, title: "High Speed Internet", desc: "Fiber connectivity available throughout." },
  { icon: Building, title: "Modern Architecture", desc: "Premium materials and timeless design." },
  { icon: UserCheck, title: "Reception Lobby", desc: "Welcoming concierge and visitor management." },
  { icon: Building2, title: "High Speed Elevators", desc: "Quiet, fast, and reliable." },
];

export const Route = createFileRoute("/amenities")({
  head: () => ({ meta: [
    { title: "Amenities — Margalla Apartments" },
    { name: "description", content: "Premium amenities including 24/7 security, parking, power backup and more." },
  ]}),
  component: () => (
    <PageShell title="Amenities" subtitle="Every detail considered. Every comfort delivered.">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-8">
        {items.map((i) => (
          <div key={i.title} className="bg-card border border-border/60 rounded-lg p-6 hover:border-primary/60 transition-colors">
            <i.icon className="h-8 w-8 text-primary mb-4" />
            <h3 className="font-display text-lg mb-2">{i.title}</h3>
            <p className="text-sm text-muted-foreground">{i.desc}</p>
          </div>
        ))}
      </div>
    </PageShell>
  ),
});
