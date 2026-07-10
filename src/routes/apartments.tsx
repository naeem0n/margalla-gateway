import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { Button } from "@/components/ui/button";
import apt1 from "@/assets/apt-1bed.jpg";
import apt2 from "@/assets/apt-2bed.jpg";
import apt3 from "@/assets/apt-3bed.jpg";

const data = [
  { img: apt1, beds: "1 Bedroom", price: "PKR 45,000", area: "650 sq.ft", features: ["Open Kitchen", "1 Dedicated Parking"] },
  { img: apt2, beds: "2 Bedroom", price: "PKR 65,000", area: "950 sq.ft", features: ["2 Baths", "Living + Dining", "1 Dedicated Parking"] },
  { img: apt3, beds: "3 Bedroom (Standard)", price: "PKR 110,000", area: "1450 sq.ft", features: ["3 Baths", "Living + Dining", "Open Kitchen", "1 Dedicated Parking"] },
  { img: apt3, beds: "3 Bedroom (Compact)", price: "PKR 85,000", area: "1100 sq.ft", features: ["3 Baths", "Living + Dining", "Open Kitchen", "1 Dedicated Parking"] },
];

export const Route = createFileRoute("/apartments")({
  head: () => ({ meta: [
    { title: "Apartments — Margalla Gateway" },
    { name: "description", content: "Choose from 1, 2, and 3 bedroom luxury apartments — each with 1 dedicated parking." },
  ]}),
  component: () => (
    <PageShell title="Apartments" subtitle="Choose the residence that fits your lifestyle.">
      <div className="grid md:grid-cols-2 gap-8 mt-8">
        {data.map((a) => (
          <div key={a.beds} className="bg-card border border-border/60 rounded-lg overflow-hidden">
            <div className="aspect-[16/10] overflow-hidden">
              <img src={a.img} alt={a.beds} loading="lazy" className="w-full h-full object-cover" />
            </div>
            <div className="p-6">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="font-display text-2xl">{a.beds}</h3>
                <span className="text-primary font-medium">{a.price}/mo</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Approx. {a.area}</p>
              <ul className="text-sm space-y-1 mb-5">
                {a.features.map((f) => <li key={f} className="text-muted-foreground">• {f}</li>)}
              </ul>
              <Button asChild className="bg-primary text-primary-foreground"><Link to="/book">Book a Visit</Link></Button>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  ),
});
