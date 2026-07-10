import { createFileRoute } from "@tanstack/react-router";
import { ResidentLayout } from "@/components/resident/ResidentLayout";
import { SimpleTable } from "@/components/admin/SimpleTable";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { printInvoiceReceipt, printUtilityInvoice } from "@/lib/print-invoice";
import { downloadRentalBillPDF } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Printer, Wallet, Building, Flame, Zap, ShieldAlert, FileText, Upload, Download, Shield } from "lucide-react";
import { format } from "date-fns";
import { apiFetch, getToken, getApiBase } from "@/lib/api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-compress";

export const Route = createFileRoute("/resident/bills")({
  component: ResidentBillsPage,
});

type Row = { id: string; entry_date: string; description: string; type: "credit" | "debit"; amount: number; created_at: string };

function ResidentBillsPage() {
  const { user } = useAuth();
  const { profile, refetch } = useProfile();
  const [rows, setRows] = useState<Row[]>([]);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeLedgerTab, setActiveLedgerTab] = useState<'electricity' | 'gas' | 'rent' | 'maintenance'>('electricity');

  // Utility Modal State
  const [utilityModalOpen, setUtilityModalOpen] = useState(false);
  const [elecUnits, setElecUnits] = useState("");
  const [gasUnits, setGasUnits] = useState("");
  const [waterUnits, setWaterUnits] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [utilityFile, setUtilityFile] = useState<File | null>(null);
  const [submittingUtility, setSubmittingUtility] = useState(false);
  const [utilityFilePreview, setUtilityFilePreview] = useState<string | null>(null);

  useEffect(() => {
    if (!utilityFile) {
      setUtilityFilePreview(null);
      return;
    }
    if (utilityFile.type.startsWith("image/")) {
      const url = URL.createObjectURL(utilityFile);
      setUtilityFilePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setUtilityFilePreview("pdf");
    }
  }, [utilityFile]);

  const handleUtilitySubmit = async () => {
    if (!elecUnits && !gasUnits && !waterUnits && !utilityFile) {
      toast.error("Please enter units or attach a document.");
      return;
    }
    setSubmittingUtility(true);
    let receipt_path: string | null = null;
    try {
      if (utilityFile) {
        const allowedMimes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
        if (!allowedMimes.includes(utilityFile.type)) {
          toast.error("Only PDF, JPG, and PNG files are allowed");
          setSubmittingUtility(false);
          return;
        }
        if (utilityFile.size > 5 * 1024 * 1024) {
          toast.error("File size must be under 5MB");
          setSubmittingUtility(false);
          return;
        }
        const uploadFile = await compressImage(utilityFile);
        
        // 1. Try local upload first
        try {
          const fd = new FormData();
          fd.append("file", uploadFile);
          fd.append("title", uploadFile.name);
          fd.append("owner_type", "payment-receipt");
          fd.append("owner_id", user!.id);
          fd.append("doc_type", "receipt");

          const token = localStorage.getItem("mgt_api_token");
          const res = await fetch(`${getApiBase()}/documents`, {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: fd
          });
          if (!res.ok) throw new Error("Local upload failed");
          const data = await res.json() as { file_path: string };
          const apiHost = getApiBase().replace(/\/api$/, "");
          receipt_path = `${apiHost}/uploads/${data.file_path}`;
        } catch (localErr) {
          console.warn("Local upload failed, trying cloud fallback:", localErr);
          const path = `${user!.id}/${Date.now()}-${utilityFile.name}`;
          const { error: upErr } = await supabase.storage.from("receipts").upload(path, uploadFile);
          if (upErr) throw upErr;
          receipt_path = path;
        }
      }

      const { error } = await supabase.from("payment_requests").insert({
        resident_id: user!.id,
        amount: 0,
        method: paymentMethod,
        note: `Utility Readings Submission - Elec: ${elecUnits || 0}, Gas: ${gasUnits || 0}, Water: ${waterUnits || 0}`,
        status: "pending",
        receipt_path
      });
      if (error) throw error;
      toast.success("Utility details and document submitted successfully!");
      setUtilityModalOpen(false);
      setElecUnits(""); setGasUnits(""); setWaterUnits(""); setUtilityFile(null);
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to submit utility details.");
    } finally {
      setSubmittingUtility(false);
    }
  };

  // 2. Safe local arrays fallback to completely bypass the React crash
  const [invoices, setInvoices] = useState<any[]>([]); 
  const verifiedInvoices = Array.isArray(invoices) ? invoices : [];

  // 3. Safe dynamic filtering matching the selected date ranges
  const filteredInvoices = verifiedInvoices.filter(inv => {
    if (!inv?.date || !startDate || !endDate) return true; // Show all if no filter selected
    return inv.date >= startDate && inv.date <= endDate;
  });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("finance_entries")
        .select("id, entry_date, description, type, amount, created_at")
        .eq("resident_id", user.id)
        .order("created_at", { ascending: true });
      
      let entries = (data as Row[]) ?? [];
      if (error || entries.length === 0) {
        // Fallback to local SQLite API
        const res = await apiFetch<any>(`/ledger/statement/${user.id}`);
        if (res && res.entries) {
          setOpeningBalance(Number(res.opening_balance || 0));
          entries = res.entries.map((e: any) => ({
            id: e.id,
            entry_date: e.entry_date,
            description: e.description,
            type: (Number(e.debit) > 0 ? "debit" : "credit") as "debit" | "credit",
            amount: Number(e.debit) > 0 ? Number(e.debit) : Number(e.credit),
            created_at: e.created_at || new Date().toISOString(),
          }));
        }
      }
      setRows(entries);
    } catch (e) {
      console.error("Statement fetch failed, attempting local fallback:", e);
      try {
        const res = await apiFetch<any>(`/ledger/statement/${user.id}`);
        if (res && res.entries) {
          setOpeningBalance(Number(res.opening_balance || 0));
          const entries = res.entries.map((e: any) => ({
            id: e.id,
            entry_date: e.entry_date,
            description: e.description,
            type: (Number(e.debit) > 0 ? "debit" : "credit") as "debit" | "credit",
            amount: Number(e.debit) > 0 ? Number(e.debit) : Number(e.credit),
            created_at: e.created_at || new Date().toISOString(),
          }));
          setRows(entries);
        }
      } catch (localErr) {
        console.error("Local statement fetch failed:", localErr);
      }
    }

    // Load Invoices from sqlite invoices table
    try {
      const invRes = await apiFetch<any>("/query-bridge", {
        method: "POST",
        body: JSON.stringify({
          table: "invoices",
          action: "select",
          filters: [{ column: "tenant_id", value: user.id }]
        })
      });
      if (invRes && Array.isArray(invRes.data)) {
        setInvoices(invRes.data);
      } else {
        setInvoices([]);
      }
    } catch (err) {
      console.warn("Failed to load invoices via query-bridge:", err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    refetch();
    if (!user) return;

    const channel = supabase
      .channel("bills-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "finance_entries", filter: `resident_id=eq.${user.id}` },
        () => {
          load();
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Compute ledger entries with running balance
  const ledgerEntries = useMemo(() => {
    let running = openingBalance;
    const computed = rows.map((r) => {
      const amt = Number(r.amount);
      if (r.type === "debit") {
        running += amt;
      } else {
        running -= amt;
      }
      return {
        ...r,
        debit: r.type === "debit" ? amt : null,
        credit: r.type === "credit" ? amt : null,
        runningBalance: running,
      };
    });
    // return descending for display (newest first)
    return computed.reverse();
  }, [rows]);

  const handlePrintInvoice = (r: typeof ledgerEntries[0]) => {
    printInvoiceReceipt({
      residentName: profile?.full_name || "Valued Resident",
      residentId: profile?.client_id || "N/A",
      apartmentNo: profile?.apartment_no || "N/A",
      date: r.entry_date,
      refNo: String(r.id).slice(0, 8).toUpperCase(),
      description: r.description,
      amount: String(r.amount),
      status: r.type === "credit" ? "Paid" : "Pending",
    });
  };

  const outstanding = profile?.outstanding_balance ?? 0;
  const isLocalMode = getToken();
 
  return (
    <ResidentLayout title="Account Statement & Ledger">
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-card border border-border/60 rounded-lg p-4 flex items-center gap-3">
          <Wallet className="h-8 w-8 text-primary shrink-0" />
          <div>
            <div className="text-xs text-muted-foreground">Outstanding Balance</div>
            <div className={`text-xl font-display font-semibold ${outstanding > 0 ? "text-destructive" : "text-success"}`}>
              PKR {outstanding.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-lg p-4 flex items-center gap-3">
          <Building className="h-8 w-8 text-sky-500 shrink-0" />
          <div>
            <div className="text-xs text-muted-foreground">Apartment Rent</div>
            <div className="text-xl font-display font-semibold text-foreground">
              PKR {((profile as any)?.rent_amount ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-lg p-4 flex items-center gap-3">
          <Zap className="h-8 w-8 text-yellow-500 shrink-0" />
          <div>
            <div className="text-xs text-muted-foreground">Last Elec Reading</div>
            <div className="text-xl font-display font-semibold text-foreground">
              {isLocalMode ? `${(profile as any)?.elec_curr ?? 0} units` : `${profile?.electricity_units ?? 0} units`}
            </div>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-lg p-4 flex items-center gap-3">
          <Flame className="h-8 w-8 text-orange-500 shrink-0" />
          <div>
            <div className="text-xs text-muted-foreground">Flat Gas Amount</div>
            <div className="text-xl font-display font-semibold text-foreground">
              PKR {isLocalMode ? ((profile as any)?.gas_rate ?? 0).toLocaleString() : ((profile as any)?.gas_rate ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-lg p-4 flex items-center gap-3">
          <Shield className="h-8 w-8 text-emerald-500 shrink-0" />
          <div>
            <div className="text-xs text-muted-foreground">Security Deposit</div>
            <div className="text-xl font-display font-semibold text-foreground">
              PKR {((profile as any)?.security_deposit ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {isLocalMode && profile && (profile as any).elec_curr !== undefined && (
        <div className="bg-card border border-border/60 rounded-lg p-5 mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 mb-4 gap-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              📋 Latest Utility & Dues Breakdown (Admin Entry)
            </h3>
            
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-semibold">
            <div className="bg-slate-950/40 p-3 rounded-lg border border-border/50 space-y-1">
              <span className="text-yellow-500 font-extrabold block mb-1">⚡ Electricity Billing</span>
              <p>Current Reading: {(profile as any).elec_curr}</p>
              <p>Previous Reading: {(profile as any).elec_prev}</p>
              <p>Units Used: {Math.max(0, (profile as any).elec_curr - (profile as any).elec_prev)} @ PKR {(profile as any).elec_rate}/unit</p>
              <p>Arrears: PKR {(profile as any).elec_arrears?.toLocaleString()}</p>
              <div className="border-t border-border/30 pt-1 mt-1 font-bold text-foreground">
                Total: PKR {(((profile as any).elec_curr - (profile as any).elec_prev) * ((profile as any).elec_rate || 100) + ((profile as any).elec_arrears || 0)).toLocaleString()}
              </div>
            </div>
            
            <div className="bg-slate-950/40 p-3 rounded-lg border border-border/50 space-y-1">
              <span className="text-orange-400 font-extrabold block mb-1">🔥 Gas Billing</span>
              <p>Fixed Monthly Gas: PKR {(profile as any).gas_rate?.toLocaleString()}</p>
              <p>Arrears: PKR {(profile as any).gas_arrears?.toLocaleString()}</p>
              <div className="border-t border-border/30 pt-1 mt-1 font-bold text-foreground">
                Total: PKR {(((profile as any).gas_rate || 0) + ((profile as any).gas_arrears || 0)).toLocaleString()}
              </div>
            </div>
            
            <div className="bg-slate-950/40 p-3 rounded-lg border border-border/50 space-y-1">
              <span className="text-cyan-400 font-extrabold block mb-1">🏢 Rent & Maintenance</span>
              <p>Apartment Rent: PKR {(profile as any).rent_amount?.toLocaleString()}</p>
              <p>Maintenance: PKR {(profile as any).fixed_maintenance?.toLocaleString()}</p>
              <div className="border-t border-border/30 pt-1 mt-1 font-bold text-foreground">
                Total: PKR {(((profile as any).rent_amount || 0) + ((profile as any).fixed_maintenance || 0)).toLocaleString()}
              </div>
            </div>

            <div className="bg-slate-950/40 p-3 rounded-lg border border-border/50 space-y-1">
              <span className="text-purple-400 font-extrabold block mb-1">🚗 Extra Parking Dues</span>
              <p>Extra Spots: {(profile as any).extra_parking_spots || 0}</p>
              <div className="border-t border-border/30 pt-1 mt-1 font-bold text-foreground">
                Total: PKR {(((profile as any).parking_charges || 0)).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card border border-border/60 rounded-lg p-4 mb-6 flex justify-between items-center text-sm gap-4 flex-wrap">
        <div className="bg-slate-900/50 p-3.5 rounded-xl border border-slate-800 text-xs">
          <span className="text-slate-400">Monthly Maintenance Pool: </span>
          <span className="text-white font-bold">
            PKR {isLocalMode ? ((profile as any)?.fixed_maintenance ?? 0).toLocaleString() : (profile?.fixed_maintenance ?? 0).toLocaleString()}
          </span>
        </div>
        <div className="text-muted-foreground text-xs">
          Last Billing Date: <span className="font-semibold text-foreground">
            {profile?.last_billing_date ? format(new Date(profile.last_billing_date), "dd MMM yyyy") : "—"}
          </span>
        </div>
      </div>

      {/* ── UTILITY INVOICES STATEMENT HISTORY WITH TABS & DATE RANGE FILTERS ── */}
      <div className="bg-card border border-border/60 rounded-lg p-5 mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between border-b pb-2 gap-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            📄 Utility Invoices & Billings Ledger
          </h3>
          <div className="flex gap-1 bg-slate-900/80 p-1 rounded-lg border border-border/40">
            {(['electricity', 'gas', 'rent', 'maintenance'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveLedgerTab(tab)}
                className={`px-3 py-1 rounded-md text-xs font-bold uppercase transition ${
                  activeLedgerTab === tab
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Date Filter Strip */}
        <div className="flex flex-wrap items-end gap-3 text-xs bg-slate-950/20 p-3 rounded-lg border border-border/40">
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase block mb-1">From Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-40 h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground uppercase block mb-1">To Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-40 h-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setStartDate(''); setEndDate(''); }}
            className="h-8 text-xs"
          >
            Clear Filter
          </Button>
        </div>

        {/* Invoices Table */}
        <div className="overflow-x-auto rounded-lg border border-border/40">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Invoice No</th>
                <th className="p-3">Date</th>
                <th className="p-3 text-right">
                  {activeLedgerTab === 'electricity' && "Electricity (PKR)"}
                  {activeLedgerTab === 'gas' && "Gas Fixed (PKR)"}
                  {activeLedgerTab === 'rent' && "Base Rent (PKR)"}
                  {activeLedgerTab === 'maintenance' && "Maintenance (PKR)"}
                </th>
                <th className="p-3 text-right">Arrears (PKR)</th>
                <th className="p-3 text-right">Grand Total (PKR)</th>
                <th className="p-3 text-right text-emerald-400">Cash Paid (PKR)</th>
                <th className="p-3 text-right text-rose-400">Remaining Balance (PKR)</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground italic">
                    No billing records match selected filters.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv, idx) => {
                  const billVal = 
                    activeLedgerTab === 'electricity' ? (inv.electricity_amount || 0) :
                    activeLedgerTab === 'gas' ? (inv.gas_charges || 0) :
                    activeLedgerTab === 'rent' ? (inv.flat_rent || 0) :
                    (inv.maintenance_charges || 0);

                  const remains = (inv.grand_total || 0) - (inv.amount_received || 0);

                  return (
                    <tr key={inv.invoice_no || idx} className="hover:bg-secondary/20">
                      <td className="p-3 font-sans font-bold text-yellow-500">{inv.invoice_no}</td>
                      <td className="p-3 font-sans">{inv.date}</td>
                      <td className="p-3 text-right font-bold text-white">
                        {activeLedgerTab === 'electricity' && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            Units: {inv.units_consumed || 0} ({inv.prev_reading || 0} to {inv.curr_reading || 0})
                          </div>
                        )}
                        PKR {billVal.toLocaleString()}
                      </td>
                      <td className="p-3 text-right text-rose-400">PKR {(inv.previous_arrears || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-yellow-400">PKR {(inv.grand_total || 0).toLocaleString()}</td>
                      <td className="p-3 text-right text-emerald-400 font-bold">PKR {(inv.amount_received || 0).toLocaleString()}</td>
                      <td className={`p-3 text-right font-black ${remains > 0 ? "text-rose-500" : "text-emerald-400"}`}>
                        PKR {remains.toLocaleString()}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => {
                              downloadRentalBillPDF({
                                invoiceNo: inv.invoice_no,
                                date: inv.date,
                                billTo: { name: profile?.full_name || "Resident", apartment: profile?.apartment_no },
                                electricityDetails: {
                                  prev: inv.prev_reading || 0,
                                  curr: inv.curr_reading || 0,
                                  rate: 100,
                                  arrears: inv.previous_arrears || 0,
                                  cost: inv.electricity_amount || 0
                                },
                                fixedGasCost: inv.gas_charges || 0,
                                baseRent: inv.flat_rent || 0,
                                consolidatedMaintenance: inv.maintenance_charges || 0,
                                grandTotalNetBill: inv.grand_total || 0,
                                cashReceived: inv.amount_received || 0
                              });
                            }}
                            className="text-cyan-400 hover:text-cyan-300 font-bold hover:scale-110 text-xs"
                            title="Download PDF Invoice"
                          >
                            📄
                          </button>
                          <button
                            onClick={() => {
                              printUtilityInvoice({
                                invoiceNo: inv.invoice_no,
                                date: inv.date,
                                tenantName: profile?.full_name || "Resident",
                                apartmentNo: profile?.apartment_no || "N/A",
                                elecPrev: inv.prev_reading || 0,
                                elecCurr: inv.curr_reading || 0,
                                elecRate: 100,
                                elecArrears: inv.previous_arrears || 0,
                                elecCost: inv.electricity_amount || 0,
                                fixedGasCost: inv.gas_charges || 0,
                                baseRent: inv.flat_rent || 0,
                                consolidatedMaintenance: inv.maintenance_charges || 0,
                                grandTotal: inv.grand_total || 0,
                                cashReceived: inv.amount_received || 0,
                                remainingBalance: remains
                              });
                            }}
                            className="text-yellow-400 hover:text-yellow-300 font-bold hover:scale-110 text-xs"
                            title="Print Invoice"
                          >
                            🖨️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground p-6">Loading statement...</div>
      ) : ledgerEntries.length === 0 ? (
        <div className="bg-card border border-border/60 rounded-lg p-10 text-center text-sm text-muted-foreground">
          No transactions recorded for your account statement yet.
        </div>
      ) : (
        <div className="bg-card border border-border/60 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-muted-foreground text-xs">
              <tr>
                <th className="text-left px-3 py-2.5">Date</th>
                <th className="text-left px-3 py-2.5">Ref</th>
                <th className="text-left px-3 py-2.5">Description</th>
                <th className="text-right px-3 py-2.5">Debit (Charge)</th>
                <th className="text-right px-3 py-2.5">Credit (Payment)</th>
                <th className="text-right px-3 py-2.5">Running Balance</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.map((r) => (
                <tr key={r.id} className="border-t border-border/40 hover:bg-secondary/30">
                  <td className="px-3 py-2 text-xs">{format(new Date(r.entry_date), "dd MMM yyyy")}</td>
                  <td className="px-3 py-2 font-mono text-xs">{String(r.id).slice(0, 8).toUpperCase()}</td>
                  <td className="px-3 py-2">{r.description}</td>
                  <td className="px-3 py-2 text-right text-destructive font-mono">
                    {r.debit ? `PKR ${r.debit.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-success font-mono">
                    {r.credit ? `PKR ${r.credit.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    PKR {r.runningBalance.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-primary/40 text-primary hover:bg-primary/10"
                      onClick={() => handlePrintInvoice(r)}
                    >
                      <Printer className="h-3.5 w-3.5 mr-1" /> Receipt
                    </Button>
                  </td>
                </tr>
              ))}
              {openingBalance !== 0 && (
                <tr className="border-t border-border/40 bg-secondary/10">
                  <td className="px-3 py-2 text-xs">—</td>
                  <td className="px-3 py-2 font-mono text-xs">—</td>
                  <td className="px-3 py-2 font-semibold">Opening Balance B/F</td>
                  <td className="px-3 py-2 text-right text-destructive font-mono">—</td>
                  <td className="px-3 py-2 text-right text-success font-mono">—</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    PKR {openingBalance.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </ResidentLayout>
  );
}
