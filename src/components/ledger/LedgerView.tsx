import { useState } from 'react';
import { FileText, Printer, RefreshCw, Calculator, HelpCircle, CheckCircle } from 'lucide-react';
import { printLedgerStatement } from '../../lib/print-ledger';

export default function LedgerView() {
  const [form, setForm] = useState({
    invoiceNo: 'MGT-FIN-101-2026',
    billingPeriod: 'June 2026',
    issueDate: new Date().toLocaleDateString('en-GB'),
    tenantName: 'naeem',
    apartmentNo: 'Apartment A-101',
    rent: 65000,
    maintenance: 3500,
    elecUnits: 0,
    elecRate: 100,
    gas: 120,
    arrears: 0,
    cashReceived: 10000,
  });

  const [toast, setToast] = useState('');

  const totalBill = form.rent + form.maintenance + (form.elecUnits * form.elecRate) + form.gas;
  const grossPayable = totalBill + form.arrears;
  const netArrears = grossPayable - form.cashReceived;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handlePrint = () => {
    printLedgerStatement({
      invoiceNo: form.invoiceNo,
      billingPeriod: form.billingPeriod,
      issueDate: form.issueDate,
      tenantName: form.tenantName,
      apartmentNo: form.apartmentNo,
      rent: form.rent,
      maintenance: form.maintenance,
      elecPrev: 0,
      elecCurr: form.elecUnits,
      elecUnits: form.elecUnits,
      elecRate: form.elecRate,
      gasPrev: 0,
      gasCurr: 0,
      gasUnits: 0,
      gasRate: 0,
      gas: form.gas,
      openingBalance: form.arrears,
      totalBill,
      arrears: form.arrears,
      grossPayable,
      cashReceived: form.cashReceived,
      netArrears,
    });
    showToast('Ledger statement sent to printer.');
  };

  const handleReset = () => {
    setForm({
      invoiceNo: 'MGT-FIN-101-2026',
      billingPeriod: 'June 2026',
      issueDate: new Date().toLocaleDateString('en-GB'),
      tenantName: 'naeem',
      apartmentNo: 'Apartment A-101',
      rent: 65000,
      maintenance: 3500,
      elecUnits: 0,
      elecRate: 100,
      gas: 120,
      arrears: 0,
      cashReceived: 10000,
    });
    showToast('Form reset to default.');
  };

  const fmt = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)] bg-background border border-border/50 rounded-xl overflow-hidden shadow-sm">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center text-primary">
            <FileText size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg text-foreground font-display tracking-tight">Resident Transaction Ledger</h1>
            <p className="text-muted-foreground text-xs">View, print and generate resident billing statements</p>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 border border-border text-foreground px-4.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            <RefreshCw size={13} /> Reset Form
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-[#cca43b] hover:bg-[#cca43b]/90 text-white px-4.5 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-md shadow-[#cca43b]/10 cursor-pointer"
          >
            <Printer size={14} /> Print Ledger Statement
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Form Area */}
        <div className="w-full lg:w-[380px] border-b lg:border-b-0 lg:border-r border-border p-6 overflow-y-auto space-y-5 bg-card/30 shrink-0">
          <h2 className="text-foreground font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
            <Calculator size={14} className="text-primary" /> Bill Entry Form
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider block mb-1.5">Invoice Number</label>
              <input
                type="text"
                value={form.invoiceNo}
                onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })}
                className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider block mb-1.5">Billing Period</label>
                <input
                  type="text"
                  value={form.billingPeriod}
                  onChange={(e) => setForm({ ...form, billingPeriod: e.target.value })}
                  className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider block mb-1.5">Issue Date</label>
                <input
                  type="text"
                  value={form.issueDate}
                  onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                  className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            </div>

            <div className="border-t border-border/60 my-4 pt-4" />

            <div>
              <label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider block mb-1.5">Tenant Name *</label>
              <input
                type="text"
                value={form.tenantName}
                onChange={(e) => setForm({ ...form, tenantName: e.target.value })}
                className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            <div>
              <label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider block mb-1.5">Apartment Number *</label>
              <input
                type="text"
                value={form.apartmentNo}
                onChange={(e) => setForm({ ...form, apartmentNo: e.target.value })}
                className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            <div className="border-t border-border/60 my-4 pt-4" />

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider block mb-1.5">Monthly Flat Rent</label>
                <input
                  type="number"
                  value={form.rent}
                  onChange={(e) => setForm({ ...form, rent: Number(e.target.value) || 0 })}
                  className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider block mb-1.5">Maintenance Fee</label>
                <input
                  type="number"
                  value={form.maintenance}
                  onChange={(e) => setForm({ ...form, maintenance: Number(e.target.value) || 0 })}
                  className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider block mb-1.5">Electricity Units</label>
                <input
                  type="number"
                  value={form.elecUnits}
                  onChange={(e) => setForm({ ...form, elecUnits: Number(e.target.value) || 0 })}
                  className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider block mb-1.5">Electricity Rate</label>
                <input
                  type="number"
                  value={form.elecRate}
                  onChange={(e) => setForm({ ...form, elecRate: Number(e.target.value) || 0 })}
                  className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider block mb-1.5">Fixed Gas Charges</label>
                <input
                  type="number"
                  value={form.gas}
                  onChange={(e) => setForm({ ...form, gas: Number(e.target.value) || 0 })}
                  className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider block mb-1.5">Arrears (Baqaya)</label>
                <input
                  type="number"
                  value={form.arrears}
                  onChange={(e) => setForm({ ...form, arrears: Number(e.target.value) || 0 })}
                  className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            </div>

            <div className="border-t border-border/60 my-4 pt-4" />

            <div>
              <label className="text-green-500 text-[10px] font-bold uppercase tracking-wider block mb-1.5">Cash Received (Paid)</label>
              <input
                type="number"
                value={form.cashReceived}
                onChange={(e) => setForm({ ...form, cashReceived: Number(e.target.value) || 0 })}
                className="w-full bg-background border border-green-500/30 text-green-500 font-bold rounded-lg px-3.5 py-2.5 text-sm placeholder-muted-foreground focus:outline-none focus:border-green-500/50 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Live Preview Area */}
        <div className="flex-1 bg-muted/40 p-6 lg:p-8 overflow-y-auto flex justify-center items-start">
          <div className="bg-white text-[#2d3748] w-full max-w-[700px] border border-[#e2e8f0] shadow-xl p-8 flex flex-col justify-between rounded-sm" style={{ borderTop: '8px solid #cca43b', height: 'fit-content' }}>
            
            {/* Logo/Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-[22px] font-bold text-[#1a202c] uppercase tracking-wide">Margalla Gateway</h2>
                <p className="text-[12px] text-[#718096] mt-0.5 font-medium">Luxury Residences • E-11/4, Street No 26-A, Islamabad, Pakistan</p>
              </div>
              <div className="text-[11px] font-bold bg-[#1a202c] text-white px-3.5 py-1.5 rounded uppercase tracking-wide">
                Financial Ledger &amp; Bill
              </div>
            </div>

            {/* Meta Details */}
            <div className="grid grid-cols-2 gap-4 pb-4 mb-6 border-b border-[#edf2f7]">
              <div>
                <h3 className="text-[10px] uppercase font-bold text-[#cca43b] tracking-widest mb-1.5">Statement Ledger Details</h3>
                <p className="text-[13px] text-[#2d3748]"><strong>Invoice #:</strong> {form.invoiceNo}</p>
                <p className="text-[13px] text-[#2d3748] mt-0.5"><strong>Billing Period:</strong> {form.billingPeriod}</p>
                <p className="text-[13px] text-[#2d3748] mt-0.5"><strong>Issue Date:</strong> {form.issueDate}</p>
              </div>
              <div>
                <h3 className="text-[10px] uppercase font-bold text-[#cca43b] tracking-widest mb-1.5">Tenant Info (Bill To)</h3>
                <p className="text-[13px] text-[#2d3748]"><strong>Tenant Name:</strong> {form.tenantName}</p>
                <p className="text-[13px] text-[#2d3748] mt-0.5"><strong>Apartment No:</strong> {form.apartmentNo}</p>
              </div>
            </div>

            {/* Table */}
            <table className="w-full border-collapse mb-6">
              <thead>
                <tr>
                  <th className="bg-[#1a202c] text-white text-left p-3 text-[11px] font-bold uppercase tracking-wider" style={{ width: '40%' }}>Description</th>
                  <th className="bg-[#1a202c] text-white text-left p-3 text-[11px] font-bold uppercase tracking-wider" style={{ width: '40%' }}>Details / Calculation System</th>
                  <th className="bg-[#1a202c] text-white text-right p-3 text-[11px] font-bold uppercase tracking-wider" style={{ width: '20%' }}>Amount (PKR)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3.5 border-b border-[#edf2f7]">
                    <div className="text-[13px] font-bold text-[#1a202c]">🏢 Monthly Flat Rent</div>
                  </td>
                  <td className="p-3.5 border-b border-[#edf2f7]">
                    <div className="text-[11px] text-[#718096]">Fixed Monthly Apartment Contract Rent</div>
                  </td>
                  <td className="p-3.5 border-b border-[#edf2f7] text-right text-[13px] font-bold">
                    {fmt(form.rent)}
                  </td>
                </tr>
                <tr>
                  <td className="p-3.5 border-b border-[#edf2f7]">
                    <div className="text-[13px] font-bold text-[#1a202c]">🛡️ Consolidated Maintenance Fee</div>
                  </td>
                  <td className="p-3.5 border-b border-[#edf2f7]">
                    <div className="text-[11px] text-[#718096]">Includes Water, Security, and Building Operations</div>
                  </td>
                  <td className="p-3.5 border-b border-[#edf2f7] text-right text-[13px] font-bold">
                    {fmt(form.maintenance)}
                  </td>
                </tr>
                <tr>
                  <td className="p-3.5 border-b border-[#edf2f7]">
                    <div className="text-[13px] font-bold text-[#1a202c]">⚡ Electricity Cost</div>
                  </td>
                  <td className="p-3.5 border-b border-[#edf2f7]">
                    <div className="text-[11px] text-[#718096]">Units Consumed: {form.elecUnits} @ PKR {form.elecRate}/unit</div>
                  </td>
                  <td className="p-3.5 border-b border-[#edf2f7] text-right text-[13px] font-bold">
                    {fmt(form.elecUnits * form.elecRate)}
                  </td>
                </tr>
                <tr>
                  <td className="p-3.5 border-b border-[#edf2f7]">
                    <div className="text-[13px] font-bold text-[#1a202c]">🔥 Fixed Gas Charges</div>
                  </td>
                  <td className="p-3.5 border-b border-[#edf2f7]">
                    <div className="text-[11px] text-[#718096]">Flat Rate Utility Charge</div>
                  </td>
                  <td className="p-3.5 border-b border-[#edf2f7] text-right text-[13px] font-bold">
                    {fmt(form.gas)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Financial Summary */}
            <div className="flex justify-end pt-3 border-t-2 border-[#1a202c]">
              <table className="w-[50%] text-[13px]">
                <tbody>
                  <tr>
                    <td className="p-2 text-[#4a5568]"><strong>Total Current Bill:</strong></td>
                    <td className="p-2 text-right"><strong>{fmt(totalBill)}</strong></td>
                  </tr>
                  <tr>
                    <td className="p-2 text-[#4a5568]">Previous Arrears (Baqaya):</td>
                    <td className="p-2 text-right">{fmt(form.arrears)}</td>
                  </tr>
                  <tr className="border-b border-[#edf2f7]">
                    <td className="p-2 text-[#4a5568]"><strong>Gross Payable Amount:</strong></td>
                    <td className="p-2 text-right"><strong>{fmt(grossPayable)}</strong></td>
                  </tr>
                  <tr>
                    <td className="p-2 text-[#2f855a] font-bold bg-[#f0fff4]">✔️ Cash Received (Paid):</td>
                    <td className="p-2 text-right text-[#2f855a] font-bold bg-[#f0fff4]">{fmt(form.cashReceived)}</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-[#c53030] font-black bg-[#fff5f5] border border-[#fed7d7]">❌ Net Arrears (Baqaya Balance):</td>
                    <td className="p-2 text-right text-[#c53030] font-black bg-[#fff5f5] border border-[#fed7d7]">{fmt(netArrears)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="text-center mt-12 text-[11px] text-[#a0aec0] italic">
              This is a system-generated financial ledger statement. Please clear pending arrears to avoid services suspension.
            </div>
          </div>
        </div>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-semibold px-5 py-3 rounded-xl z-50 flex items-center gap-2 shadow-lg">
          <CheckCircle className="w-4 h-4" /> {toast}
        </div>
      )}
    </div>
  );
}
