import { createFileRoute, useNavigate } from '@tanstack/react-router';
import React, { useState } from 'react';
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Flame, Droplet, Zap, Search, Plus, Printer, CheckCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/utilities/gas')({
  component: GasBillingPage,
});

interface GasRecord {
  id: number;
  apartment_no: string;
  resident_name: string;
  units_used: number;
  rate: number;
  status: "Paid" | "Unpaid";
  safety_check_date: string;
  safety_status: "Certified" | "Action Required";
}

export function GasBillingPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [records, setRecords] = useState<GasRecord[]>([
    { id: 1, apartment_no: '108', resident_name: 'Sufiyan Zahoor', units_used: 35, rate: 120, status: "Paid", safety_check_date: "2026-04-12", safety_status: "Certified" },
    { id: 2, apartment_no: '109', resident_name: 'Zeeshan Khan', units_used: 20, rate: 120, status: "Unpaid", safety_check_date: "2026-05-18", safety_status: "Certified" },
    { id: 3, apartment_no: '204', resident_name: 'Kamran Ahmed', units_used: 110, rate: 120, status: "Paid", safety_check_date: "2026-06-02", safety_status: "Action Required" },
    { id: 4, apartment_no: '302', resident_name: 'Dr. Tariq Mahmood', units_used: 65, rate: 120, status: "Unpaid", safety_check_date: "2026-05-30", safety_status: "Certified" }
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newApt, setNewApt] = useState("");
  const [newName, setNewName] = useState("");
  const [newUnits, setNewUnits] = useState("");
  const [safetyStatus, setSafetyStatus] = useState<"Certified" | "Action Required">("Certified");

  const handleAddReading = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApt || !newName || !newUnits) {
      toast.error("Please fill all fields");
      return;
    }
    const nextId = records.length > 0 ? Math.max(...records.map(r => r.id)) + 1 : 1;
    const newRecord: GasRecord = {
      id: nextId,
      apartment_no: newApt,
      resident_name: newName,
      units_used: Number(newUnits),
      rate: 120,
      status: "Unpaid",
      safety_check_date: new Date().toISOString().split("T")[0],
      safety_status: safetyStatus
    };
    setRecords([newRecord, ...records]);
    setIsModalOpen(false);
    setNewApt("");
    setNewName("");
    setNewUnits("");
    setSafetyStatus("Certified");
    toast.success(`Gas reading and safety log recorded for Apartment ${newApt}!`);
  };

  const toggleStatus = (id: number) => {
    setRecords(records.map(r => r.id === id ? { ...r, status: r.status === "Paid" ? "Unpaid" : "Paid" } : r));
    toast.success("Billing status updated!");
  };

  const toggleSafety = (id: number) => {
    setRecords(records.map(r => r.id === id ? { 
      ...r, 
      safety_status: r.safety_status === "Certified" ? "Action Required" : "Certified" 
    } : r));
    toast.success("Safety inspection status updated!");
  };

  const handlePrint = (r: GasRecord) => {
    toast.info(`Generating receipt print command for Apartment ${r.apartment_no}...`);
    window.print();
  };

  const filteredRecords = records.filter(r => 
    r.apartment_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.resident_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUnits = records.reduce((sum, r) => sum + r.units_used, 0);
  const totalAmount = records.reduce((sum, r) => sum + (r.units_used * r.rate), 0);
  const actionRequiredCount = records.filter(r => r.safety_status === "Action Required").length;

  return (
    <AdminLayout title="🔥 Gas Utility & Connection Tracker">
      <div className="p-6 bg-slate-950 min-h-screen text-white space-y-6 font-sans print:bg-white print:text-black print:p-0">
        
        {/* 🏢 MARGALLA GATEWAY OFFICIAL PRINT LETTERHEAD */}
        <div className="hidden print:block text-center border-b-4 border-yellow-500 pb-4 mb-6">
          <h1 className="text-3xl font-black tracking-wider text-black">MARGALLA GATEWAY TOWERS</h1>
          <p className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">E-11/4, Street No 26-A, Islamabad, Pakistan</p>
          <div className="flex justify-between items-center text-[10px] font-mono text-gray-500 mt-4">
            <span className="font-bold">DOCUMENT: GAS UTILITY AUDIT STATEMENT REPORT</span>
            <span>DATE: {new Date().toLocaleDateString('en-PK')}</span>
          </div>
        </div>

        {/* 🔝 UPPER BANNER */}
        <div className="border-b border-slate-800 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
          <div>
            <h1 className="text-xl font-black text-orange-500 tracking-wide flex items-center gap-2">
              🔥 Gas Utility & Connection Tracker
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">Standalone database and safety log records for tower gas connections.</p>
          </div>
          
          {/* 🔄 RESTORED UTILITY TABS / LINKS */}
          <div className="flex gap-2 print:hidden bg-slate-900 p-1.5 rounded-xl border border-slate-850">
            <button onClick={() => navigate({ to: '/admin/bulk-utility' })} className="flex items-center gap-1.5 text-gray-400 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-800 hover:text-white transition-all cursor-pointer">
              <Zap className="h-3 w-3" /> Master Control
            </button>
            <button onClick={() => navigate({ to: '/utilities/water' })} className="flex items-center gap-1.5 text-gray-400 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-800 hover:text-white transition-all cursor-pointer">
              <Droplet className="h-3 w-3" /> Water Billing
            </button>
            <button className="flex items-center gap-1.5 bg-orange-950 text-orange-400 px-3 py-1.5 rounded-lg text-xs font-semibold border border-orange-800/40">
              🔥 Gas Management
            </button>
          </div>
        </div>

        {/* 📊 KPI METRICS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
          <div className="bg-gradient-to-br from-orange-950/60 to-slate-900 p-5 rounded-2xl border border-orange-900/30 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-orange-400 uppercase font-black tracking-widest">Total Consumption</span>
              <h2 className="text-2xl font-black mt-1 font-mono">{totalUnits.toLocaleString()} HM3</h2>
              <p className="text-[10px] text-gray-400 mt-1">Across all logged apartments</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-orange-950 border border-orange-800/40 flex items-center justify-center text-orange-400">
              🔥
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Total Gas Revenue</span>
              <h2 className="text-2xl font-black mt-1 font-mono text-emerald-400">PKR {totalAmount.toLocaleString()}</h2>
              <p className="text-[10px] text-gray-400 mt-1">Based on rate of PKR 120/HM3</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-emerald-400">
              💰
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-rose-400 uppercase font-black tracking-widest">Safety Action Warnings</span>
              <h2 className="text-2xl font-black mt-1 font-mono text-rose-400">{actionRequiredCount} Alerts</h2>
              <p className="text-[10px] text-gray-400 mt-1">Pending safety inspections</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-rose-400">
              ⚠️
            </div>
          </div>
        </div>

        {/* 📝 DATA SHEET CONTROLS */}
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 print:bg-white print:border-none print:p-0">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4 print:border-black print:mb-4">
            <div>
              <h3 className="text-gray-200 text-xs font-bold uppercase tracking-wider print:text-black print:font-black">
                🔥 Gas Connection Logs & Inspections
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5 print:hidden">Search, update bills, or log annual safety check reports.</p>
            </div>
            <div className="flex w-full md:w-auto gap-2 print:hidden">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search Apt No or Tenant..." 
                  className="w-full bg-slate-950 pl-9 pr-4 py-2 rounded-lg border border-slate-800 text-xs focus:outline-none"
                />
              </div>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-orange-500 hover:bg-orange-655 text-slate-955 text-[10px] font-black px-4 py-2 rounded-lg uppercase tracking-wide flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Log reading
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left border-collapse print:text-black">
              <thead className="bg-slate-950 text-gray-400 text-[10px] uppercase tracking-wider print:bg-gray-100 print:text-black print:border-b print:border-black">
                <tr>
                  <th className="p-3 text-center">Sr #</th>
                  <th className="p-3">Apt No</th>
                  <th className="p-3">Tenant Name</th>
                  <th className="p-3 text-center">Units Used</th>
                  <th className="p-3 text-right">Net Bill</th>
                  <th className="p-3 text-center">Safety Last Checked</th>
                  <th className="p-3 text-center">Safety Status</th>
                  <th className="p-3 text-center">Bill Status</th>
                  <th className="p-3 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono print:divide-y print:divide-gray-400">
                {filteredRecords.map((r, index) => {
                  const bill = r.units_used * r.rate;
                  return (
                    <tr key={r.id} className="hover:bg-slate-950/40 print:text-black print:border-b print:border-gray-300">
                      <td className="p-3 text-center font-bold text-gray-500 print:text-black">{index + 1}</td>
                      <td className="p-3 text-yellow-500 font-extrabold print:text-black">{r.apartment_no}</td>
                      <td className="p-3 text-white font-semibold print:text-black">{r.resident_name}</td>
                      <td className="p-3 text-center font-bold text-orange-400 print:text-black">{r.units_used} HM3</td>
                      <td className="p-3 text-right font-black text-amber-500 print:text-black">PKR {bill.toLocaleString()}</td>
                      <td className="p-3 text-center text-gray-400 print:text-black">{r.safety_check_date}</td>
                      <td className="p-3 text-center">
                        <button 
                          onClick={() => toggleSafety(r.id)}
                          className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-wide cursor-pointer ${
                            r.safety_status === "Certified" 
                              ? "bg-teal-950/50 border border-teal-500/30 text-teal-400" 
                              : "bg-rose-950/50 border border-rose-500/30 text-rose-400"
                          }`}
                        >
                          {r.safety_status}
                        </button>
                      </td>
                      <td className="p-3 text-center print:hidden">
                        <button 
                          onClick={() => toggleStatus(r.id)}
                          className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-wide cursor-pointer ${
                            r.status === "Paid" 
                              ? "bg-emerald-950/50 border border-emerald-500/30 text-emerald-400" 
                              : "bg-rose-950/50 border border-rose-500/30 text-rose-400 animate-pulse"
                          }`}
                        >
                          {r.status}
                        </button>
                      </td>
                      <td className="p-3 text-center print:block hidden font-bold">
                        {r.status}
                      </td>
                      <td className="p-3 text-center print:hidden">
                        <button onClick={() => handlePrint(r)} className="text-gray-400 hover:text-white hover:scale-110 transition-all cursor-pointer">
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-500 font-sans">
                      No gas billing records found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 🔘 LOG NEW READING MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 print:hidden">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-gold">
              <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                <h3 className="font-bold text-sm text-orange-400 flex items-center gap-1.5">
                  🔥 Add New Gas Reading & Safety Log
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleAddReading} className="space-y-3.5 text-xs font-semibold">
                <div>
                  <label className="text-gray-400 block mb-1">Apartment Code</label>
                  <input 
                    type="text" 
                    value={newApt} 
                    onChange={e => setNewApt(e.target.value)} 
                    placeholder="e.g., 108" 
                    className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-850 text-white focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Tenant / Resident Name</label>
                  <input 
                    type="text" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)} 
                    placeholder="e.g., Muhammad Bilal" 
                    className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-850 text-white focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Gas Units Used (HM3)</label>
                  <input 
                    type="number" 
                    value={newUnits} 
                    onChange={e => setNewUnits(e.target.value)} 
                    placeholder="0" 
                    className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-850 text-white focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Safety Inspection Status</label>
                  <select 
                    value={safetyStatus} 
                    onChange={e => setSafetyStatus(e.target.value as any)}
                    className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-850 text-white focus:outline-none"
                  >
                    <option value="Certified">Certified (Safe)</option>
                    <option value="Action Required">Action Required (Needs Check)</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-slate-850 flex gap-2 justify-end">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="bg-slate-950 hover:bg-slate-850 text-gray-300 font-bold px-4 py-2 rounded-lg uppercase cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-black px-4 py-2 rounded-lg uppercase cursor-pointer"
                  >
                    Save Log
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default GasBillingPage;
