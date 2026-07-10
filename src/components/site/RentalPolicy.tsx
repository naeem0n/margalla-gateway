import { useLanguage } from "@/contexts/LanguageContext";

const rentalRules = {
  en: {
    title: "Rental Policy & Announcements",
    rewardTitle: "Payment Deadlines & Enforcement",
    points: [] as { text: string; type: string }[],
  },
  ur: {
    title: "رینٹل پالیسی اور اعلانات",
    rewardTitle: "ادائیگی کی شرائط اور قوانین",
    points: [] as { text: string; type: string }[],
  },
};

export function RentalPolicy() {
  const { lang } = useLanguage();
  const isUr = lang === "ur";
  const data = rentalRules[lang];
  return (
    <div
      dir={isUr ? "rtl" : "ltr"}
      style={isUr ? { fontFamily: "'Noto Naskh Arabic','Noto Sans Arabic',Inter,sans-serif" } : undefined}
      className={`p-6 rounded-xl border border-border/60 bg-card ${isUr ? "text-right" : "text-left"}`}
    >
      <h2 className="text-2xl font-bold text-primary mb-4">{data.title}</h2>
      <p className="text-sm text-muted-foreground mb-4">{data.rewardTitle}</p>
      <div className="space-y-4">
        {data.points.map((item, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg flex items-center gap-4 border ${
              (item.type as string) === "reward"
                ? "bg-emerald-900/20 border-emerald-500/60"
                : "bg-red-900/20 border-red-500/60"
            }`}
          >
            <div className="flex-1">
              <p className="text-sm md:text-base text-foreground">{item.text}</p>
            </div>
            <span className="text-xl">{(item.type as string) === "reward" ? "🎁" : "⚠️"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}