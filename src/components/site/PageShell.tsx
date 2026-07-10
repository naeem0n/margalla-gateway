import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export function PageShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <section className="container mx-auto px-4 lg:px-8 pt-16 pb-8 text-center">
        <p className="text-primary tracking-[0.3em] text-xs mb-2">MARGALLA GATEWAY</p>
        <h1 className="font-display text-4xl lg:text-6xl mb-3">{title}</h1>
        {subtitle && <p className="text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>}
        <div className="mt-6 mx-auto h-px w-24 bg-primary/60" />
      </section>
      <main className="flex-1 container mx-auto px-4 lg:px-8 pb-20">{children}</main>
      <SiteFooter />
    </div>
  );
}
