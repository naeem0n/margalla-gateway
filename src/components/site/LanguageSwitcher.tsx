import { Languages } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  return (
    <button
      onClick={() => setLang(lang === "en" ? "ur" : "en")}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/60 bg-card/40 hover:bg-card text-xs font-medium transition-colors"
      aria-label="Switch language"
    >
      <Languages size={14} className="text-primary" />
      <span className={lang === "ur" ? "" : "font-display"}>{lang === "en" ? "اردو" : "English"}</span>
    </button>
  );
}