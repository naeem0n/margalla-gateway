import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Printer, IdCard, Receipt, Plus, Award, AlertTriangle, Car, Droplet, Flame, Zap } from "lucide-react";
import { requireUserWithRedirect } from "@/lib/requireUser";
import { useAuth } from "@/hooks/useAuth";
import jsPDF from "jspdf";
import { apiFetch } from "@/lib/api-client";

export const Route = createFileRoute("/admin/directory")({
  component: DirectoryPage,
});

type Resident = {
  id: string;
  full_name: string | null;
  phone: string | null;
  apartment_no: string | null;
  client_id: string | null;
  reward_points: number;
  warning_count: number;
  extra_parking_spots: number;
  gas_units?: number | null;
  water_units?: number | null;
  electricity_units?: number | null;
  fixed_maintenance?: number | null;
  outstanding_balance?: number | null;
  last_billing_date?: string | null;
  rent_amount?: number | null;
};

function DirectoryPage() {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Resident[]>([]);
  const [paid, setPaid] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [rentOpen, setRentOpen] = useState(false);
  const [target, setTarget] = useState<Resident | null>(null);
  const [rentAmount, setRentAmount] = useState("");
  const [rentMonth, setRentMonth] = useState(new Date().toISOString().slice(0, 7));
  const [parkOpen, setParkOpen] = useState(false);
  const [parkSpots, setParkSpots] = useState<number>(0);

  const [utilityOpen, setUtilityOpen] = useState(false);
  const [savingUtility, setSavingUtility] = useState(false);
  const [gasUnits, setGasUnits] = useState("");
  const [waterUnits, setWaterUnits] = useState("");
  const [electricityUnits, setElectricityUnits] = useState("");
  const [fixedMaintenance, setFixedMaintenance] = useState("");
  const [idType, setIdType] = useState<"resident" | "thirdparty">("resident");
  const [selectedResId, setSelectedResId] = useState("");
  const [genName, setGenName] = useState("");
  const [genPhone, setGenPhone] = useState("");
  const [genApt, setGenApt] = useState("");
  const [genCnic, setGenCnic] = useState("");
  const [genClientId, setGenClientId] = useState("");
  const [genRole, setGenRole] = useState("Contractor");

  const printGeneratedId = async () => {
    if (!genName) return;
    const doc = new jsPDF({ format: [85, 55], unit: "mm", orientation: "landscape" });
    const passNo = `PASS-${Math.floor(10000 + Math.random() * 90000)}`;
    const today = new Date().toISOString().slice(0, 10);

    if (idType === "resident") {
      // Premium navy + gold resident ID
      doc.setFillColor(15, 35, 70);
      doc.rect(0, 0, 85, 14, "F");
      doc.setFillColor(212, 175, 55);
      doc.rect(0, 13.5, 85, 0.8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("MARGALLA GATEWAY", 4, 8);
      doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.text("RESIDENT IDENTITY CARD", 4, 12.5);
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
      doc.text(genName.toUpperCase(), 4, 20);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(71, 85, 105);
      doc.text(`Apt: ${genApt || "-"}`, 4, 26);
      doc.text(`Phone: ${genPhone || "-"}`, 4, 31);
      if (genCnic) doc.text(`CNIC: ${genCnic}`, 4, 36);
      doc.setFontSize(9); doc.setTextColor(180, 140, 50); doc.setFont("helvetica", "bold");
      doc.text(genClientId || "—", 4, 44);
      doc.setFontSize(5.5); doc.setTextColor(148, 163, 184); doc.setFont("helvetica", "normal");
      doc.text("Valid only with management authorization.", 4, 50);
    } else {
      // Premium bronze 3rd party pass
      doc.setFillColor(120, 53, 15);
      doc.rect(0, 0, 85, 14, "F");
      doc.setFillColor(245, 158, 11);
      doc.rect(0, 13.5, 85, 0.8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("MARGALLA GATEWAY", 4, 8);
      doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.text("3RD PARTY GATE PASS", 4, 12.5);
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
      doc.text(genName.toUpperCase(), 4, 20);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(71, 85, 105);
      doc.text(`Role: ${genRole}`, 4, 26);
      if (genCnic) doc.text(`CNIC: ${genCnic}`, 4, 31);
      if (genPhone) doc.text(`Phone: ${genPhone}`, 4, 36);
      doc.text(`Issued: ${today}`, 4, 41);
      doc.setFontSize(8.5); doc.setTextColor(180, 80, 20); doc.setFont("helvetica", "bold");
      doc.text(passNo, 4, 47);
      doc.setFontSize(5.5); doc.setTextColor(148, 163, 184); doc.setFont("helvetica", "normal");
      doc.text("Non-transferable. Authorized visitor only.", 4, 51);

      // Save to database
      try {
        await apiFetch('/query-bridge', {
          method: 'POST',
          body: JSON.stringify({
            table: 'third_party_passes',
            action: 'insert',
            data: {
              id: `tp-${Date.now()}`,
              pass_no: passNo,
              full_name: genName,
              cnic: genCnic || null,
              phone: genPhone || null,
              role: genRole,
              issued_date: today,
              expiry_date: null,
              issued_by: "admin",
              created_at: new Date().toISOString(),
            }
          })
        });
        toast.success(`Pass ${passNo} saved to database!`);
      } catch (e) {
        console.warn("Could not save pass to DB:", e);
      }
    }

    doc.autoPrint();
    window.open(doc.output("bloburl"), "_blank");
  };

  const load = async () => {
    setLoading(true);
    let profilesData: any[] = [];
    let paidSet = new Set<string>();

    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, apartment_no, client_id, reward_points, warning_count, extra_parking_spots, gas_units, water_units, electricity_units, fixed_maintenance, outstanding_balance, last_billing_date, rent_amount")
        .order("created_at", { ascending: false });
      if (error) throw error;
      profilesData = profiles ?? [];

      const monthStart = new Date(); monthStart.setDate(1);
      const isoStart = monthStart.toISOString().slice(0, 10);
      const { data: pays, error: payErr } = await supabase
        .from("finance_entries")
        .select("resident_id")
        .eq("type", "credit")
        .gte("entry_date", isoStart);
      if (payErr) throw payErr;
      paidSet = new Set<string>((pays ?? []).map((p: any) => p.resident_id).filter(Boolean));
    } catch (e: any) {
      console.warn("Load directory from Supabase failed, trying local fallback:", e);
      try {
        const res = await apiFetch<{ users: any[] }>("/users");
        if (res && res.users) {
          let offlineMetadata: Record<string, any> = {};
          try {
            const stored = localStorage.getItem("mgt_offline_resident_metadata");
            if (stored) offlineMetadata = JSON.parse(stored);
          } catch (e2) {
            console.error("Failed to parse offline resident metadata", e2);
          }

          profilesData = res.users.map((u: any) => {
            const meta = offlineMetadata[u.id] ?? {};
            return {
              id: u.id,
              full_name: u.full_name,
              phone: u.phone,
              apartment_no: u.apartment_no,
              client_id: u.client_id,
              reward_points: meta.reward_points ?? 0,
              warning_count: meta.warning_count ?? 0,
              extra_parking_spots: meta.extra_parking_spots ?? 0,
              gas_curr: meta.gas_curr ?? 0,
              water_curr: meta.water_curr ?? 0,
              elec_curr: meta.elec_curr ?? 0,
              fixed_maintenance: meta.fixed_maintenance ?? 0,
              outstanding_balance: meta.outstanding_balance ?? 0,
              last_billing_date: meta.last_billing_date ?? null,
              rent_amount: u.rent_amount ?? 0,
            };
          });
        }

        const monthStart = new Date(); monthStart.setDate(1);
        const isoStart = monthStart.toISOString().slice(0, 10);
        const ledgerRes = await apiFetch<{ entries: any[] }>("/ledger");
        if (ledgerRes && ledgerRes.entries) {
          const pays = ledgerRes.entries.filter((le: any) => 
            Number(le.credit) > 0 && le.entry_date >= isoStart
          );
          paidSet = new Set<string>(pays.map((p: any) => p.user_id).filter(Boolean));
        }
      } catch (localErr) {
        console.error("Local fallback failed:", localErr);
      }
    }

    const onlyResidents = profilesData.filter(
      r => r.id !== "system" && r.client_id !== "SYSTEM" && r.client_id !== "ADMIN-001"
    );
    setRows(onlyResidents);
    setPaid(paidSet);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = rows;

  const printIdCard = (r: Resident) => {
    const doc = new jsPDF({ format: [85, 55], unit: "mm", orientation: "landscape" });
    doc.setFillColor(15, 35, 70);
    doc.rect(0, 0, 85, 14, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11); doc.text("MARGALLA GATEWAY", 4, 9);
    doc.setFontSize(7); doc.text("Resident ID Card", 4, 12.5);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.text("Name:", 4, 22); doc.text(r.full_name || "-", 22, 22);
    doc.text("Apt:", 4, 28); doc.text(r.apartment_no || "-", 22, 28);
    doc.text("Phone:", 4, 34); doc.text(r.phone || "-", 22, 34);
    doc.setFontSize(10); doc.setTextColor(180, 140, 50);
    doc.text(r.client_id || "—", 4, 44);
    doc.setFontSize(6); doc.setTextColor(100, 100, 100);
    doc.text("Valid only with management authorization.", 4, 50);
    doc.autoPrint(); window.open(doc.output("bloburl"), "_blank");
  };

  const issueReceipt = async () => {
    if (!target || !rentAmount) return;
    try {
      const amt = Number(rentAmount);
      const userId = await requireUserWithRedirect();
      if (!userId) return;
      if (!isAdmin) { toast.error("Admin access required"); return; }

      let insertedId = "";
      try {
        const { data: last } = await supabase
          .from("finance_entries").select("balance_after")
          .eq("resident_id", target.id)
          .order("entry_date", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
        const prev = Number(last?.balance_after ?? 0);
        const newBalance = Math.max(0, prev - amt);

        const { data: inserted, error } = await supabase.from("finance_entries").insert({
          entry_date: new Date().toISOString().slice(0, 10),
          description: `Rent ${rentMonth} — ${target.full_name} (${target.apartment_no})`,
          category: "Rent",
          type: "credit",
          amount: amt,
          balance_after: newBalance,
          resident_id: target.id,
          created_by: userId,
        }).select().single();

        if (!error && inserted) {
          await supabase.from("profiles").update({
            outstanding_balance: newBalance
          }).eq("id", target.id);
        }
        if (error) throw error;
        insertedId = inserted.id;
      } catch (e: any) {
        console.warn("Issue receipt via Supabase failed, trying local fallback:", e);
        const res = await apiFetch<{ entry: any }>("/ledger", {
          method: "POST",
          body: JSON.stringify({
            user_id: target.id,
            entry_date: new Date().toISOString().slice(0, 10),
            entry_type: "rent",
            description: `Rent ${rentMonth} — ${target.full_name} (${target.apartment_no})`,
            debit: 0,
            credit: amt,
          }),
        });
        if (res && res.entry) {
          insertedId = res.entry.id;
        } else {
          throw new Error("Failed to insert local ledger entry");
        }
      }

      // Print receipt
      const doc = new jsPDF({ format: "a5" });
      doc.setFillColor(15, 35, 70);
      doc.rect(0, 0, 210, 22, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16); doc.text("Margalla Gateway", 14, 12);
      doc.setFontSize(10); doc.text("Rent Payment Receipt", 14, 18);
      doc.setTextColor(0, 0, 0);
      const lines: [string, string][] = [
        ["Receipt #", String(insertedId).slice(0, 8).toUpperCase()],
        ["Date", new Date().toLocaleDateString()],
        ["Resident", target.full_name || "-"],
        ["Client ID", target.client_id || "-"],
        ["Apartment", target.apartment_no || "-"],
        ["Month", rentMonth],
        ["Amount Received", "PKR " + amt.toLocaleString()],
      ];
      let y = 32;
      lines.forEach(([k, v]) => { doc.setFontSize(11); doc.text(`${k}:`, 14, y); doc.text(v, 70, y); y += 9; });
      y += 18;
      doc.line(14, y, 80, y); doc.line(110, y, 180, y);
      doc.setFontSize(9);
      doc.text("Tenant Signature", 14, y + 6);
      doc.text("Authorized Signature", 110, y + 6);
      doc.autoPrint(); window.open(doc.output("bloburl"), "_blank");

      toast.success("Receipt issued");
      setRentOpen(false); setRentAmount("");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const adjustStats = async (r: Resident, p: number, w: number, label: string) => {
    const userId = await requireUserWithRedirect();
    if (!userId) return;
    if (!isAdmin) { toast.error("Admin access required"); return; }
    try {
      const { error } = await supabase.rpc("update_resident_stats", { uid: r.id, p_change: p, w_change: w });
      if (error) throw error;
    } catch (e: any) {
      console.warn("Update stats via Supabase failed, trying local fallback:", e);
      const stored = localStorage.getItem("mgt_offline_resident_metadata");
      const offlineMetadata = stored ? JSON.parse(stored) : {};
      const meta = offlineMetadata[r.id] ?? {};
      meta.reward_points = Math.max(0, (meta.reward_points ?? r.reward_points ?? 0) + p);
      meta.warning_count = Math.max(0, (meta.warning_count ?? r.warning_count ?? 0) + w);
      offlineMetadata[r.id] = meta;
      localStorage.setItem("mgt_offline_resident_metadata", JSON.stringify(offlineMetadata));
    }
    toast.success(`${label} — ${r.full_name ?? "resident"}`);
    load();
  };

  const saveParking = async () => {
    if (!target) return;
    const userId = await requireUserWithRedirect();
    if (!userId) return;
    if (!isAdmin) { toast.error("Admin access required"); return; }
    const spots = Math.max(0, Number(parkSpots) || 0);
    try {
      const { error } = await supabase.from("profiles").update({ extra_parking_spots: spots }).eq("id", target.id);
      if (error) throw error;
    } catch (e: any) {
      console.warn("Update parking spots via Supabase failed, trying local fallback:", e);
      const stored = localStorage.getItem("mgt_offline_resident_metadata");
      const offlineMetadata = stored ? JSON.parse(stored) : {};
      const meta = offlineMetadata[target.id] ?? {};
      meta.extra_parking_spots = spots;
      offlineMetadata[target.id] = meta;
      localStorage.setItem("mgt_offline_resident_metadata", JSON.stringify(offlineMetadata));
    }
    toast.success(`Parking updated — ${spots} extra spot(s) · Rate Not Configured`);
    setParkOpen(false);
    load();
  };

  const saveUtilityBill = async () => {
    if (!target) return;
    const userId = await requireUserWithRedirect();
    if (!userId) return;
    if (!isAdmin) { toast.error("Admin access required"); return; }
    setSavingUtility(true);

    const gas = Number(gasUnits) || 0;
    const water = Number(waterUnits) || 0;
    const elec = Number(electricityUnits) || 0;
    const maint = Number(fixedMaintenance) || 0;
    const parkingFee = 0; 

    const utilityBill = (gas + water + elec) * 100;
    const grandTotal = utilityBill + maint + parkingFee;

    try {
      try {
        // 1. Update profiles
        const { error: profErr } = await supabase.from("profiles").update({
          gas_units: gas,
          water_units: water,
          electricity_units: elec,
          fixed_maintenance: maint,
          outstanding_balance: grandTotal,
          last_billing_date: new Date().toISOString()
        }).eq("id", target.id);

        if (profErr) throw profErr;

        // 2. Insert into finance_entries
        const { error: finErr } = await supabase.from("finance_entries").insert({
          resident_id: target.id,
          entry_date: new Date().toISOString().slice(0, 10),
          description: `Utility Bill (Gas: ${gas}, Water: ${water}, Elec: ${elec}) + Maint + Parking`,
          category: "Utilities",
          type: "debit",
          amount: grandTotal,
          created_by: userId
        });

        if (finErr) throw finErr;
      } catch (e: any) {
        console.warn("Save utility bill via Supabase failed, trying local fallback:", e);
        
        const stored = localStorage.getItem("mgt_offline_resident_metadata");
        const offlineMetadata = stored ? JSON.parse(stored) : {};
        const meta = offlineMetadata[target.id] ?? {};
        meta.gas_units = gas;
        meta.water_units = water;
        meta.electricity_units = elec;
        meta.fixed_maintenance = maint;
        meta.outstanding_balance = grandTotal;
        meta.last_billing_date = new Date().toISOString();
        offlineMetadata[target.id] = meta;
        localStorage.setItem("mgt_offline_resident_metadata", JSON.stringify(offlineMetadata));

        await apiFetch("/ledger", {
          method: "POST",
          body: JSON.stringify({
            user_id: target.id,
            entry_date: new Date().toISOString().slice(0, 10),
            entry_type: "maintenance",
            description: `Utility Bill (Gas: ${gas}, Water: ${water}, Elec: ${elec}) + Maint + Parking`,
            debit: grandTotal,
            credit: 0,
          }),
        });
      }

      // 3. Generate receipt PDF
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.setTextColor(15, 35, 70);
      doc.text("MARGALLA GATEWAY", 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("UTILITY & MAINTENANCE INVOICE RECEIPT", 14, 26);
      doc.line(14, 30, 196, 30);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(`Invoice Ref: U-${Math.random().toString(36).substring(2, 10).toUpperCase()}`, 14, 38);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 44);
      doc.text(`Resident: ${target.full_name || "-"}`, 14, 50);
      doc.text(`Client ID: ${target.client_id || "-"}`, 14, 56);
      doc.text(`Apartment: ${target.apartment_no || "-"}`, 14, 62);

      doc.line(14, 68, 196, 68);
      doc.setFont("helvetica", "bold");
      doc.text("Description", 14, 74);
      doc.text("Quantity / Units", 110, 74);
      doc.text("Amount (PKR)", 160, 74);
      doc.setFont("helvetica", "normal");
      doc.line(14, 78, 196, 78);

      let y = 86;
      doc.text("Gas Bill (Units @ 100 PKR)", 14, y);
      doc.text(`${gas} units`, 110, y);
      doc.text(`PKR ${(gas * 100).toLocaleString()}`, 160, y);
      y += 8;

      doc.text("Water Bill (Units @ 100 PKR)", 14, y);
      doc.text(`${water} units`, 110, y);
      doc.text(`PKR ${(water * 100).toLocaleString()}`, 160, y);
      y += 8;

      doc.text("Electricity Bill (Units @ 100 PKR)", 14, y);
      doc.text(`${elec} units`, 110, y);
      doc.text(`PKR ${(elec * 100).toLocaleString()}`, 160, y);
      y += 8;

      doc.text("Fixed Maintenance Fee", 14, y);
      doc.text("—", 110, y);
      doc.text(`PKR ${maint.toLocaleString()}`, 160, y);
      y += 8;

      doc.text(`Parking Fee (${target.extra_parking_spots ?? 0} Extra spots)`, 14, y);
      doc.text(`${target.extra_parking_spots ?? 0} spots`, 110, y);
      doc.text(`PKR ${parkingFee.toLocaleString()}`, 160, y);
      y += 8;

      doc.line(14, y, 196, y);
      y += 8;
      doc.setFont("helvetica", "bold");
      doc.text("Outstanding Balance (Grand Total)", 14, y);
      doc.text(`PKR ${grandTotal.toLocaleString()}`, 160, y);
      doc.setFont("helvetica", "normal");
      
      y += 20;
      doc.line(14, y, 80, y); doc.line(130, y, 196, y);
      doc.setFontSize(9);
      doc.text("Tenant Signature", 14, y + 6);
      doc.text("Authorized Signature", 130, y + 6);

      doc.autoPrint();
      window.open(doc.output("bloburl"), "_blank");

      toast.success("Utility bill issued and receipt generated!");
      setUtilityOpen(false);
      load();
    } catch (e: any) {
      console.error("Save utility failed:", e);
      toast.error(e.message || "Failed to save utility bill");
    } finally {
      setSavingUtility(false);
    }
  };

  return (
    <AdminLayout title="Resident Directory">
      {/* Central ID Card Generator Console */}
      <div className="bg-card border border-border/60 rounded-lg p-6 mb-6">
        <h3 className="text-base font-bold text-amber-500 mb-3 flex items-center gap-2">
          🪪 Central ID Card & Pass Generator
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card Type Selector */}
          <div className="space-y-2">
            <Label className="text-slate-400">Card / Pass Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={idType === "resident" ? "default" : "outline"}
                onClick={() => { setIdType("resident"); setGenName(""); setGenCnic(""); setGenPhone(""); setGenRole(""); }}
                className={idType === "resident" ? "bg-amber-600 hover:bg-amber-700 text-white font-bold flex-1" : "font-bold flex-1"}
              >
                Resident Card
              </Button>
              <Button
                type="button"
                variant={idType === "thirdparty" ? "default" : "outline"}
                onClick={() => { setIdType("thirdparty"); setGenName(""); setGenCnic(""); setGenPhone(""); setGenRole("Contractor"); }}
                className={idType === "thirdparty" ? "bg-amber-600 hover:bg-amber-700 text-white font-bold flex-1" : "font-bold flex-1"}
              >
                3rd Party Pass
              </Button>
            </div>
          </div>

          {/* Form Fields depending on Type */}
          {idType === "resident" ? (
            <div className="space-y-2 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-400 font-bold text-xs">Select Resident Profile</Label>
                <select
                  value={selectedResId}
                  onChange={(e) => {
                    const rId = e.target.value;
                    setSelectedResId(rId);
                    const res = rows.find(x => x.id === rId);
                    if (res) {
                      setGenName(res.full_name || "");
                      setGenPhone(res.phone || "");
                      setGenApt(res.apartment_no || "");
                      setGenClientId(res.client_id || "");
                    } else {
                      setGenName("");
                      setGenPhone("");
                      setGenApt("");
                      setGenClientId("");
                    }
                  }}
                  className="w-full h-10 px-3 rounded-md bg-secondary text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-sm mt-1"
                >
                  <option value="">-- Choose Resident --</option>
                  {rows.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.full_name} ({r.apartment_no || "No Apt"})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={printGeneratedId}
                  disabled={!genName}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold w-full h-10 uppercase tracking-wider"
                >
                  🖨️ Print Resident ID Card
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 md:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-slate-400">Full Name</Label>
                  <Input
                    type="text"
                    value={genName}
                    onChange={(e) => setGenName(e.target.value)}
                    placeholder="e.g. Electrician Ali"
                    className="h-10 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400">Company / Role</Label>
                  <select
                    value={genRole}
                    onChange={(e) => setGenRole(e.target.value)}
                    className="w-full h-10 px-3 rounded-md bg-secondary text-foreground border border-input focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-xs mt-1"
                  >
                    <option value="Contractor">Contractor</option>
                    <option value="Electrician">Electrician</option>
                    <option value="Plumber">Plumber</option>
                    <option value="Supplier">Supplier</option>
                    <option value="Delivery boy">Delivery boy</option>
                    <option value="Security Guard">Security Guard</option>
                    <option value="Visitor">Visitor</option>
                  </select>
                </div>
                <div>
                  <Label className="text-slate-400">CNIC Number</Label>
                  <Input
                    type="text"
                    value={genCnic}
                    onChange={(e) => setGenCnic(e.target.value)}
                    placeholder="37405-xxxxxxx-x"
                    className="h-10 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-400">Phone Number</Label>
                  <Input
                    type="text"
                    value={genPhone}
                    onChange={(e) => setGenPhone(e.target.value)}
                    placeholder="0300-xxxxxxx"
                    className="h-10 text-xs mt-1"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={printGeneratedId}
                  disabled={!genName}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold w-full md:w-auto px-6 h-10 uppercase tracking-wider"
                >
                  🖨️ Print 3rd Party Gate Pass
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-card border border-border/60 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">{rows.length} residents · {paid.size} paid this month</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-muted-foreground text-xs">
              <tr>
                <th className="text-left px-3 py-2">Client ID</th>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Apt</th>
                <th className="text-left px-3 py-2">Phone</th>
                <th className="text-left px-3 py-2">Warnings</th>
                <th className="text-left px-3 py-2">This Month</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">No residents yet</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="border-t border-border/40 hover:bg-secondary/30">
                  <td className="px-3 py-2 font-mono text-primary">{r.client_id || "—"}</td>
                  <td className="px-3 py-2">{r.full_name || "—"}</td>
                  <td className="px-3 py-2">{r.apartment_no || "—"}</td>
                  <td className="px-3 py-2">{r.phone || "—"}</td>
                  <td className="px-3 py-2">
                    {r.warning_count > 0 ? (
                      <span className="text-xs px-2 py-1 rounded bg-destructive/20 text-destructive font-medium">{r.warning_count}</span>
                    ) : <span className="text-muted-foreground">0</span>}
                  </td>
                  <td className="px-3 py-2">
                    {paid.has(r.id) ? (
                      <span className="text-xs px-2 py-1 rounded bg-success/20 text-success">Paid</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded bg-destructive/20 text-destructive">Unpaid</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => adjustStats(r, 0, 1, "+1 warning")} title="Penalty (+1 warning)">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => printIdCard(r)} title="Print ID Card">
                      <IdCard className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>


    </AdminLayout>
  );
}
