import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Plus, ArrowLeft } from "lucide-react";
import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { downloadLedgerPDF, type LedgerRow } from "@/lib/pdf";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { requireUserWithRedirect } from "@/lib/requireUser";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { format, startOfYear } from "date-fns";

export const Route = createFileRoute("/admin/ledger/$type/$id")({
  component: LedgerPage,
});

type Entry = {
  id: string;
  entry_date: string;
  description: string;
  debit: number;
  credit: number;
  reference: string | null;
  account_label: string | null;
};

function LedgerPage() {
  const { type, id } = Route.useParams();
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const isUr = lang === "ur";
  const urFont = isUr ? { fontFamily: "'Noto Naskh Arabic','Noto Sans Arabic',Inter,sans-serif" } : undefined;

  const [rows, setRows] = useState<Entry[]>([]);
  const [from, setFrom] = useState(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    description: "",
    debit: "",
    credit: "",
    reference: "",
  });
  const [open, setOpen] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const { isAdmin } = useAuth();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ledger_entries")
      .select("id, entry_date, description, debit, credit, reference, account_label")
      .eq("account_type", type)
      .eq("account_id", id)
      .order("entry_date", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    const list = (data ?? []) as Entry[];
    setRows(list);
    if (list[0]?.account_label) setLabel(list[0].account_label);
    setLoading(false);
  };

  useEffect(() => {
    if (label) return;
    (async () => {
      try {
        if (type === "tenant") {
          const { data } = await supabase.from("profiles").select("full_name, apartment_no").eq("id", id).maybeSingle();
          if (data) setLabel(`${data.full_name ?? "Tenant"}${data.apartment_no ? ` — ${data.apartment_no}` : ""}`);
        } else if (type === "staff") {
          const { data } = await supabase.from("staff").select("full_name, role").eq("id", id).maybeSingle();
          if (data) setLabel(`${data.full_name} (${data.role})`);
        } else if (type === "apartment") {
          try {
            const { data } = await supabase.from("apartments").select("number").eq("id", id).maybeSingle();
            if (data) setLabel(`Apartment ${data.number}`);
          } catch (_) {
            const offlineData = localStorage.getItem("margalla_offline_apartments");
            if (offlineData) {
              try {
                const list = JSON.parse(offlineData);
                const found = list.find((a: any) => a.id === id);
                if (found) setLabel(`Apartment ${found.number}`);
              } catch (parseErr) {}
            }
          }
        }
      } catch (err) {
        console.error("Failed to load ledger entity label:", err);
      }
    })();
  }, [type, id, label]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [type, id]);

  const addEntry = async () => {
    if (!form.description) { toast.error(isUr ? "تفصیل ضروری ہے" : "Description required"); return; }
    const userId = await requireUserWithRedirect();
    if (!userId) return;
    if (!isAdmin) { toast.error("Admin access required"); return; }
    const { error } = await supabase.from("ledger_entries").insert({
      account_type: type,
      account_id: id,
      account_label: label,
      entry_date: form.entry_date,
      description: form.description,
      debit: Number(form.debit || 0),
      credit: Number(form.credit || 0),
      reference: form.reference || null,
      created_by: userId,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(isUr ? "انٹری شامل ہو گئی" : "Entry added");
    setOpen(false);
    setForm({ ...form, description: "", debit: "", credit: "", reference: "" });
    load();
  };

  const previousBalance = useMemo(() => {
    if (!from) return 0;
    return rows
      .filter((r) => r.entry_date < from)
      .reduce((sum, r) => sum + (Number(r.debit || 0) - Number(r.credit || 0)), 0);
  }, [rows, from]);

  const currentPeriodData = useMemo(() => {
    return rows.filter((r) => {
      if (from && r.entry_date < from) return false;
      if (to && r.entry_date > to) return false;
      return true;
    });
  }, [rows, from, to]);

  const ledgerRows = useMemo(() => {
    const openingRow = {
      id: "opening-bf",
      entry_date: "",
      description: isUr ? "افتتاحی بقایا / سابقہ بیلنس" : "Opening / Previous Balance B/F",
      debit: 0,
      credit: 0,
      reference: "",
      isOpening: true,
      balance: previousBalance
    };
    
    let runningVal = previousBalance;
    const periodRows = currentPeriodData.map(r => {
      runningVal += Number(r.debit || 0) - Number(r.credit || 0);
      return {
        ...r,
        isOpening: false,
        balance: runningVal
      };
    });

    if (!from) {
      return periodRows;
    }
    return [openingRow, ...periodRows];
  }, [previousBalance, currentPeriodData, from, isUr]);

  const totalD = useMemo(() => currentPeriodData.reduce((s, r) => s + Number(r.debit || 0), 0), [currentPeriodData]);
  const totalC = useMemo(() => currentPeriodData.reduce((s, r) => s + Number(r.credit || 0), 0), [currentPeriodData]);

  return (
    <AdminLayout title={t("ledger")}>
      <div className="flex flex-wrap gap-2 items-center justify-between mb-4" style={urFont}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/admin" })}>
            <ArrowLeft className="h-4 w-4 mr-1" /> {t("back")}
          </Button>
          <div>
            <h2 className="text-xl font-semibold">{label || t("accountLedger")}</h2>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{type} {t("ledger")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> {t("addEntry")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("newLedgerEntry")}</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div><Label>{t("date")}</Label><Input type="date" value={form.entry_date}
                  onChange={(e) => setForm({ ...form, entry_date: e.target.value })} /></div>
                <div><Label>{t("description")}</Label><Input value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={isUr ? "کرایہ مئی 2026" : "Rent May 2026"} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{t("ledgerDebit")} (PKR)</Label><Input type="number" value={form.debit}
                    onChange={(e) => setForm({ ...form, debit: e.target.value })} placeholder="0" /></div>
                  <div><Label>{t("ledgerCredit")} (PKR)</Label><Input type="number" value={form.credit}
                    onChange={(e) => setForm({ ...form, credit: e.target.value })} placeholder="0" /></div>
                </div>
                <div><Label>{isUr ? "حوالہ (اختیاری)" : "Reference (optional)"}</Label><Input value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder={isUr ? "رسید نمبر 123" : "Receipt #123"} /></div>
              </div>
              <DialogFooter><Button onClick={addEntry}>{t("save")}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="outline" disabled={!rows.length}
            onClick={() => downloadLedgerPDF({
              accountLabel: label || `${type}-${String(id).slice(0, 8)}`,
              accountType: type,
              rows: currentPeriodData as LedgerRow[],
              previousBalance,
              fromDate: from,
              toDate: to,
            })}>
            <Download className="h-4 w-4 mr-1" /> {t("exportPdf")}
          </Button>
          <Button size="sm" variant="outline" disabled={!rows.length}
            onClick={() => setShowPrint(true)}>
            🖨️ Print Preview
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border/60 rounded-lg p-4 flex flex-wrap items-end gap-3 mb-4" style={urFont}>
        <div>
          <Label className="text-xs">{isUr ? "سے (تاریخ)" : "From Date"}</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label className="text-xs">{isUr ? "تک (تاریخ)" : "To Date"}</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <Button size="sm" variant="outline" onClick={() => { setFrom(""); setTo(""); }}>
          {isUr ? "صاف کریں" : "Clear Filter"}
        </Button>
      </div>

      <div className="bg-card border border-border/60 rounded-lg overflow-hidden" style={urFont}>
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">{t("date")}</th>
              <th className="text-left px-4 py-3">{t("description")}</th>
              <th className="text-right px-4 py-3">{t("ledgerDebit")}</th>
              <th className="text-right px-4 py-3">{t("ledgerCredit")}</th>
              <th className="text-right px-4 py-3">{t("balance")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t("loading")}</td></tr>
            ) : ledgerRows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t("noEntriesYet")}</td></tr>
            ) : ledgerRows.map((r) => {
              return (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="px-4 py-3">{r.entry_date}</td>
                  <td className="px-4 py-3">
                    {r.description}
                    {r.reference && <span className="text-xs text-muted-foreground ml-2">({r.reference})</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{r.isOpening ? "—" : (Number(r.debit) ? Number(r.debit).toLocaleString() : "—")}</td>
                  <td className="px-4 py-3 text-right font-mono text-success">{r.isOpening ? "—" : (Number(r.credit) ? Number(r.credit).toLocaleString() : "—")}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{r.balance.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
          {ledgerRows.length > 0 && (
            <tfoot className="bg-secondary/40 font-semibold">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-right">{t("total")}</td>
                <td className="px-4 py-3 text-right font-mono">{totalD.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono">{totalC.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono">{(previousBalance + totalD - totalC).toLocaleString()}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── PRINT PREVIEW FRAME ── */}
      {showPrint && (
        <PrintPreviewFrame
          label={label}
          accountType={type}
          accountId={id}
          ledgerRows={ledgerRows as any[]}
          totalD={totalD}
          totalC={totalC}
          previousBalance={previousBalance}
          from={from}
          to={to}
          onClose={() => setShowPrint(false)}
        />
      )}
    </AdminLayout>
  );
}

/* ─────────────────────────────────────────────────────────────
   📋 PRINT PREVIEW FRAME — Matches PrintedLedgerReport design
   ───────────────────────────────────────────────────────────── */
type PrintPreviewProps = {
  label: string;
  accountType: string;
  accountId: string;
  ledgerRows: any[];
  totalD: number;
  totalC: number;
  previousBalance: number;
  from: string;
  to: string;
  onClose: () => void;
};

function PrintPreviewFrame({
  label, accountType, accountId, ledgerRows, totalD, totalC, previousBalance, from, to, onClose
}: PrintPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => window.print();

  // Total pages estimate (1 page per 20 rows)
  const totalPages = Math.max(1, Math.ceil(ledgerRows.length / 20));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 overflow-y-auto">
      {/* ── Top Control Strip ── */}
      <div className="sticky top-0 z-10 bg-slate-950 border-b border-slate-800 px-6 py-3 flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-xl font-black text-yellow-500 tracking-wide">📋 GENERAL LEDGER PREVIEW SYSTEM</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Verify table structure layout alignment before triggering PDF device download.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition"
          >
            ✕ Close Preview
          </button>
          <button
            onClick={handlePrint}
            className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl transition"
          >
            🖨️ Generate & Download PDF
          </button>
        </div>
      </div>

      {/* ── Report Frame ── */}
      <div className="flex justify-center p-6 print:p-0">
        <div
          ref={printRef}
          className="w-full max-w-6xl bg-white text-black p-8 rounded-2xl print:p-4 print:rounded-none shadow-2xl"
        >
          {/* Page counter */}
          <div className="w-full flex justify-end text-xs font-bold font-mono text-gray-700 tracking-wider mb-4">
            1 Out Of {totalPages}
          </div>

          {/* Account header */}
          <div className="w-full text-center mb-8 border-b border-gray-300 pb-4">
            <h2 className="text-lg font-black tracking-tight text-gray-900 uppercase">
              {accountType.toUpperCase()} LEDGER &nbsp;—&nbsp; {label || accountId}
            </h2>
            {(from || to) && (
              <p className="text-xs text-gray-500 mt-1 font-mono">
                Period: {from || "Start"} → {to || "Today"}
              </p>
            )}
          </div>

          {/* Ledger table */}
          <div className="w-full overflow-hidden rounded-xl border border-gray-900 shadow-sm">
            <table className="min-w-full text-xs text-left border-collapse">
              <thead className="bg-gray-100 text-gray-900 font-black uppercase tracking-wide border-b border-gray-900">
                <tr>
                  <th className="p-3.5 border-r border-gray-900">Date</th>
                  <th className="p-3.5 border-r border-gray-900 w-2/5">Description</th>
                  <th className="p-3.5 border-r border-gray-900">Reference</th>
                  <th className="p-3.5 border-r border-gray-900 text-right">Debit</th>
                  <th className="p-3.5 border-r border-gray-900 text-right">Credit</th>
                  <th className="p-3.5 text-right">Balance (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 font-medium text-gray-800">
                {ledgerRows.map((row, index) => (
                  <tr
                    key={row.id ?? index}
                    className={`border-b border-gray-200 transition-colors ${
                      row.isOpening ? "bg-gray-50 italic" : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="p-3 font-mono border-r border-gray-200">{row.entry_date || "—"}</td>
                    <td className="p-3 text-gray-900 border-r border-gray-200 leading-normal">
                      {row.description}
                    </td>
                    <td className="p-3 font-mono text-blue-800 border-r border-gray-200 text-[11px]">
                      {row.reference || "—"}
                    </td>
                    <td className="p-3 font-mono font-bold text-right text-rose-700 border-r border-gray-200">
                      {row.isOpening ? "—" : (Number(row.debit) > 0 ? Number(row.debit).toLocaleString() : "—")}
                    </td>
                    <td className="p-3 font-mono font-bold text-right text-emerald-700 border-r border-gray-200">
                      {row.isOpening ? "—" : (Number(row.credit) > 0 ? Number(row.credit).toLocaleString() : "—")}
                    </td>
                    <td className="p-3 font-mono font-black text-right text-gray-900">
                      PKR {Number(row.balance).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals footer */}
              <tfoot className="bg-gray-100 font-black text-gray-900 border-t-2 border-gray-900">
                <tr>
                  <td colSpan={3} className="p-3 text-right uppercase tracking-wide border-r border-gray-900">
                    Period Totals
                  </td>
                  <td className="p-3 font-mono text-right text-rose-700 border-r border-gray-200">
                    {totalD.toLocaleString()}
                  </td>
                  <td className="p-3 font-mono text-right text-emerald-700 border-r border-gray-200">
                    {totalC.toLocaleString()}
                  </td>
                  <td className="p-3 font-mono text-right">
                    PKR {(previousBalance + totalD - totalC).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Audit disclaimer — PDF only */}
          <div className="mt-12 hidden print:flex justify-between items-center text-[10px] font-bold font-mono text-gray-500 border-t border-gray-200 pt-4">
            <span>Margalla Gateway Core Audit Ledger System</span>
            <span>Verified Secure Node — {new Date().toLocaleDateString("en-PK")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
