import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import hero from "@/assets/hero-building.jpg";
import apt1 from "@/assets/apt-1bed.jpg";
import apt2 from "@/assets/apt-2bed.jpg";
import apt3 from "@/assets/apt-3bed.jpg";
import apt4 from "@/assets/apt-4bed.jpg";

const imgs = [hero, apt1, apt2, apt3, apt4, hero];

export const Route = createFileRoute("/gallery")({
  head: () => ({ meta: [
    { title: "Gallery — Margalla Gateway" },
    { name: "description", content: "Explore the spaces of Margalla Gateway through our gallery." },
  ]}),
  component: () => (
    <PageShell title="Gallery" subtitle="Spaces that speak for themselves.">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {imgs.map((src, i) => (
          <div key={i} className="aspect-[4/3] overflow-hidden rounded-lg border border-border/60 group">
            <img src={src} alt={`Gallery ${i + 1}`} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
          </div>
        ))}
      </div>
    </PageShell>
  ),
});
