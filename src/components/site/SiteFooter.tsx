import { Link } from "@tanstack/react-router";
import { Building2, MapPin, Phone, Mail, Shield, Zap, Car, Wifi, Camera, Building } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const features = [
  { icon: MapPin, label: "Prime", sub: "Location" },
  { icon: Building, label: "Modern", sub: "Architecture" },
  { icon: Shield, label: "24/7", sub: "Security" },
  { icon: Car, label: "Basement", sub: "Parking" },
  { icon: Zap, label: "High Speed", sub: "Elevators" },
  { icon: Wifi, label: "Power", sub: "Backup" },
  { icon: Building2, label: "Reception", sub: "Lobby" },
  { icon: Camera, label: "CCTV", sub: "Surveillance" },
];

const SocialIcons = () => {
  return (
    <div style={{ display: 'flex', gap: '15px' }} className="mt-3">
      {/* Facebook */}
      <a href="https://facebook.com" target="_blank" rel="noopener noreferrer">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#1877F2'}}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
      </a>

      {/* Instagram */}
      <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#E1306C'}}><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
      </a>

      {/* TikTok */}
      <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#000000'}}><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg>
      </a>

      {/* YouTube */}
      <a href="https://youtube.com" target="_blank" rel="noopener noreferrer">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#FF0000'}}><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.42a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.42 8.6.42 8.6.42s6.88 0 8.6-.42a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
      </a>
    </div>
  );
};

export function SiteFooter() {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-border/60 bg-card/40">
      <div className="container mx-auto px-4 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-6 mb-12">
          {features.map((f) => (
            <div key={f.label} className="flex flex-col items-center text-center gap-2">
              <f.icon className="h-7 w-7 text-primary" />
              <div className="text-xs">
                <div className="font-medium text-foreground">{f.label}</div>
                <div className="text-muted-foreground">{f.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-8 pt-8 border-t border-border/60">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-6 w-6 text-primary" />
              <div>
                <div className="font-display text-lg">MARGALLA</div>
                <div className="text-[10px] tracking-[0.3em] text-muted-foreground">GATEWAY</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{t("tagline")}</p>
            <SocialIcons />
          </div>
          <div>
            <h4 className="font-display text-base mb-3 text-primary">{t("contactLabel")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Phone className="h-4 w-4" /><span>+92 300 1234567</span></li>
              <li className="flex items-center gap-2"><Mail className="h-4 w-4" /><span>info@margalla-apartments.com</span></li>
              <li className="flex items-center gap-2"><MapPin className="h-4 w-4" /><span>E-11/4, Street No 26-A, Islamabad</span></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display text-base mb-3 text-primary">{t("quickLinks")}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/apartments" className="text-muted-foreground hover:text-primary">{t("apartments")}</Link></li>
              <li><Link to="/book" className="text-muted-foreground hover:text-primary">{t("bookVisit")}</Link></li>
              <li><Link to="/auth" className="text-muted-foreground hover:text-primary">{t("signIn")}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border/60 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Margalla Gateway. {t("rightsReserved")}
        </div>
      </div>
    </footer>
  );
}
