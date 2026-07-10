import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { MapPin } from "lucide-react";

export const Route = createFileRoute("/location")({
  head: () => ({ meta: [
    { title: "Location — Margalla Gateway" },
    { name: "description", content: "Find Margalla Gateway in E-11/4, Islamabad." },
  ]}),
  component: () => (
    <PageShell title="Location" subtitle="At the heart of Islamabad — minutes from everything that matters.">
      <div className="grid lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 aspect-video rounded-lg overflow-hidden border border-border/60">
          <iframe
            title="Map"
            src="https://www.openstreetmap.org/export/embed.html?bbox=72.95%2C33.69%2C73.10%2C33.76&layer=mapnik"
            className="w-full h-full"
          />
        </div>
        <div className="bg-card border border-border/60 rounded-lg p-6">
          <MapPin className="h-7 w-7 text-primary mb-3" />
          <h3 className="font-display text-xl mb-2">Margalla Gateway</h3>
          <p className="text-sm text-muted-foreground mb-4">E-11/4, Street No 26-A, Islamabad, Pakistan</p>
          <div className="text-sm space-y-2 text-muted-foreground">
            <div>• 5 min to Centaurus Mall</div>
            <div>• 10 min to Diplomatic Enclave</div>
            <div>• 15 min to Islamabad Airport Bus</div>
            <div>• Walk to Margalla Hills trails</div>
          </div>
        </div>
      </div>
    </PageShell>
  ),
});
