import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { Building2, Bed, Building, Car, Shield, UserCheck, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import heroDefault from "@/assets/hero-building.jpg";
import apt1 from "@/assets/apt-1bed.jpg";
import apt2 from "@/assets/apt-2bed.jpg";
import apt3 from "@/assets/apt-3bed.jpg";
import { useLanguage } from "@/contexts/LanguageContext";
import { isDesktopApp } from "@/lib/api-client";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Margalla Gateway — Luxury Living Redefined" },
      { name: "description", content: "Premium 1, 2 and 3 bedroom apartments in Islamabad — 24/7 security, 1 dedicated parking per apartment, full management." },
    ],
    links: [
      { rel: "preload", as: "image", href: heroDefault, fetchpriority: "high" },
    ],
  }),
  component: Index,
});

const stats = [
  { icon: Building2, label: "117", sub: "Luxury Apartments" },
  { icon: Bed, label: "1, 2 & 3", sub: "Bedroom Options" },
  { icon: Building, label: "8", sub: "Floors" },
  { icon: Car, label: "1 Dedicated", sub: "Parking / Apartment" },
  { icon: Shield, label: "24/7", sub: "Security" },
  { icon: UserCheck, label: "Reception", sub: "Lobby" },
];

const aptDefaults = [
  { n: 1, img: apt1, key: "bedroom1" as const, price: "PKR 45,000", label: "1 BED", title: "1 Bedroom" },
  { n: 2, img: apt2, key: "bedroom2" as const, price: "PKR 65,000", label: "2 BED", title: "2 Bedroom" },
  { n: 3, img: apt3, key: "bedroom3" as const, price: "PKR 110,000", label: "3 BED · STANDARD", title: "3 Bedroom (Standard)" },
  { n: 4, img: apt3, key: "bedroom3" as const, price: "PKR 85,000", label: "3 BED · COMPACT", title: "3 Bedroom (Compact)" },
];

function Index() {
  const { t } = useLanguage();



  const { data: content } = useQuery({
    queryKey: ["site_content_home"],
    queryFn: async () => {
      const { data } = await supabase.from("site_content").select("key,value");
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: any) => { map[r.key] = r.value; });
      return map;
    },
  });
  // Remove dynamic query string/timestamp parameters to allow persistent cache load
  const cleanHeroUrl = (url: string) => {
    if (!url) return url;
    return url.split('?')[0];
  };
  const hero = cleanHeroUrl(content?.["hero_image_url"] || heroDefault);
  const heroTitle = content?.["hero_title"] || t("luxuryLiving");
  const heroSubtitle = content?.["hero_subtitle"] || t("redefined");
  const heroTagline = content?.["hero_tagline"] || t("heroTagline");
  const apts = aptDefaults.map(a => ({
    ...a,
    title: content?.[`apt${a.n}_title`] || a.title,
    price: content?.[`apt${a.n}_price`] || a.price,
    desc: content?.[`apt${a.n}_desc`] || "",
    image: content?.[`apt${a.n}_image_url`] || a.img,
    video: content?.[`apt${a.n}_video_url`] || "",
  }));
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* HERO */}
      <section className="relative">
        <div className="absolute inset-0 homepage-bg-layer">
          {hero.match(/\.(mp4|webm|ogg|mov)$/i) || hero.startsWith("data:video/") ? (
            <video 
              src={hero} 
              muted 
              loop 
              playsInline 
              autoPlay 
              className="w-full h-full object-cover homepage-bg-layer" 
            />
          ) : (
            <img 
              src={hero} 
              alt="Margalla Gateway" 
              className="w-full h-full object-cover homepage-bg-layer" 
              width={1920} 
              height={1080} 
              loading="eager" 
              fetchPriority="high" 
              decoding="sync" 
            />
          )}
          <div className="absolute inset-0 hero-overlay" />
        </div>
        <div className="relative container mx-auto px-4 lg:px-8 py-24 lg:py-40 max-w-2xl">
          <h1 className="font-display text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mb-2 uppercase">
            {heroTitle}
          </h1>
          <p className="font-serif italic font-light tracking-wide text-4xl lg:text-5xl text-gradient-gold mb-6">{heroSubtitle}</p>
          <p className="text-base lg:text-lg text-foreground/80 mb-8 max-w-md">
            {heroTagline}
          </p>
          <div className="flex flex-wrap gap-4">
            <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-gold tracking-wide">
              <Link to="/apartments">{t("exploreApartments").toUpperCase()}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-foreground/30 text-foreground hover:bg-foreground/10 tracking-wide bg-transparent">
              <Link to="/book">{t("bookVisit").toUpperCase()}</Link>
            </Button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative bg-background/80 backdrop-blur-sm border-t border-border/60">
          <div className="container mx-auto px-4 lg:px-8 py-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {stats.map((s) => (
              <div key={s.sub} className="flex items-center gap-3">
                <s.icon className="h-6 w-6 text-primary shrink-0" />
                <div>
                  <div className="font-semibold text-sm">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* APARTMENT OPTIONS */}
      <section className="container mx-auto px-4 lg:px-8 py-20">
        <div className="text-center mb-12">
          <p className="text-primary tracking-[0.3em] text-xs mb-2">{t("residences").toUpperCase()}</p>
          <h2 className="font-display text-4xl lg:text-5xl">{t("apartmentOptions")}</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {apts.map((a) => (
            <div key={a.n} className="group bg-card border border-border/60 rounded-lg overflow-hidden hover:border-primary/60 transition-all hover:shadow-gold">
              <div className="aspect-[4/3] overflow-hidden relative bg-muted">
                {a.video ? (
                  <video src={a.video} poster={typeof a.image === "string" ? a.image : undefined} muted loop playsInline autoPlay className="w-full h-full object-cover" />
                ) : (
                  <img src={a.image} alt={a.title} loading="lazy" decoding="async" width={800} height={600} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                )}
                <span className="absolute top-3 left-3 bg-primary/90 text-primary-foreground text-xs font-semibold px-2 py-1 rounded">{a.label}</span>
              </div>
              <div className="p-5">
                <h3 className="font-display text-xl mb-1">{a.title}</h3>
                <p className="text-sm text-muted-foreground mb-1">{t("from")} {a.price}</p>
                {a.desc && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{a.desc}</p>}
                <Link to="/apartments" className="text-primary text-sm inline-flex items-center gap-1 hover:gap-2 transition-all">
                  {t("viewDetails")} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>


      {/* WHY CHOOSE US */}
      <section className="container mx-auto px-4 lg:px-8 py-20">
        <div className="text-center mb-12">
          <p className="text-primary tracking-[0.3em] text-xs mb-2">WHY MARGALLA</p>
          <h2 className="font-display text-4xl lg:text-5xl">Built for residents who expect more</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Shield, title: "24/7 Secured", desc: "Trained guards, CCTV coverage and visitor pre-approval keep your family safe round the clock." },
            { icon: Sparkles, title: "Premium Finishes", desc: "Imported fittings, modern kitchens and elegant lobbies — every detail is curated." },
            { icon: CheckCircle2, title: "Hassle-free Living", desc: "Online rent, complaints, parking and announcements — managed from a single resident portal." },
          ].map((b) => (
            <div key={b.title} className="rounded-xl bg-card border border-border/60 p-6 hover:border-primary/60 transition-colors">
              <div className="h-11 w-11 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
                <b.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display text-xl mb-2">{b.title}</h3>
              <p className="text-sm text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>


      {/* CTA Management Software */}
      <section className="container mx-auto px-4 lg:px-8 py-20">
        <div className="rounded-2xl bg-card border border-border/60 p-8 lg:p-14 grid lg:grid-cols-2 gap-8 items-center shadow-elegant">
          <div>
            <p className="text-primary tracking-[0.3em] text-xs mb-2">{t("managementSoftware").toUpperCase()}</p>
            <h2 className="font-display text-3xl lg:text-4xl mb-4">{t("mgmtHeadline")}</h2>
            <p className="text-muted-foreground mb-6">{t("mgmtSub")}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {(["apartments","tenants","accounting","parking","complaints","visitors"] as const).map((f) => (
              <div key={f} className="rounded-lg bg-secondary/40 border border-border/40 p-4 text-center">
                <div className="font-display text-lg text-primary">{t(f)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
