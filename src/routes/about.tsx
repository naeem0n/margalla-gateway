import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { useLanguage } from "@/contexts/LanguageContext";


export const Route = createFileRoute("/about")({
  head: () => ({ meta: [
    { title: "About — Margalla Gateway" },
    { name: "description", content: "Discover the story, vision, and craftsmanship behind Margalla Gateway." },
  ]}),
  component: AboutPage,
});

const content = {
  en: {
    title: "About Us",
    subtitle: "A residence designed for those who appreciate the finer things in life.",
    paragraphs: [
      "Margalla Gateway brings together architectural excellence and refined living. Built with premium materials and finished to the highest standards, every residence offers comfort, security, and elegance.",
      "From the moment you step into our reception lobby, you're welcomed into a community that values privacy, service, and modern convenience.",
      "Our property management software powers a seamless living experience — bills, complaints, visitors and staff coordinated effortlessly.",
    ],
    stats: [
      { k: "117", v: "Residences" },
      { k: "8", v: "Floors" },
      { k: "24/7", v: "Security" },
      { k: "100%", v: "Power Backup" },
    ],
  },
  ur: {
    title: "ہمارے بارے میں",
    subtitle: "ایک ایسی رہائش جو نفیس ذوق رکھنے والوں کے لیے ڈیزائن کی گئی ہے۔",
    paragraphs: [
      "مارگلہ اپارٹمنٹس فنِ تعمیر کی عمدگی اور پرتعیش زندگی کا بہترین امتزاج ہے۔ ہر رہائش گاہ کو اعلیٰ معیار کے مٹیریل سے تیار کیا گیا ہے تاکہ آپ کو سکون، تحفظ اور وقار فراہم کیا جا سکے۔",
      "جیسے ہی آپ ہمارے استقبالیہ لابی میں قدم رکھتے ہیں، آپ کا ایک ایسے ماحول میں خیرمقدم کیا جاتا ہے جو پرائیویسی، خدمت اور جدید سہولت کو اہمیت دیتا ہے۔",
      "ہمارا پراپرٹی مینجمنٹ سافٹ ویئر بل، شکایات، مہمانوں اور عملے کے انتظام کو آسان بناتا ہے۔",
    ],
    stats: [
      { k: "117", v: "رہائشی یونٹس" },
      { k: "8", v: "منزلیں" },
      { k: "24/7", v: "سیکیورٹی" },
      { k: "100%", v: "پاور بیک اپ" },
    ],
  },
} as const;

function AboutPage() {
  const { lang } = useLanguage();
  const c = content[lang];
  const isUr = lang === "ur";
  const urFont = isUr ? { fontFamily: "'Noto Naskh Arabic','Noto Sans Arabic',Inter,sans-serif" } : undefined;
  return (
    <PageShell title={c.title} subtitle={c.subtitle}>
      <div
        dir={isUr ? "rtl" : "ltr"}
        style={urFont}
        className={`grid md:grid-cols-2 gap-10 mt-8 ${isUr ? "text-right" : ""}`}
      >
        <div className="space-y-4 text-muted-foreground leading-relaxed">
          {c.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {c.stats.map((x) => (
            <div key={x.v} className="rounded-lg bg-card border border-border/60 p-6 text-center">
              <div className="font-display text-3xl text-primary">{x.k}</div>
              <div className="text-sm text-muted-foreground mt-1">{x.v}</div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
