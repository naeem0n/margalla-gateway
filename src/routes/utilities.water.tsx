import { createFileRoute, useNavigate } from '@tanstack/react-router';
import React, { useState } from 'react';
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Droplet, Flame, Zap, Search, Plus, Printer, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/utilities/water')({
  component: WaterBillingPage,
});

interface WaterRecord {
  id: number;
  apartment_no: string;
  resident_name: string;
  prev_reading: number;
  curr_reading: number;
  rate: number;
  status: "Paid" | "Unpaid";
  last_billing_date: string;
}

export function WaterBillingPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [records, setRecords] = useState<WaterRecord[]>([
    { id: 1, apartment_no: '108', resident_name: 'Sufiyan Zahoor', prev_reading: 1240, curr_reading: 1280, rate: 80, status: "Paid", last_billing_date: "2026-06-01" },
    { id: 2, apartment_no: '109', resident_name: 'Zeeshan Khan', prev_reading: 3410, curr_reading: 3465, rate: 80, status: "Unpaid", last_billing_date: "2026-06-01" },
    { id: 3, apartment_no: '204', resident_name: 'Kamran Ahmed', prev_reading: 890, curr_reading: 940, rate: 80, status: "Paid", last_billing_date: "2026-06-01" },
    { id: 4, apartment_no: '302', resident_name: 'Dr. Tariq Mahmood', prev_reading: 2450, curr_reading: 2510, rate: 80, status: "Unpaid", last_billing_date: "2026-06-01" }
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newApt, setNewApt] = useState("");
  const [newName, setNewName] = useState("");
  const [newPrev, setNewPrev] = useState("");
  const [newCurr, setNewCurr] = useState("");

  const handleAddReading = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApt || !newName || !newPrev || !newCurr) {
      toast.error("Please fill all fields");
      return;
    }
    const nextId = records.length > 0 ? Math.max(...records.map(r => r.id)) + 1 : 1;
    const newRecord: WaterRecord = {
      id: nextId,
      apartment_no: newApt,
      resident_name: newName,
      prev_reading: Number(newPrev),
      curr_reading: Number(newCurr),
      rate: 80,
      status: "Unpaid",
      last_billing_date: new Date().toISOString().split("T")[0]
    };
    setRecords([newRecord, ...records]);
    setIsModalOpen(false);
    setNewApt("");
    setNewName("");
    setNewPrev("");
    setNewCurr("");
    toast.success(`Water reading logged successfully for Apartment ${newApt}!`);
  };

  const toggleStatus = (id: number) => {
    setRecords(records.map(r => r.id === id ? { ...r, status: r.status === "Paid" ? "Unpaid" : "Paid" } : r));
    toast.success("Billing status updated!");
  };

  const handlePrint = (r: WaterRecord) => {
    toast.info(`Generating receipt print command for Apartment ${r.apartment_no}...`);
    window.print();
  };

  const filteredRecords = records.filter(r => 
    r.apartment_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.resident_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUnits = records.reduce((sum, r) => sum + (r.curr_reading - r.prev_reading), 0);
  const totalAmount = records.reduce((sum, r) => sum + ((r.curr_reading - r.prev_reading) * r.rate), 0);
  const outstandingAmount = records.reduce((sum, r) => r.status === "Unpaid" ? sum + ((r.curr_reading - r.prev_reading) * r.rate) : sum, 0);

  return (
    <AdminLayout title="💧 Water Billing & Consumption Manager">
      <div className="p-6 bg-slate-950 min-h-screen text-white space-y-6 font-sans print:bg-white print:text-black print:p-0">
        
        {/* 🏢 MARGALLA GATEWAY OFFICIAL PRINT LETTERHEAD */}
        <div className="hidden print:block text-center border-b-4 border-yellow-500 pb-4 mb-6">
          <h1 className="text-3xl font-black tracking-wider text-black">MARGALLA GATEWAY TOWERS</h1>
          <p className="text-xs uppercase tracking-widest text-gray-600 font-bold mt-1">E-11/4, Street No 26-A, Islamabad, Pakistan</p>
          <div className="flex justify-between items-center text-[10px] font-mono text-gray-500 mt-4">
            <span className="font-bold">DOCUMENT: WATER BILLING & CONSUMPTION REPORT</span>
            <span>DATE: {new Date().toLocaleDateString('en-PK')}</span>
          </div>
        </div>

        {/* 🔝 UPPER BANNER */}
        <div className="border-b border-slate-800 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
          <div>
            <h1 className="text-xl font-black text-cyan-400 tracking-wide flex items-center gap-2">
              💧 Water Consumption & Billing Portal
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">Standalone logs and management center for community water readings.</p>
          </div>
          
          {/* 🔄 RESTORED UTILITY TABS / LINKS */}
          <div className="flex gap-2 print:hidden bg-slate-900 p-1.5 rounded-xl border border-slate-850">
            <button onClick={() => navigate({ to: '/admin/bulk-utility' })} className="flex items-center gap-1.5 text-gray-400 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-800 hover:text-white transition-all cursor-pointer">
              <Zap className="h-3 w-3" /> Master Control
            </button>
            <button className="flex items-center gap-1.5 bg-cyan-950 text-cyan-400 px-3 py-1.5 rounded-lg text-xs font-semibold border border-cyan-800/40">
              💧 Water Billing
            </button>
            <button onClick={() => navigate({ to: '/utilities/gas' })} className="flex items-center gap-1.5 text-gray-400 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-800 hover:text-white transition-all cursor-pointer">
              <Flame className="h-3 w-3" /> Gas Management
            </button>
          </div>
        </div>

        {/* 📊 KPI METRICS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:hidden">
          <div className="bg-gradient-to-br from-cyan-950/60 to-slate-900 p-5 rounded-2xl border border-cyan-900/30 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-cyan-400 uppercase font-black tracking-widest">Total Consumption</span>
              <h2 className="text-2xl font-black mt-1 font-mono">{totalUnits.toLocaleString()} Gal</h2>
              <p className="text-[10px] text-gray-400 mt-1">Across all logged apartments</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-cyan-950 border border-cyan-800/40 flex items-center justify-center text-cyan-400">
              💧
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Total Recovery Pool</span>
              <h2 className="text-2xl font-black mt-1 font-mono text-emerald-400">PKR {totalAmount.toLocaleString()}</h2>
              <p className="text-[10px] text-gray-400 mt-1">Based on rate of PKR 80/Gal</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-emerald-400">
              💰
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-rose-400 uppercase font-black tracking-widest">Outstanding Balance</span>
              <h2 className="text-2xl font-black mt-1 font-mono text-rose-400">PKR {outstandingAmount.toLocaleString()}</h2>
              <p className="text-[10px] text-gray-400 mt-1">Unpaid billing invoices</p>
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
                💧 Water Billing Statement & Logs
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5 print:hidden">Search, update status, or record new monthly meter units.</p>
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
                className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-[10px] font-black px-4 py-2 rounded-lg uppercase tracking-wide flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Log Reading
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
                  <th className="p-3 text-center">Prev Reading</th>
                  <th className="p-3 text-center">Curr Reading</th>
                  <th className="p-3 text-center">Gallons Used</th>
                  <th className="p-3 text-right">Net Bill</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono print:divide-y print:divide-gray-400">
                {filteredRecords.map((r, index) => {
                  const units = r.curr_reading - r.prev_reading;
                  const bill = units * r.rate;
                  return (
                    <tr key={r.id} className="hover:bg-slate-950/40 print:text-black print:border-b print:border-gray-300">
                      <td className="p-3 text-center font-bold text-gray-500 print:text-black">{index + 1}</td>
                      <td className="p-3 text-yellow-500 font-extrabold print:text-black">{r.apartment_no}</td>
                      <td className="p-3 text-white font-semibold print:text-black">{r.resident_name}</td>
                      <td className="p-3 text-center text-gray-400 print:text-black">{r.prev_reading}</td>
                      <td className="p-3 text-center text-gray-300 print:text-black">{r.curr_reading}</td>
                      <td className="p-3 text-center font-bold text-cyan-400 print:text-black">{units} Gal</td>
                      <td className="p-3 text-right font-black text-amber-500 print:text-black">PKR {bill.toLocaleString()}</td>
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
                      No water billing records found matching your filters.
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
                <h3 className="font-bold text-sm text-cyan-400 flex items-center gap-1.5">
                  💧 Add New Water Reading Log
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 block mb-1">Previous Reading</label>
                    <input 
                      type="number" 
                      value={newPrev} 
                      onChange={e => setNewPrev(e.target.value)} 
                      placeholder="0" 
                      className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-850 text-white focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-1">Current Reading</label>
                    <input 
                      type="number" 
                      value={newCurr} 
                      onChange={e => setNewCurr(e.target.value)} 
                      placeholder="0" 
                      className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-850 text-white focus:outline-none"
                      required
                    />
                  </div>
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
                    className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-black px-4 py-2 rounded-lg uppercase cursor-pointer"
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

export default WaterBillingPage;
