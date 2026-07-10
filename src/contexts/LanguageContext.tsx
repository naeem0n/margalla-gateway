import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Lang = "en" | "ur";
type Dict = Record<string, { en: string; ur: string }>;

const dict: Dict = {
  home: { en: "Home", ur: "ہوم" },
  about: { en: "About", ur: "تعارف" },
  apartments: { en: "Apartments", ur: "اپارٹمنٹس" },
  amenities: { en: "Amenities", ur: "سہولیات" },
  gallery: { en: "Gallery", ur: "گیلری" },
  location: { en: "Location", ur: "مقام" },
 contact: { en: "Contact", ur: "رابطہ" },
 demo: { en: "Demo", ur: "ڈیمو" },
  bookVisit: { en: "Book a Visit", ur: "وزٹ بک کریں" },
  signIn: { en: "Sign In", ur: "لاگ اِن" },
  signUp: { en: "Sign Up", ur: "اکاؤنٹ بنائیں" },
  signOut: { en: "Sign Out", ur: "لاگ آؤٹ" },
  email: { en: "Email", ur: "ای میل" },
  password: { en: "Password", ur: "پاس ورڈ" },
  fullName: { en: "Full Name", ur: "پورا نام" },
  continueWithGoogle: { en: "Continue with Google", ur: "گوگل سے جاری رکھیں" },
  adminPanel: { en: "Admin Panel", ur: "ایڈمن پینل" },
  residentPortal: { en: "Resident Portal", ur: "رہائشی پورٹل" },
  generate: { en: "Generate", ur: "بنائیں" },
  copy: { en: "Copy", ur: "کاپی" },
  generateCreds: { en: "Generate Resident Credentials", ur: "رہائشی کے لیے لاگ اِن بنائیں" },
  // Admin sidebar
  dashboard: { en: "Dashboard", ur: "ڈیش بورڈ" },
  tenants: { en: "Tenants", ur: "کرایہ دار" },
  accounting: { en: "Accounting", ur: "حسابات" },
  parking: { en: "Parking", ur: "پارکنگ" },
  complaints: { en: "Complaints", ur: "شکایات" },
  announcements: { en: "Announcements", ur: "اعلانات" },
  visitors: { en: "Visitors", ur: "مہمان" },
  staff: { en: "Staff", ur: "عملہ" },
  credentials: { en: "Credentials", ur: "لاگ اِن بنائیں" },
  accessControl: { en: "Access Control", ur: "رسائی کنٹرول" },
  reports: { en: "Reports", ur: "رپورٹس" },
  settings: { en: "Settings", ur: "ترتیبات" },
  homeContent: { en: "Home Content", ur: "ہوم پیج مواد" },
  exitToSite: { en: "Exit to Site", ur: "ویب سائٹ پر واپس" },
  exit: { en: "Exit", ur: "باہر نکلیں" },
  dailyRent: { en: "Daily Rent", ur: "روزانہ کرایہ" },
  // Resident sidebar
  myProfile: { en: "My Profile", ur: "میری پروفائل" },
  myApartment: { en: "My Apartment", ur: "میرا اپارٹمنٹ" },
  myBills: { en: "My Bills", ur: "میرے بل" },
  payments: { en: "Payments", ur: "ادائیگیاں" },
  notices: { en: "Notices", ur: "اعلانات" },
  documents: { en: "Documents", ur: "دستاویزات" },
  // Common
  search: { en: "Search...", ur: "تلاش کریں..." },
  superAdmin: { en: "Super Admin", ur: "سپر ایڈمن" },
  resident: { en: "Resident", ur: "رہائشی" },
  apartmentNo: { en: "Apartment No.", ur: "اپارٹمنٹ نمبر" },
  phone: { en: "Phone", ur: "فون" },
  role: { en: "Role", ur: "کردار" },
  newLogin: { en: "New Login", ur: "نیا لاگ اِن" },
  generatedCredentials: { en: "Generated Credentials", ur: "تیار کردہ لاگ اِن" },
  loginUrl: { en: "Login URL", ur: "لاگ اِن لنک" },
  savePasswordWarn: { en: "Save this password now — it will not be shown again.", ur: "یہ پاس ورڈ ابھی محفوظ کریں — دوبارہ نہیں دکھایا جائے گا۔" },
  // Hero & home
  luxuryLiving: { en: "Luxury Living", ur: "پُرتعیش رہائش" },
  redefined: { en: "Redefined", ur: "نئے انداز میں" },
  heroTagline: {
    en: "Margalla Gateway offers a perfect blend of luxury, comfort and modern living in the heart of the city.",
    ur: "مارگلہ گیٹ وے شہر کے قلب میں عیش، آرام اور جدید طرزِ زندگی کا بہترین امتزاج پیش کرتا ہے۔",
  },
  exploreApartments: { en: "Explore Apartments", ur: "اپارٹمنٹس دیکھیں" },
  apartmentOptions: { en: "Apartment Options", ur: "اپارٹمنٹس کے اختیارات" },
  residences: { en: "Residences", ur: "رہائشی یونٹس" },
  managementSoftware: { en: "Management Software", ur: "انتظامی سافٹ ویئر" },
  mgmtHeadline: { en: "Complete apartment management, in one place.", ur: "اپارٹمنٹ کا مکمل انتظام، ایک ہی جگہ۔" },
  mgmtSub: {
    en: "Tenants, accounting, parking, complaints, visitors, staff and reports — managed seamlessly.",
    ur: "کرایہ دار، حسابات، پارکنگ، شکایات، مہمان، عملہ اور رپورٹس — سب آسانی سے۔",
  },
  openAdminPanel: { en: "Open Admin Panel", ur: "ایڈمن پینل کھولیں" },
  viewDetails: { en: "View Details", ur: "تفصیلات دیکھیں" },
  bedroom1: { en: "1 Bedroom", ur: "ایک کمرہ" },
  bedroom2: { en: "2 Bedroom", ur: "دو کمرے" },
  bedroom3: { en: "3 Bedroom", ur: "تین کمرے" },
  bedroom4: { en: "4 Bedroom", ur: "چار کمرے" },
  from: { en: "From", ur: "شروع" },
  // Footer
  contactLabel: { en: "Contact", ur: "رابطہ" },
  quickLinks: { en: "Quick Links", ur: "فوری روابط" },
  rightsReserved: { en: "All rights reserved.", ur: "جملہ حقوق محفوظ ہیں۔" },
  tagline: { en: "Luxury · Comfort · Security", ur: "تعیش · آرام · سیکیورٹی" },
  // Tenants admin
  tenantsTitle: { en: "Tenants & Client IDs", ur: "کرایہ دار اور کلائنٹ آئی ڈی" },
  refresh: { en: "Refresh", ur: "ریفریش" },
  name: { en: "Name", ur: "نام" },
  apartment: { en: "Apartment", ur: "اپارٹمنٹ" },
  clientId: { en: "Client ID", ur: "کلائنٹ آئی ڈی" },
  action: { en: "Action", ur: "عمل" },
  loading: { en: "Loading...", ur: "لوڈ ہو رہا ہے..." },
  noAccounts: { en: "No accounts yet.", ur: "ابھی کوئی اکاؤنٹ نہیں ہے۔" },
  assignId: { en: "Assign ID", ur: "آئی ڈی دیں" },
  regenerate: { en: "Regenerate", ur: "دوبارہ بنائیں" },
  registeredAccounts: { en: "registered accounts", ur: "رجسٹرڈ اکاؤنٹس" },
  // Finance / Ledger
  totalIncome: { en: "Total Income", ur: "کل آمدنی" },
  totalExpenses: { en: "Total Expenses", ur: "کل اخراجات" },
  remainingBalance: { en: "Remaining Balance", ur: "بقایا بیلنس" },
  addEntry: { en: "Add Entry", ur: "نئی انٹری" },
  uploadBill: { en: "Upload Bill", ur: "بل اپلوڈ کریں" },
  exportPdf: { en: "Export PDF", ur: "پی ڈی ایف نکالیں" },
  printVoucher: { en: "Print Voucher", ur: "واؤچر پرنٹ" },
  viewPhoto: { en: "View Photo", ur: "تصویر دیکھیں" },
  date: { en: "Date", ur: "تاریخ" },
  title: { en: "Title", ur: "تفصیل" },
  category: { en: "Category", ur: "زمرہ" },
  amount: { en: "Amount", ur: "رقم" },
  type: { en: "Type", ur: "قسم" },
  receipt: { en: "Receipt", ur: "رسید" },
  balance: { en: "Balance", ur: "بیلنس" },
  credit: { en: "Credit (Income)", ur: "آمدنی" },
  debit: { en: "Debit (Expense)", ur: "اخراج" },
  save: { en: "Save", ur: "محفوظ کریں" },
  cancel: { en: "Cancel", ur: "منسوخ" },
  delete: { en: "Delete", ur: "حذف کریں" },
  ledger: { en: "Ledger", ur: "لیجر" },
  serial: { en: "S#", ur: "نمبر" },
  voucher: { en: "Voucher", ur: "واؤچر" },
  directory: { en: "Directory", ur: "ڈائریکٹری" },
  // Ledger page specific
  accountLedger: { en: "Account Ledger", ur: "اکاؤنٹ لیجر" },
  back: { en: "Back", ur: "واپس" },
  newLedgerEntry: { en: "New Ledger Entry", ur: "نئی لیجر انٹری" },
  ledgerDebit: { en: "Debit", ur: "وصول" },
  ledgerCredit: { en: "Credit", ur: "ادا" },
  total: { en: "Total", ur: "کل" },
  noEntriesYet: { en: 'No entries yet. Click "Add Entry" to start.', ur: 'ابھی کوئی انٹری نہیں۔ شروع کرنے کے لیے "نئی انٹری" پر کلک کریں۔' },
  description: { en: "Description", ur: "تفصیل" },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: keyof typeof dict) => string };
const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = (typeof window !== "undefined" && localStorage.getItem("lang")) as Lang | null;
    if (stored === "ur" || stored === "en") setLangState(stored);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dir = lang === "ur" ? "rtl" : "ltr";
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("lang", l); } catch {}
  };

  const t = (k: keyof typeof dict) => dict[k]?.[lang] ?? String(k);
  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}