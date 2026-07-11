import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Building2, Zap, Flame, Wallet, FileText, Scale, Landmark, 
  Printer, Download, CheckCircle2, User, ArrowRightLeft, PlusCircle, MessageSquare
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

type TabType = "RV" | "PV" | "RI" | "REFUND";

export function CentralEntryPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("RV");
  const [residents, setResidents] = useState<any[]>([]);
  const [selectedApt, setSelectedApt] = useState<string>("");
  const [selectedRes, setSelectedRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Success states
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [lastVoucher, setLastVoucher] = useState<any>(null);

  // ----------------------------------------------------
  // FORM FIELDS: Receipt Voucher (RV)
  // ----------------------------------------------------
  const [rvNo, setRvNo] = useState("32350");
  const [rvDate, setRvDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [rvFrom, setRvFrom] = useState("");
  const [rvAccountNo, setRvAccountNo] = useState("");
  const [rvAmount, setRvAmount] = useState("");
  const [rvPayMode, setRvPayMode] = useState("Cash");
  const [rvPurpose, setRvPurpose] = useState("Maintenance");
  const [rvRemarks, setRvRemarks] = useState("");

  // ----------------------------------------------------
  // FORM FIELDS: Payment Voucher (PV)
  // ----------------------------------------------------
  const [pvNo, setPvNo] = useState("11535");
  const [pvDate, setPvDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [pvPaidTo, setPvPaidTo] = useState("");
  const [pvAmount, setPvAmount] = useState("0");
  const [pvPayMethod, setPvPayMethod] = useState("By Cash");
  const [pvRows, setPvRows] = useState<Array<{ no: string; date: string; noticeAmount: string; adjustment: string; netAmount: string; remarks: string }>>([
    { no: "1", date: format(new Date(), "yyyy-MM-dd"), noticeAmount: "0", adjustment: "0", netAmount: "0", remarks: "" }
  ]);

  // ----------------------------------------------------
  // FORM FIELDS: Rental Invoice (RI)
  // ----------------------------------------------------
  const [riNo, setRiNo] = useState("02831");
  const [riDate, setRiDate] = useState("2026-05-01");
  const [riTenantName, setRiTenantName] = useState("");
  const [riContact, setRiContact] = useState("0300-9382022");
  const [riCnic, setRiCnic] = useState("");
  const [riFlatNo, setRiFlatNo] = useState("801");
  const [riDurationFrom, setRiDurationFrom] = useState("2026-05-01");
  const [riDurationTo, setRiDurationTo] = useState("2026-05-31");
  const [riNoOfDays, setRiNoOfDays] = useState("30");
  const [riFurnished, setRiFurnished] = useState(false);
  const [riUnfurnished, setRiUnfurnished] = useState(true);
  const [riBedType, setRiBedType] = useState("2 Bed");
  // Electricity
  const [riElecPrev, setRiElecPrev] = useState("0");
  const [riElecCurr, setRiElecCurr] = useState("0");
  const [riElecRate, setRiElecRate] = useState("60");
  const [riElecMultiplier, setRiElecMultiplier] = useState("1");
  // Gas
  const [riGasBill, setRiGasBill] = useState("0");
  // Rent
  const [riBaseRent, setRiBaseRent] = useState("0");
  const [riMaintenance, setRiMaintenance] = useState("0");
  const [riParkSpots, setRiParkSpots] = useState("0");
  // Security Deposit
  const [riSecTotal, setRiSecTotal] = useState("0");
  const [riSecReceived, setRiSecReceived] = useState("0");

  // ----------------------------------------------------
  // FORM FIELDS: Refund Entry (REFUND)
  // ----------------------------------------------------
  const [refundOriginalType, setRefundOriginalType] = useState<"RV" | "PV" | "RI">("RV");
  const [refundOriginalVoucherNo, setRefundOriginalVoucherNo] = useState("");
  const [refundNo, setRefundNo] = useState("RF-001");
  const [refundDate, setRefundDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("Customer Request");
  const [refundPaymentMethod, setRefundPaymentMethod] = useState("Cash");

  const isUrdu = typeof localStorage !== "undefined" && localStorage.getItem("lang") === "ur";

  // Register window event listener to open globally
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      loadResidents();
      resetForm();
    };
    window.addEventListener("open-central-entry", handleOpen);
    return () => window.removeEventListener("open-central-entry", handleOpen);
  }, []);

  const loadResidents = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>("/users");
      if (res && res.users) {
        setResidents(res.users.filter((u: any) => u.role === "resident"));
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load residents");
    } finally {
      setLoading(false);
    }
  };

  const handleAptChange = (aptNo: string) => {
    setSelectedApt(aptNo);
    const res = residents.find(r => r.apartment_no === aptNo);
    setSelectedRes(res || null);
  };

  // Sync resident profile data to the form inputs when selectedRes changes
  useEffect(() => {
    if (selectedRes) {
      setRvFrom(selectedRes.full_name || "");
      setRvAccountNo(selectedRes.apartment_no || selectedRes.client_id || "");
      setPvPaidTo(selectedRes.full_name || "");
      setRiTenantName(selectedRes.full_name || "");
      setRiFlatNo(selectedRes.apartment_no || "");
      setRiContact(selectedRes.phone || "0300-9382022");
      setRiElecPrev(String(selectedRes.elec_curr || selectedRes.elec_prev || 0));
      setRiBaseRent(String(selectedRes.rent_amount || 0));
      setRiMaintenance(String(selectedRes.fixed_maintenance || 0));
      setRiParkSpots(String(selectedRes.extra_parking_spots ?? 0));
    }
  }, [selectedRes]);

  // Recalculate Total PV Amount when rows change
  useEffect(() => {
    const total = pvRows.reduce((sum, r) => sum + (Number(r.netAmount) || 0), 0);
    setPvAmount(String(total));
  }, [pvRows]);

  // Rental Invoice Calculations
  const elecUnits = Math.max(0, (Number(riElecCurr) || 0) - (Number(riElecPrev) || 0));
  const elecTotal = elecUnits * (Number(riElecRate) || 0) * (Number(riElecMultiplier) || 1);
  const [riParkingFee, setRiParkingFee] = useState("0");
  const totalReceivable = (Number(riBaseRent) || 0) + (Number(riMaintenance) || 0) + elecTotal + (Number(riGasBill) || 0) + (Number(riParkingFee) || 0);
  const securityPending = Math.max(0, (Number(riSecTotal) || 0) - (Number(riSecReceived) || 0));

    const handleWhatsAppShare = async () => {
    if (!success) {
      try {
        await handlePostDatabase();
      } catch (err) {
        toast.error("Failed to post transaction: " + (err.message || "Error"));
        return;
      }
    }
    const phone = selectedRes?.phone || riContact || "";
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    
    let text = "";
    if (activeTab === "RV") {
      text = `*RECEIPT VOUCHER (RV)*\nVoucher No: ${rvNo}\nDate: ${rvDate}\nReceived From: ${rvFrom || selectedRes?.full_name || "Valued Client"}\nApartment: ${selectedApt || "N/A"}\nAmount: PKR ${Number(rvAmount || 0).toLocaleString()}\nPayment Mode: ${rvPayMode}\nOn Account Of: ${rvPurpose}\n\n*Margalla Gateway Management*`;
    } else if (activeTab === "PV") {
      text = `*PAYMENT VOUCHER (PV)*\nVoucher No: ${pvNo}\nDate: ${pvDate}\nPaid To: ${pvPaidTo}\nAmount: PKR ${Number(pvAmount || 0).toLocaleString()}\nMethod: ${pvPayMethod}\n\n*Margalla Gateway Management*`;
    } else {
      text = `*RENTAL INVOICE*\nInvoice No: ${riNo}\nDate: ${riDate}\nTenant: ${riTenantName || selectedRes?.full_name || ""}\nApartment: ${riFlatNo || selectedApt}\nTotal Receivable: PKR ${Number(totalReceivable || 0).toLocaleString()}\n\n*Margalla Gateway Management*`;
    }

    const formattedPhone = cleanPhone ? (cleanPhone.startsWith("92") ? cleanPhone : "92" + cleanPhone.replace(/^0/, "")) : "";
    const url = formattedPhone 
      ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    
    window.open(url, "_blank");
    toast.success("Opening WhatsApp...");
  };

const resetForm = () => {
    setSuccess(false);
    setSelectedApt("");
    setSelectedRes(null);
    setSearchQuery("");
    
    // Reset RV
    setRvNo(String(Math.floor(30000 + Math.random() * 9999)));
    setRvDate(format(new Date(), "yyyy-MM-dd"));
    setRvFrom("");
    setRvAccountNo("");
    setRvAmount("");
    setRvPayMode("Cash");
    setRvPurpose("Maintenance");
    setRvRemarks("");

    // Reset PV
    setPvNo(String(Math.floor(10000 + Math.random() * 9999)));
    setPvDate(format(new Date(), "yyyy-MM-dd"));
    setPvPaidTo("");
    setPvAmount("0");
    setPvPayMethod("By Cash");
    setPvRows([{ no: "1", date: format(new Date(), "yyyy-MM-dd"), noticeAmount: "0", adjustment: "0", netAmount: "0", remarks: "" }]);

    // Reset RI
    setRiNo(String(Math.floor(2000 + Math.random() * 999)));
    setRiDate("2026-05-01");
    setRiTenantName("");
    setRiContact("0300-9382022");
    setRiCnic("");
    setRiFlatNo("801");
    setRiDurationFrom("2026-05-01");
    setRiDurationTo("2026-05-31");
    setRiNoOfDays("30");
    setRiFurnished(false);
    setRiUnfurnished(true);
    setRiBedType("2 Bed");
    setRiElecPrev("0");
    setRiElecCurr("0");
    setRiElecRate("60");
    setRiElecMultiplier("1");
    setRiGasBill("0");
    setRiBaseRent("0");
    setRiMaintenance("0");
    setRiParkSpots("0");
    setRiSecTotal("0");
    setRiSecReceived("0");
  };

  // ----------------------------------------------------
  // PV TABLE ROW HANDLERS
  // ----------------------------------------------------
  const addPvRow = () => {
    setPvRows([
      ...pvRows,
      {
        no: String(pvRows.length + 1),
        date: format(new Date(), "yyyy-MM-dd"),
        noticeAmount: "0",
        adjustment: "0",
        netAmount: "0",
        remarks: ""
      }
    ]);
  };

  const removePvRow = (index: number) => {
    if (pvRows.length === 1) return;
    const updated = pvRows.filter((_, i) => i !== index);
    const reindexed = updated.map((r, i) => ({ ...r, no: String(i + 1) }));
    setPvRows(reindexed);
  };

  const updatePvRow = (index: number, field: string, val: string) => {
    const updated = [...pvRows];
    updated[index] = { ...updated[index], [field]: val };
    setPvRows(updated);
  };

  // ----------------------------------------------------
  // AMOUNT IN WORDS HELPER
  // ----------------------------------------------------
  const amountToWords = (n: number): string => {
    if (!n || isNaN(n)) return 'Zero Rupees Only';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const toWords = (num: number): string => {
      if (num === 0) return '';
      if (num < 20) return ones[num] + ' ';
      if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '') + ' ';
      if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred ' + toWords(num % 100);
      if (num < 100000) return toWords(Math.floor(num / 1000)) + 'Thousand ' + toWords(num % 1000);
      if (num < 10000000) return toWords(Math.floor(num / 100000)) + 'Lakh ' + toWords(num % 100000);
      return toWords(Math.floor(num / 10000000)) + 'Crore ' + toWords(num % 10000000);
    };
    const integer = Math.floor(Math.abs(n));
    const result = toWords(integer).trim();
    return result ? result + ' Rupees Only' : 'Zero Rupees Only';
  };
  // PRINT & PDF ENGINE
  // ----------------------------------------------------
  const handlePrintOrSave = async (actionType: "print" | "pdf", copies: 'a5' | 'a4double' = 'a5') => {
    if (!success) {
      try {
        await handlePostDatabase();
      } catch (err) {
        toast.error("Failed to post transaction: " + (err.message || "Error"));
        return;
      }
    }
    if (actionType === "pdf") {
      toast.success("Initiating PDF Export generation...");
    } else {
      toast.success(copies === 'a4double' ? "Formatting A4 double-copy layout..." : "Formatting A5 premium layout...");
    }

    // ─── BUILD VOUCHER HTML BODY ──────────────────────────────────
    let voucherHtml = '';

    if (activeTab === 'RV') {
      // ━━━━━━━━━━━━━━━━━━ RECEIPT VOUCHER — GREEN THEME ━━━━━━━━━━━
      const amt = Number(rvAmount) || 0;
      const amtWords = amountToWords(amt);
      voucherHtml = `
        <div style="font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;width:100%;padding:4px;">
          <!-- Accent Bar -->
          <div style="background:#16a34a;height:8px;border-radius:6px 6px 0 0;"></div>
          <!-- Header -->
          <div style="background:#f0fdf4;border:2px solid #86efac;border-top:none;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:22px;font-weight:900;color:#14532d;letter-spacing:0.5px;">MARGALLA GATEWAY</div>
              <div style="font-size:9px;color:#16a34a;font-weight:800;letter-spacing:3px;text-transform:uppercase;margin-top:2px;">Luxury Residences · Islamabad</div>
              <div style="font-size:9px;color:#475569;margin-top:4px;font-weight:700;">E-11/4, Street 26-A, Islamabad · +92 (51) 111-222-333</div>
            </div>
            <div style="text-align:right;">
              <div style="background:#14532d;color:#fff;padding:6px 14px;border-radius:6px;font-size:13px;font-weight:900;letter-spacing:1px;display:inline-block;">RECEIPT VOUCHER</div>
              <div style="font-size:11px;color:#15803d;font-weight:800;margin-top:5px;">RV No. <strong style="color:#14532d;font-size:15px;font-weight:900;">#${rvNo}</strong></div>
              <div style="font-size:9.5px;color:#475569;font-weight:700;margin-top:2px;">Date: ${rvDate}</div>
            </div>
          </div>
          <!-- Received From Box -->
          <div style="border:2px solid #86efac;border-top:none;padding:14px 20px;background:#fff;">
            <div style="font-size:9.5px;font-weight:900;color:#15803d;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">Received With Thanks From</div>
            <div style="display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:14px;">
              <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:8px;padding:8px 12px;">
                <div style="font-size:8.5px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">Name</div>
                <div style="font-size:14px;font-weight:900;color:#14532d;margin-top:3px;">${rvFrom || '—'}</div>
              </div>
              <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:8px;padding:8px 12px;">
                <div style="font-size:8.5px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">Apt / Account No</div>
                <div style="font-size:14px;font-weight:900;color:#14532d;margin-top:3px;">${rvAccountNo || '—'}</div>
              </div>
              <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:8px;padding:8px 12px;">
                <div style="font-size:8.5px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">On Account Of</div>
                <div style="font-size:14px;font-weight:900;color:#14532d;margin-top:3px;">${rvPurpose}</div>
              </div>
            </div>
          </div>
          <!-- Amount Box -->
          <div style="border:2px solid #86efac;border-top:none;padding:14px 20px;background:#fff;display:flex;align-items:center;gap:20px;">
            <div style="background:#16a34a;color:#fff;border-radius:10px;padding:12px 20px;text-align:center;flex-shrink:0;box-shadow:0 2px 4px rgba(0,0,0,0.05);">
              <div style="font-size:8.5px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;opacity:0.9;">AMOUNT RECEIVED</div>
              <div style="font-size:24px;font-weight:900;letter-spacing:1px;margin-top:2px;">PKR ${amt.toLocaleString()}</div>
            </div>
            <div style="flex:1;">
              <div style="font-size:8.5px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Rupees in Words</div>
              <div style="font-size:12.5px;color:#14532d;font-weight:900;font-style:italic;border-bottom:2px dashed #bbf7d0;padding-bottom:4px;">${amtWords}</div>
              <div style="margin-top:8px;display:flex;align-items:center;gap:8px;">
                <div style="font-size:9px;color:#475569;font-weight:800;text-transform:uppercase;">Payment Mode:</div>
                <span style="display:inline-block;background:#14532d;color:#fff;padding:3px 10px;border-radius:20px;font-size:9.5px;font-weight:900;letter-spacing:1px;text-transform:uppercase;">${rvPayMode}</span>
              </div>
            </div>
          </div>
          <!-- Purpose / Remarks -->
          ${rvRemarks ? `
          <div style="border:2px solid #86efac;border-top:none;padding:10px 20px;background:#f8fafc;">
            <div style="font-size:8.5px;font-weight:800;color:#16a34a;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Remarks / Reference Details</div>
            <div style="font-size:11.5px;font-weight:700;color:#334155;line-height:1.4;">${rvRemarks}</div>
          </div>` : ''}
          <!-- Notice Strip -->
          <div style="border:2px solid #86efac;border-top:none;background:#fefce8;padding:6px 20px;border-bottom:none;">
            <div style="font-size:9px;color:#854d0e;font-weight:800;">⚠ This receipt is valid subject to realization of cheques. E.&amp;O.E.</div>
          </div>
          <!-- Signature Blocks -->
          <div style="border:2px solid #86efac;border-top:1px solid #e2e8f0;padding:28px 20px 14px;background:#fff;display:grid;grid-template-columns:1fr 1fr;gap:40px;">
            <div style="text-align:center;">
              <div style="border-top:2px solid #16a34a;padding-top:8px;font-size:10.5px;color:#0f172a;font-weight:800;">Cashier / Accounts<br><span style="color:#64748b;font-size:8.5px;font-weight:600;">Margalla Gateway</span></div>
            </div>
            <div style="text-align:center;">
              <div style="border-top:2px solid #16a34a;padding-top:8px;font-size:10.5px;color:#0f172a;font-weight:800;">Received By<br><span style="color:#64748b;font-size:8.5px;font-weight:600;">Signature &amp; CNIC</span></div>
            </div>
          </div>
          <!-- Footer -->
          <div style="border:2px solid #86efac;border-top:none;border-radius:0 0 6px 6px;background:#f0fdf4;padding:6px 20px;text-align:center;">
            <div style="font-size:7.5px;color:#475569;font-weight:700;">Generated: ${new Date().toLocaleString()} · Margalla Gateway Management System · Computer Generated Document</div>
          </div>
        </div>
      `;

    } else if (activeTab === 'PV') {
      // ━━━━━━━━━━━━━━━━━━ PAYMENT VOUCHER — ORANGE THEME ━━━━━━━━━━━
      const amt = Number(pvAmount) || 0;
      const amtWords = amountToWords(amt);
      const pvRowsHtml = pvRows.map((r, i) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#fff7ed'};">
          <td style="padding:6px 10px;border-bottom:1px solid #fed7aa;font-size:9.5px;text-align:center;font-weight:700;color:#9a3412;">${r.no}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #fed7aa;font-size:9.5px;font-weight:700;color:#374151;">${r.date}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #fed7aa;font-size:9.5px;text-align:right;font-weight:800;">PKR ${Number(r.noticeAmount).toLocaleString()}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #fed7aa;font-size:9.5px;text-align:right;font-weight:800;color:#dc2626;">PKR ${Number(r.adjustment).toLocaleString()}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #fed7aa;font-size:9.5px;text-align:right;font-weight:900;color:#15803d;">PKR ${Number(r.netAmount).toLocaleString()}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #fed7aa;font-size:9.5px;font-weight:700;color:#64748b;">${r.remarks || '—'}</td>
        </tr>
      `).join('');
      voucherHtml = `
        <div style="font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;width:100%;padding:4px;">
          <!-- Accent Bar -->
          <div style="background:#ea580c;height:8px;border-radius:6px 6px 0 0;"></div>
          <!-- Header -->
          <div style="background:#fff7ed;border:2px solid #ffedd5;border-top:none;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:22px;font-weight:900;color:#7c2d12;letter-spacing:0.5px;">MARGALLA GATEWAY</div>
              <div style="font-size:9px;color:#ea580c;font-weight:800;letter-spacing:3px;text-transform:uppercase;margin-top:2px;">Luxury Residences · Islamabad</div>
              <div style="font-size:9px;color:#475569;margin-top:4px;font-weight:700;">E-11/4, Street 26-A, Islamabad · +92 (51) 111-222-333</div>
            </div>
            <div style="text-align:right;">
              <div style="background:#7c2d12;color:#fff;padding:6px 14px;border-radius:6px;font-size:13px;font-weight:900;letter-spacing:1px;display:inline-block;">PAYMENT VOUCHER</div>
              <div style="font-size:11px;color:#c2410c;font-weight:800;margin-top:5px;">PV No. <strong style="color:#7c2d12;font-size:15px;font-weight:900;">#${pvNo}</strong></div>
              <div style="font-size:9.5px;color:#475569;font-weight:700;margin-top:2px;">Date: ${pvDate}</div>
            </div>
          </div>
          <!-- Paid To Box -->
          <div style="border:2px solid #ffedd5;border-top:none;padding:14px 20px;background:#fff;display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:8px;padding:8px 12px;">
              <div style="font-size:8.5px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">Paid To</div>
              <div style="font-size:14px;font-weight:900;color:#7c2d12;margin-top:3px;">${pvPaidTo || '—'}</div>
            </div>
            <div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:8px;padding:8px 12px;">
              <div style="font-size:8.5px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">Payment Method / Reference</div>
              <div style="font-size:14px;font-weight:900;color:#7c2d12;margin-top:3px;">${pvPayMethod}</div>
            </div>
          </div>
          <!-- Breakdown Table -->
          <div style="border:2px solid #ffedd5;border-top:none;background:#fff;overflow:hidden;">
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#ea580c;color:#fff;">
                  <th style="padding:7px 10px;font-size:8.5px;text-transform:uppercase;font-weight:800;text-align:center;width:40px;border-bottom:2px solid #c2410c;">No.</th>
                  <th style="padding:7px 10px;font-size:8.5px;text-transform:uppercase;font-weight:800;border-bottom:2px solid #c2410c;text-align:left;">Date</th>
                  <th style="padding:7px 10px;font-size:8.5px;text-transform:uppercase;font-weight:800;text-align:right;border-bottom:2px solid #c2410c;">Amount</th>
                  <th style="padding:7px 10px;font-size:8.5px;text-transform:uppercase;font-weight:800;text-align:right;border-bottom:2px solid #c2410c;">Adjustment</th>
                  <th style="padding:7px 10px;font-size:8.5px;text-transform:uppercase;font-weight:800;text-align:right;border-bottom:2px solid #c2410c;">Net Amount</th>
                  <th style="padding:7px 10px;font-size:8.5px;text-transform:uppercase;font-weight:800;border-bottom:2px solid #c2410c;text-align:left;">Remarks</th>
                </tr>
              </thead>
              <tbody>${pvRowsHtml}</tbody>
            </table>
          </div>
          <!-- Total Box -->
          <div style="border:2px solid #ffedd5;border-top:none;padding:14px 20px;background:#fff;display:flex;align-items:center;gap:20px;">
            <div style="background:#ea580c;color:#fff;border-radius:10px;padding:12px 20px;text-align:center;flex-shrink:0;box-shadow:0 2px 4px rgba(0,0,0,0.05);">
              <div style="font-size:8.5px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;opacity:0.9;">TOTAL PAID</div>
              <div style="font-size:24px;font-weight:900;letter-spacing:1px;margin-top:2px;">PKR ${amt.toLocaleString()}</div>
            </div>
            <div style="flex:1;">
              <div style="font-size:8.5px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Amount in Words</div>
              <div style="font-size:12.5px;color:#7c2d12;font-weight:900;font-style:italic;border-bottom:2px dashed #fed7aa;padding-bottom:4px;">${amtWords}</div>
            </div>
          </div>
          <!-- Signature Blocks -->
          <div style="border:2px solid #ffedd5;border-top:1px solid #e2e8f0;padding:28px 20px 14px;background:#fff;display:grid;grid-template-columns:repeat(4,1fr);gap:20px;">
            <div style="text-align:center;"><div style="border-top:2px solid #ea580c;padding-top:8px;font-size:10.5px;color:#0f172a;font-weight:800;">Prepared By<br><span style="color:#64748b;font-size:8.5px;font-weight:600;">(Accounts)</span></div></div>
            <div style="text-align:center;"><div style="border-top:2px solid #ea580c;padding-top:8px;font-size:10.5px;color:#0f172a;font-weight:800;">Checked By<br><span style="color:#64748b;font-size:8.5px;font-weight:600;">(Office)</span></div></div>
            <div style="text-align:center;"><div style="border-top:2px solid #ea580c;padding-top:8px;font-size:10.5px;color:#0f172a;font-weight:800;">Approved By<br><span style="color:#64748b;font-size:8.5px;font-weight:600;">(Manager)</span></div></div>
            <div style="text-align:center;"><div style="border-top:2px solid #ea580c;padding-top:8px;font-size:10.5px;color:#0f172a;font-weight:800;">Received By<br><span style="color:#64748b;font-size:8.5px;font-weight:600;">(Sign &amp; Date)</span></div></div>
          </div>
          <!-- Footer -->
          <div style="border:2px solid #ffedd5;border-top:none;border-radius:0 0 6px 6px;background:#fff7ed;padding:6px 20px;text-align:center;">
            <div style="font-size:7.5px;color:#475569;font-weight:700;">Generated: ${new Date().toLocaleString()} · Margalla Gateway Management System · Computer Generated Document</div>
          </div>
        </div>
      `;

    } else if (activeTab === 'RI') {
      // ━━━━━━━━━━━━━━━━━━ RENTAL INVOICE — NAVY / GOLD THEME ━━━━━━━━
      const grandTotal = amountToWords(totalReceivable);
      const specLabel = `${riBedType} · ${riFurnished ? 'Furnished' : 'Un-Furnished'}`;
      const floorNo = riFlatNo ? `Floor ${riFlatNo.toString().charAt(0)}` : '—';
      const riRowsData = [
        { label: 'Base Rent', detail: `Monthly Rental — ${riBedType}`, rate: '—', amount: Number(riBaseRent) },
        { label: 'Maintenance Charges', detail: 'Fixed Monthly Maintenance', rate: '—', amount: Number(riMaintenance) },
        { label: 'Electricity Dues', detail: `Prev: ${riElecPrev} → Curr: ${riElecCurr} (${elecUnits} units)`, rate: `PKR ${riElecRate}/unit × ${riElecMultiplier}`, amount: elecTotal },
        { label: 'Gas Charges', detail: 'Flat Gas Bill', rate: '—', amount: Number(riGasBill) },
        { label: 'Parking Charges', detail: `${riParkSpots} Extra Spot(s) · 1st Free`, rate: 'PKR 2,000/spot', amount: riParkingFee },
      ];
      const riRowsHtml = riRowsData.filter(r => r.amount > 0).map((r, i) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'};">
          <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-size:10px;font-weight:800;color:#0f2346;">${r.label}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-size:9.5px;font-weight:700;color:#64748b;">${r.detail}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-size:9.5px;font-weight:700;color:#475569;text-align:center;">${r.rate}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-size:10.5px;font-weight:900;color:#0f2346;text-align:right;">PKR ${r.amount.toLocaleString()}</td>
        </tr>
      `).join('');
      voucherHtml = `
        <div style="font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;width:100%;padding:4px;">
          <!-- Accent Bar -->
          <div style="background:linear-gradient(90deg,#0f2346,#1e3a5f);height:8px;border-radius:6px 6px 0 0;"></div>
          <!-- Header -->
          <div style="background:#0f2346;border:2px solid #1e293b;border-top:none;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;color:#fff;">
            <div>
              <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:0.5px;">MARGALLA GATEWAY</div>
              <div style="font-size:9px;color:#D4AF37;font-weight:800;letter-spacing:3px;text-transform:uppercase;margin-top:2px;">Luxury Residences · Islamabad</div>
              <div style="font-size:9px;color:#94a3b8;margin-top:4px;font-weight:700;">E-11/4, Street No. 26-A, Islamabad, Pakistan · +92 (51) 111-222-333</div>
            </div>
            <div style="text-align:right;">
              <div style="background:#D4AF37;color:#0f2346;padding:6px 14px;border-radius:6px;font-size:13px;font-weight:900;letter-spacing:1px;display:inline-block;">RENTAL INVOICE</div>
              <div style="font-size:11px;color:#D4AF37;font-weight:800;margin-top:5px;">Invoice No. <strong style="color:#fff;font-size:15px;font-weight:900;">#${riNo}</strong></div>
              <div style="font-size:9.5px;color:#94a3b8;font-weight:700;margin-top:2px;">Date: ${riDate}</div>
            </div>
          </div>
          <!-- Tenant Info Box -->
          <div style="border:2px solid #cbd5e1;border-top:3px solid #D4AF37;padding:14px 20px;background:#f8fafc;">
            <div style="font-size:9.5px;font-weight:900;color:#0f2346;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;border-bottom:1.5px solid #e2e8f0;padding-bottom:5px;">Tenant Information</div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
              <div><div style="font-size:8px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">Tenant Name</div><div style="font-size:12px;font-weight:900;color:#0f2346;margin-top:2px;">${riTenantName || '—'}</div></div>
              <div><div style="font-size:8px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">CNIC No.</div><div style="font-size:12px;font-weight:900;color:#0f2346;margin-top:2px;">${riCnic || '—'}</div></div>
              <div><div style="font-size:8px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">Contact</div><div style="font-size:12px;font-weight:900;color:#0f2346;margin-top:2px;">${riContact || '—'}</div></div>
              <div><div style="font-size:8px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">Apartment No.</div><div style="font-size:14px;font-weight:950;color:#D4AF37;margin-top:2px;">${riFlatNo || '—'}</div></div>
              <div><div style="font-size:8px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">Floor</div><div style="font-size:12px;font-weight:900;color:#0f2346;margin-top:2px;">${floorNo}</div></div>
              <div><div style="font-size:8px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">Type</div><div style="font-size:12px;font-weight:900;color:#0f2346;margin-top:2px;">${specLabel}</div></div>
              <div><div style="font-size:8px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">Duration</div><div style="font-size:10px;font-weight:900;color:#0f2346;margin-top:2px;white-space:nowrap;">${riDurationFrom} → ${riDurationTo}</div></div>
              <div><div style="font-size:8px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">Days Stayed</div><div style="font-size:12px;font-weight:900;color:#0f2346;margin-top:2px;">${riNoOfDays} Days</div></div>
            </div>
          </div>
          <!-- Billing Table -->
          <div style="border:2px solid #cbd5e1;border-top:none;background:#fff;overflow:hidden;">
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#0f2346;color:#fff;">
                  <th style="padding:7px 12px;font-size:8.5px;text-transform:uppercase;font-weight:800;text-align:left;border-bottom:2px solid #1e293b;">Item Description</th>
                  <th style="padding:7px 12px;font-size:8.5px;text-transform:uppercase;font-weight:800;text-align:left;border-bottom:2px solid #1e293b;">Details / Readings</th>
                  <th style="padding:7px 12px;font-size:8.5px;text-transform:uppercase;font-weight:800;text-align:center;border-bottom:2px solid #1e293b;width:120px;">Rate / Unit</th>
                  <th style="padding:7px 12px;font-size:8.5px;text-transform:uppercase;font-weight:800;text-align:right;border-bottom:2px solid #1e293b;color:#D4AF37;width:120px;">Amount (PKR)</th>
                </tr>
              </thead>
              <tbody>${riRowsHtml}</tbody>
            </table>
          </div>
          <!-- Grand Total -->
          <div style="border:2px solid #cbd5e1;border-top:none;padding:14px 20px;background:#fff;display:flex;align-items:center;gap:20px;">
            <div style="background:#0f2346;color:#fff;border-radius:10px;padding:12px 20px;text-align:center;flex-shrink:0;box-shadow:0 2px 4px rgba(0,0,0,0.05);">
              <div style="font-size:8.5px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#D4AF37;">GRAND TOTAL</div>
              <div style="font-size:24px;font-weight:900;color:#D4AF37;margin-top:2px;">PKR ${totalReceivable.toLocaleString()}</div>
            </div>
            <div style="flex:1;">
              <div style="font-size:8.5px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Amount in Words</div>
              <div style="font-size:12px;color:#0f2346;font-weight:900;font-style:italic;border-bottom:2px dashed #cbd5e1;padding-bottom:4px;">${grandTotal}</div>
            </div>
          </div>
          <!-- Notes -->
          <div style="border:2px solid #cbd5e1;border-top:none;background:#fffdf5;padding:6px 20px;">
            <div style="font-size:9px;color:#854d0e;font-weight:800;">📋 Notes: Settle within 7 days. Cheques subject to realization. accounts@margallagateway.com · E.&amp;O.E.</div>
          </div>
          <!-- Signature Blocks -->
          <div style="border:2px solid #cbd5e1;border-top:1px solid #cbd5e1;padding:28px 20px 14px;background:#fff;display:grid;grid-template-columns:repeat(4,1fr);gap:20px;">
            <div style="text-align:center;"><div style="border-top:2px solid #0f2346;padding-top:8px;font-size:10.5px;color:#0f172a;font-weight:800;">Prepared By<br><span style="color:#64748b;font-size:8.5px;font-weight:600;">(Accounts Dept)</span></div></div>
            <div style="text-align:center;"><div style="border-top:2px solid #0f2346;padding-top:8px;font-size:10.5px;color:#0f172a;font-weight:800;">Checked By<br><span style="color:#64748b;font-size:8.5px;font-weight:600;">(Office Staff)</span></div></div>
            <div style="text-align:center;"><div style="border-top:2px solid #0f2346;padding-top:8px;font-size:10.5px;color:#0f172a;font-weight:800;">Approved By<br><span style="color:#64748b;font-size:8.5px;font-weight:600;">(General Manager)</span></div></div>
            <div style="text-align:center;"><div style="border-top:2px solid #0f2346;padding-top:8px;font-size:10.5px;color:#0f172a;font-weight:800;">Received By<br><span style="color:#64748b;font-size:8.5px;font-weight:600;">(Signature &amp; Date)</span></div></div>
          </div>
          <!-- Footer -->
          <div style="border:2px solid #cbd5e1;border-top:none;border-radius:0 0 6px 6px;background:#0f2346;padding:6px 20px;text-align:center;">
            <div style="font-size:7.5px;color:#94a3b8;font-weight:700;">Generated: ${new Date().toLocaleString()} · Margalla Gateway Management System · Computer Generated Document</div>
          </div>
        </div>
      `;
    } else if (activeTab === 'REFUND') {
      // ━━━━━━━━━━━━━━━━━━ REFUND VOUCHER — RED THEME ━━━━━━━━━━━━━━
      voucherHtml = `
        <div style="font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;width:100%;padding:4px;">
          <!-- Accent Bar -->
          <div style="background:#dc2626;height:8px;border-radius:6px 6px 0 0;"></div>
          <!-- Header -->
          <div style="background:#fef2f2;border:2px solid #fca5a5;border-top:none;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:22px;font-weight:900;color:#991b1b;letter-spacing:0.5px;">MARGALLA GATEWAY</div>
              <div style="font-size:9px;color:#dc2626;font-weight:800;letter-spacing:3px;text-transform:uppercase;margin-top:2px;">Luxury Residences · Islamabad</div>
              <div style="font-size:9px;color:#475569;margin-top:4px;font-weight:700;">E-11/4, Street 26-A, Islamabad · +92 (51) 111-222-333</div>
            </div>
            <div style="text-align:right;">
              <div style="background:#991b1b;color:#fff;padding:6px 14px;border-radius:6px;font-size:13px;font-weight:900;letter-spacing:1px;display:inline-block;">REFUND VOUCHER</div>
              <div style="font-size:11px;color:#dc2626;font-weight:800;margin-top:5px;">Refund No. <strong style="color:#991b1b;font-size:15px;font-weight:900;">#${refundNo}</strong></div>
              <div style="font-size:9.5px;color:#475569;font-weight:700;margin-top:2px;">Date: ${refundDate}</div>
            </div>
          </div>
          <!-- Refund Details Box -->
          <div style="border:2px solid #fca5a5;border-top:none;padding:14px 20px;background:#fff;">
            <div style="font-size:9.5px;font-weight:900;color:#dc2626;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">Refund / Reversal Information</div>
            <div style="display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:14px;">
              <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:8px;padding:8px 12px;">
                <div style="font-size:8.5px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">Refunded To (Resident)</div>
                <div style="font-size:14px;font-weight:900;color:#991b1b;margin-top:3px;">${selectedRes ? selectedRes.full_name : 'System Record'}</div>
              </div>
              <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:8px;padding:8px 12px;">
                <div style="font-size:8.5px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">Original Voucher / Type</div>
                <div style="font-size:14px;font-weight:900;color:#991b1b;margin-top:3px;">${refundOriginalVoucherNo} (${refundOriginalType})</div>
              </div>
              <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:8px;padding:8px 12px;">
                <div style="font-size:8.5px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">Refund Method</div>
                <div style="font-size:14px;font-weight:900;color:#991b1b;margin-top:3px;">${refundPaymentMethod}</div>
              </div>
            </div>
          </div>
          <!-- Amount Box -->
          <div style="border:2px solid #fca5a5;border-top:none;padding:14px 20px;background:#fff;display:flex;align-items:center;gap:20px;">
            <div style="background:#dc2626;color:#fff;border-radius:10px;padding:12px 20px;text-align:center;flex-shrink:0;box-shadow:0 2px 4px rgba(0,0,0,0.05);">
              <div style="font-size:8.5px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;opacity:0.9;">TOTAL REFUNDED</div>
              <div style="font-size:24px;font-weight:900;letter-spacing:1px;margin-top:2px;">PKR ${Number(refundAmount).toLocaleString()}</div>
            </div>
            <div style="flex:1;">
              <div style="font-size:8.5px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Rupees in Words</div>
              <div style="font-size:12.5px;color:#991b1b;font-weight:900;font-style:italic;border-bottom:2px dashed #fecaca;padding-bottom:4px;">${amountToWords(Number(refundAmount) || 0)}</div>
            </div>
          </div>
          <!-- Reason / Remarks -->
          <div style="border:2px solid #fca5a5;border-top:none;padding:10px 20px;background:#f8fafc;border-bottom:none;">
            <div style="font-size:8.5px;font-weight:800;color:#dc2626;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Reason for Reversal</div>
            <div style="font-size:11.5px;font-weight:700;color:#334155;line-height:1.4;">${refundReason}</div>
          </div>
          <!-- Signature Blocks -->
          <div style="border:2px solid #fca5a5;border-top:1px solid #e2e8f0;padding:28px 20px 14px;background:#fff;display:grid;grid-template-columns:1fr 1fr;gap:40px;">
            <div style="text-align:center;">
              <div style="border-top:2px solid #dc2626;padding-top:8px;font-size:10.5px;color:#0f172a;font-weight:800;">Approved By (Manager)<br><span style="color:#64748b;font-size:8.5px;font-weight:600;">Margalla Gateway</span></div>
            </div>
            <div style="text-align:center;">
              <div style="border-top:2px solid #dc2626;padding-top:8px;font-size:10.5px;color:#0f172a;font-weight:800;">Received By (Signature)<br><span style="color:#64748b;font-size:8.5px;font-weight:600;">Resident / Receiver</span></div>
            </div>
          </div>
          <!-- Footer -->
          <div style="border:2px solid #fca5a5;border-top:none;border-radius:0 0 6px 6px;background:#fef2f2;padding:6px 20px;text-align:center;">
            <div style="font-size:7.5px;color:#475569;font-weight:700;">Generated: ${new Date().toLocaleString()} · Margalla Gateway Management System · Computer Generated Document</div>
          </div>
        </div>
      `;
    }

    // ─── BUILD PAGE SIZE WRAPPER ──────────────────────────────────
    const isA4Double = copies === 'a4double';
    // Double layout: Two identical A5 copies stacked vertically on one A4 Portrait page
    const pageStyle = `@page { size: A4 portrait; margin: 8mm 12mm; }`;

    const bodyContent = isA4Double ? `
      <div class="page-container">
        <div class="copy-container">${voucherHtml}</div>
        <div class="cut-line">✂ ─── FOLD OR CUT HERE ─── ✂</div>
        <div class="copy-container">${voucherHtml}</div>
      </div>
    ` : `
      <div class="single-container">${voucherHtml}</div>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${activeTab} Voucher - Margalla Gateway</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          ${pageStyle}
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1e293b; }
          .page-container { display: flex; flex-direction: column; width: 100%; height: 274mm; justify-content: space-between; padding-top: 1mm; }
          .copy-container { width: 100%; height: 125mm; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 12px 16px; background: #fff; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); display: flex; flex-direction: column; justify-content: space-between; }
          .cut-line { display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; color: #475569; border-top: 2px dashed #94a3b8; height: 1px; margin: 4mm 0; position: relative; text-align: center; }
          .single-container { width: 100%; max-width: 100%; border: 2px solid #cbd5e1; border-radius: 12px; padding: 16px; background: #fff; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); }
          @media print {
            body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            ${pageStyle}
          }
        </style>
      </head>
      <body>${bodyContent}</body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      setTimeout(() => {
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        }
        setTimeout(() => {
          try {
            if (iframe.parentNode) document.body.removeChild(iframe);
          } catch (e) {}
        }, 2000);
      }, 600);
    }
  };

  // ----------------------------------------------------
  // POST TO LEDGER DATABASE HANDLER
  const handlePostDatabase = async () => {
    if (activeTab === "RI" && !selectedRes) {
      toast.error("Please select a resident apartment first to link the ledger history!");
      return;
    }
    setSaving(true);
    try {
      if (activeTab === "RV") {
        const amount = Number(rvAmount) || 0;
        if (amount <= 0) throw new Error("Please enter a valid receipt amount");
        const targetUserId = selectedRes ? selectedRes.id : "system";

        // 1. Post ledger credit using Universal Accounting API
        const desc = `[RV-${rvNo}] Received from ${rvFrom} on account of ${rvPurpose}. Pay Mode: ${rvPayMode}. ${rvRemarks}`;
        
        // Use Universal Accounting System
        await apiFetch<any>("/accounting/rv", {
          method: "POST",
          body: JSON.stringify({
            voucher_no: rvNo,
            date: rvDate,
            tenant_id: targetUserId,
            apartment_no: selectedRes?.apartment_no || "",
            amount: amount,
            payment_method: rvPayMode,
            reference_no: rvAccountNo,
            remarks: rvRemarks,
            received_from: rvFrom,
            purpose: rvPurpose
          })
        });

        // 3. Update resident name in user profile if linked
        if (selectedRes && selectedRes.id !== "system") {
          await apiFetch("/query-bridge", {
            method: "POST",
            body: JSON.stringify({
              table: "users",
              action: "update",
              filters: [{ column: "id", value: selectedRes.id }],
              data: {
                full_name: rvFrom,
                updated_at: new Date().toISOString()
              }
            })
          });
        }

        setLastVoucher({
          type: "Receipt Voucher (RV)",
          voucher_no: rvNo,
          amount,
          date: rvDate,
          details: desc
        });
        setSuccessMsg("Receipt Voucher posted successfully to ledger & database!");
        setSuccess(true);
        toast.success("Receipt Voucher posted successfully!");
      } 
      
      else if (activeTab === "PV") {
        const amount = Number(pvAmount) || 0;
        if (amount <= 0) throw new Error("Voucher amount must be greater than zero");
        const targetUserId = selectedRes ? selectedRes.id : "system";

        // 1. Post PV via Universal Accounting API (records in tenant_ledger)
        const desc = `[PV-${pvNo}] Paid to ${pvPaidTo}. Method: ${pvPayMethod}. Breakdown: ${pvRows.map(r => `Notice: ${r.noticeAmount}, Adj: ${r.adjustment}, Net: ${r.netAmount}${r.remarks ? ` (${r.remarks})` : ""}`).join(' | ')}`;
        await apiFetch<any>("/accounting/pv", {
          method: "POST",
          body: JSON.stringify({
            voucher_no: pvNo,
            date: pvDate,
            paid_to: pvPaidTo,
            amount: amount,
            payment_method: pvPayMethod,
            category: "payment_voucher",
            remarks: pvRows.map(r => r.remarks).filter(Boolean).join(", "),
            tenant_id: targetUserId,
            apartment_no: selectedRes?.apartment_no || ""
          })
        });

        // 3. Update resident name in user profile if linked
        if (selectedRes && selectedRes.id !== "system") {
          await apiFetch("/query-bridge", {
            method: "POST",
            body: JSON.stringify({
              table: "users",
              action: "update",
              filters: [{ column: "id", value: selectedRes.id }],
              data: {
                full_name: pvPaidTo,
                updated_at: new Date().toISOString()
              }
            })
          });
        }

        setLastVoucher({
          type: "Payment Voucher (PV)",
          voucher_no: pvNo,
          amount,
          date: pvDate,
          details: desc
        });
        setSuccessMsg("Payment Voucher posted successfully to expenses & ledger!");
        setSuccess(true);
        toast.success("Payment Voucher posted successfully!");
      } 
      
      else if (activeTab === "RI") {
        if (totalReceivable <= 0) throw new Error("Rental Invoice total amount must be greater than zero");

        // 1. Post ledger debit for rent & utilities
        const desc = `[Rental Invoice RI-${riNo}] Rent: PKR ${riBaseRent} | Maint: PKR ${riMaintenance} | Elec: PKR ${elecTotal} (${elecUnits} units: ${riElecPrev} to ${riElecCurr}) | Gas: PKR ${riGasBill} | Parking: PKR ${riParkingFee} (${riParkSpots} extra spots) | Duration: ${riDurationFrom} to ${riDurationTo}`;
        await apiFetch<any>("/ledger", {
          method: "POST",
          body: JSON.stringify({
            user_id: selectedRes.id,
            entry_date: riDate,
            entry_type: "rent",
            description: desc,
            debit: totalReceivable,
            credit: 0,
            voucher_no: riNo.startsWith("RI-") ? riNo : `RI-${riNo}`
          })
        });

        // 2. Insert into invoices table
        await apiFetch('/query-bridge', {
          method: 'POST',
          body: JSON.stringify({
            table: 'invoices',
            action: 'insert',
            data: {
              invoice_no: riNo,
              date: riDate,
              tenant_id: selectedRes.id,
              apartment_no: riFlatNo,
              prev_reading: Number(riElecPrev) || 0,
              curr_reading: Number(riElecCurr) || 0,
              electricity_amount: elecTotal,
              gas_charges: Number(riGasBill) || 0,
              flat_rent: Number(riBaseRent) || 0,
              maintenance_charges: Number(riMaintenance) || 0,
              parking_charges: riParkingFee,
              previous_arrears: Number(selectedRes.outstanding_balance || 0),
              total_bill_amount: totalReceivable,
              amount_received: 0,
              current_balance: totalReceivable + Number(selectedRes.outstanding_balance || 0),
              units_consumed: elecUnits,
              grand_total: totalReceivable + Number(selectedRes.outstanding_balance || 0)
            }
          })
        });

        // 3. Update resident default parameters on users table
        await apiFetch("/query-bridge", {
          method: "POST",
          body: JSON.stringify({
            table: "users",
            action: "update",
            filters: [{ column: "id", value: selectedRes.id }],
            data: {
              full_name: riTenantName,
              phone: riContact,
              rent_amount: Number(riBaseRent) || 0,
              fixed_maintenance: Number(riMaintenance) || 0,
              extra_parking_spots: Number(riParkSpots) || 0,
              elec_prev: Number(riElecPrev) || 0,
              elec_curr: Number(riElecCurr) || 0,
              updated_at: new Date().toISOString()
            }
          })
        });

        // 4. Update meter readings in users table so they stick
        if (elecUnits > 0) {
          await apiFetch("/utility/meter-readings", {
            method: "POST",
            body: JSON.stringify({
              billing_month: riDate.substring(0, 7),
              utility_type: "electricity",
              readings: [{
                apartment_no: riFlatNo,
                user_id: selectedRes.id,
                prev_reading: Number(riElecPrev) || 0,
                curr_reading: Number(riElecCurr) || 0,
                units_consumed: elecUnits,
                cost_per_unit: Number(riElecRate) || 0,
                calculated_amount: elecTotal
              }]
            })
          });
        }

        setLastVoucher({
          type: "Rental Invoice",
          voucher_no: riNo,
          amount: totalReceivable,
          date: riDate,
          details: desc
        });
        setSuccessMsg("Rental Invoice posted successfully to invoices & ledger!");
        setSuccess(true);
        toast.success("Rental Invoice posted successfully!");
      }
      
      else if (activeTab === "REFUND") {
        const amount = Number(refundAmount) || 0;
        if (amount <= 0) throw new Error("Refund amount must be greater than zero");
        if (!refundOriginalVoucherNo) throw new Error("Please specify the original voucher number");
        const targetUserId = selectedRes ? selectedRes.id : "system";

        // Call the backend refund route
        await apiFetch<any>("/accounting/refund", {
          method: "POST",
          body: JSON.stringify({
            refund_no: refundNo,
            date: refundDate,
            original_type: refundOriginalType,
            original_voucher_no: refundOriginalVoucherNo,
            tenant_id: targetUserId,
            amount: amount,
            reason: refundReason,
            payment_method: refundPaymentMethod
          })
        });

        const desc = `[REFUND ${refundOriginalType} ${refundNo}] Original: ${refundOriginalVoucherNo} | Method: ${refundPaymentMethod} | Reason: ${refundReason}`;
        
        setLastVoucher({
          type: "Refund Voucher (RF)",
          voucher_no: refundNo,
          amount: amount,
          date: refundDate,
          details: desc
        });

        // Set next refund number sequence
        const match = refundNo.match(/RF-(\d+)/);
        if (match) {
          const nextSeq = parseInt(match[1], 10) + 1;
          setRefundNo(`RF-${String(nextSeq).padStart(3, "0")}`);
        } else {
          setRefundNo(`RF-${Date.now().toString().slice(-4)}`);
        }

        setSuccessMsg("Refund Voucher posted successfully to database & ledger!");
        setSuccess(true);
        toast.success("Refund Voucher posted successfully!");
      }

      await loadResidents();
    } catch (e: any) {
      toast.error(e.message || "Failed to post database transaction");
    } finally {
      setSaving(false);
    }
  };

  const filteredResidents = (residents || []).filter(r => {
    const q = (searchQuery || "").toLowerCase();
    return (r?.apartment_no || "").toLowerCase().includes(q) ||
           (r?.full_name || "").toLowerCase().includes(q);
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-6xl bg-slate-950 border border-slate-800 text-white rounded-2xl shadow-2xl p-6 font-sans overflow-y-auto max-h-[92vh]">
        <DialogHeader className="border-b border-slate-900 pb-3 flex justify-between flex-row items-center">
          <DialogTitle className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-slate-300 to-amber-300 uppercase tracking-widest flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-400" />
            {isUrdu ? "یونیورسل سینٹرل انٹری کونسول" : "Universal Central Entry Console"}
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center space-y-5 max-w-md mx-auto">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto animate-bounce" />
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-slate-100">{successMsg}</h2>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Voucher: {lastVoucher?.voucher_no}</p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                <Button onClick={() => handlePrintOrSave("print", "a5")} className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] uppercase font-bold py-3 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer">
                  <Printer className="h-4 w-4 text-emerald-400" /> Print A5
                </Button>
                <Button onClick={() => handlePrintOrSave("print", "a4double")} className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] uppercase font-bold py-3 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer">
                  <Printer className="h-4 w-4 text-amber-400" /> Print A4 (×2)
                </Button>
                <Button onClick={() => handlePrintOrSave("pdf", "a5")} className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] uppercase font-bold py-3 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer">
                  <Download className="h-4 w-4 text-blue-400" /> Download PDF
                </Button>
                <Button onClick={handleWhatsAppShare} className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] uppercase font-bold py-3 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer">
                  <MessageSquare className="h-4 w-4 text-emerald-500" /> WhatsApp
                </Button>
              </div>
              
              <Button onClick={resetForm} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-black uppercase tracking-widest py-3 rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-lg">
                <Landmark className="h-4 w-4" /> {isUrdu ? "مزید اندراج" : "New Entry / Reset Form"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 pt-4 text-xs">
            {/* Main Form Area */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Premium Horizontal Toggle Strip */}
              <div className="flex justify-center mb-6">
                <div className="flex bg-slate-900/80 p-1.5 rounded-full border border-slate-800 w-full max-w-2xl justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setActiveTab("RV")}
                    className={`flex-1 text-center py-2.5 rounded-full transition-all duration-300 font-bold text-xs uppercase tracking-wider cursor-pointer ${
                      activeTab === "RV"
                        ? "bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white border-2 border-[#d4af37] shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                        : "text-slate-400 hover:text-slate-200 bg-transparent border-2 border-transparent"
                    }`}
                  >
                    Receipt Voucher (RV)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("PV")}
                    className={`flex-1 text-center py-2.5 rounded-full transition-all duration-300 font-bold text-xs uppercase tracking-wider cursor-pointer ${
                      activeTab === "PV"
                        ? "bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white border-2 border-[#d4af37] shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                        : "text-slate-400 hover:text-slate-200 bg-transparent border-2 border-transparent"
                    }`}
                  >
                    Payment Voucher (PV)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("RI")}
                    className={`flex-1 text-center py-2.5 rounded-full transition-all duration-300 font-bold text-xs uppercase tracking-wider cursor-pointer ${
                      activeTab === "RI"
                        ? "bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white border-2 border-[#d4af37] shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                        : "text-slate-400 hover:text-slate-200 bg-transparent border-2 border-transparent"
                    }`}
                  >
                    Rental Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("REFUND")}
                    className={`flex-1 text-center py-2.5 rounded-full transition-all duration-300 font-bold text-xs uppercase tracking-wider cursor-pointer ${
                      activeTab === "REFUND"
                        ? "bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white border-2 border-red-500 shadow-[0_0_15px_rgba(244,63,94,0.4)]"
                        : "text-slate-400 hover:text-slate-200 bg-transparent border-2 border-transparent"
                    }`}
                  >
                    Refund Voucher (RF)
                  </button>
                </div>
              </div>

              {/* Resident Search Header */}
              <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">{isUrdu ? "فلیٹ تلاش کریں" : "Search Apartment / Unit"}</Label>
                  <div className="relative mt-1">
                    <Input
                      placeholder="Type Apartment No (e.g. 801, 502)..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      className="bg-slate-950 border-slate-800 text-xs text-white"
                    />
                    {showSuggestions && searchQuery.trim() !== "" && (
                      <div className="absolute z-50 w-full bg-slate-950 border border-slate-800 rounded-lg max-h-48 overflow-y-auto mt-1 shadow-2xl">
                        <div
                          className="p-2 hover:bg-slate-900 cursor-pointer text-xs border-b border-slate-900 text-amber-500 font-bold flex justify-between"
                          onClick={() => {
                            const virtualRes = { 
                              id: "system", 
                              full_name: searchQuery, 
                              apartment_no: "N/A", 
                              client_id: "CUSTOM" 
                            };
                            setSelectedRes(virtualRes);
                            setRvFrom(searchQuery);
                            setRvAccountNo("N/A");
                            setPvPaidTo(searchQuery);
                            setRiTenantName(searchQuery);
                            setRiFlatNo("N/A");
                            setShowSuggestions(false);
                          }}
                        >
                          <span>➕ Use Custom: "{searchQuery}"</span>
                        </div>
                        {filteredResidents.map((r) => (
                          <div
                            key={r.id}
                            className="p-2 hover:bg-slate-900 cursor-pointer text-xs border-b border-slate-900 flex justify-between"
                            onClick={() => {
                              handleAptChange(r.apartment_no);
                              setSearchQuery(r.apartment_no || "");
                              setShowSuggestions(false);
                            }}
                          >
                            <span className="font-bold text-slate-200">{r.apartment_no}</span>
                            <span className="text-slate-400">{r.full_name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <Label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">{isUrdu ? "منتخب شدہ رہائشی" : "Active Ledger Resident"}</Label>
                  <Input
                    value={selectedRes ? `${selectedRes.full_name} (${selectedRes.client_id || "N/A"})` : "No profile selected."}
                    className="bg-slate-950/60 border-slate-900 text-xs text-slate-400 mt-1"
                    readOnly
                  />
                </div>
              </div>

              {/* RENDER ACTIVE TAB VIEW */}
              {activeTab === "RV" && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-400">R. No.</Label>
                      <Input
                        value={rvNo}
                        onChange={(e) => setRvNo(e.target.value)}
                        className="bg-slate-900 border-slate-800 text-xs font-mono font-bold text-amber-500 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400">Date</Label>
                      <Input
                        type="date"
                        value={rvDate}
                        onChange={(e) => setRvDate(e.target.value)}
                        className="bg-slate-900 border-slate-800 text-xs mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-400">Received with Thanks From</Label>
                    <Input
                      value={rvFrom}
                      onChange={(e) => setRvFrom(e.target.value)}
                      placeholder="Enter payer name..."
                      className="bg-slate-900 border-slate-800 text-xs mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-400">Account / No</Label>
                      <Input
                        value={rvAccountNo}
                        onChange={(e) => setRvAccountNo(e.target.value)}
                        placeholder="Apartment or Client Account..."
                        className="bg-slate-900 border-slate-800 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400">Sum of Rupees (PKR)</Label>
                      <Input
                        type="number"
                        value={rvAmount}
                        onChange={(e) => setRvAmount(e.target.value)}
                        placeholder="Enter amount..."
                        className="bg-slate-900 border-slate-800 text-xs font-mono text-emerald-400 font-bold mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-400 block mb-1">Payment Mode</Label>
                    <div className="grid grid-cols-4 gap-2 mt-1">
                      {["Cash", "Cheque", "Pay Order", "Bank Draft"].map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setRvPayMode(mode)}
                          className={`py-2 rounded-lg font-bold text-center border transition text-xs cursor-pointer ${
                            rvPayMode === mode
                              ? "bg-amber-500/20 text-amber-500 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.2)] font-extrabold"
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-400 block mb-1">On Account of</Label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {["Maintenance", "Security", "Other Charges"].map((purpose) => (
                        <button
                          key={purpose}
                          type="button"
                          onClick={() => setRvPurpose(purpose)}
                          className={`py-2 rounded-lg font-bold text-center border transition text-xs cursor-pointer ${
                            rvPurpose === purpose
                              ? "bg-amber-500/20 text-amber-500 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.2)] font-extrabold"
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          {purpose}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-400">Remarks / Reference Details</Label>
                    <Textarea
                      value={rvRemarks}
                      onChange={(e) => setRvRemarks(e.target.value)}
                      placeholder="Type remarks here..."
                      rows={2}
                      className="bg-slate-900 border-slate-800 text-xs mt-1 resize-none"
                    />
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg text-center text-[10px] text-amber-500 font-semibold tracking-wider uppercase">
                    ⚠️ This Receipt is Valid Subject to Realization of Cheques
                  </div>
                </div>
              )}

              {activeTab === "PV" && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-400">Sr. No.</Label>
                      <Input
                        value={pvNo}
                        onChange={(e) => setPvNo(e.target.value)}
                        className="bg-slate-900 border-slate-800 text-xs font-mono font-bold text-amber-500 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400">Date</Label>
                      <Input
                        type="date"
                        value={pvDate}
                        onChange={(e) => setPvDate(e.target.value)}
                        className="bg-slate-900 border-slate-800 text-xs mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-400">Paid To (Payee Name)</Label>
                      <Input
                        value={pvPaidTo}
                        onChange={(e) => setPvPaidTo(e.target.value)}
                        placeholder="Enter payee details..."
                        className="bg-slate-900 border-slate-800 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400">By Cash / Cheque No / Reference</Label>
                      <Input
                        value={pvPayMethod}
                        onChange={(e) => setPvPayMethod(e.target.value)}
                        placeholder="e.g. Cash, Cheque #982310..."
                        className="bg-slate-900 border-slate-800 text-xs mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-slate-400 block">Data Matrix Breakdown Rows</Label>
                      <Button
                        type="button"
                        onClick={addPvRow}
                        className="bg-slate-800 hover:bg-slate-700 text-[10px] font-bold h-7 px-2 cursor-pointer border border-slate-700"
                      >
                        + Add Row
                      </Button>
                    </div>

                    <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                      <table className="w-full text-[10px] text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                            <th className="p-2 w-12 text-center">No.</th>
                            <th className="p-2 w-28">Date</th>
                            <th className="p-2 w-24">Notice Amt</th>
                            <th className="p-2 w-24">Adjustment</th>
                            <th className="p-2 w-28">Net Recd</th>
                            <th className="p-2">Remarks</th>
                            <th className="p-2 w-12 text-center"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {pvRows.map((row, idx) => (
                            <tr key={idx} className="border-b border-slate-900/60 hover:bg-slate-900/30">
                              <td className="p-2 text-center font-mono font-bold text-slate-500">{row.no}</td>
                              <td className="p-2">
                                <Input
                                  type="date"
                                  value={row.date}
                                  onChange={(e) => updatePvRow(idx, "date", e.target.value)}
                                  className="bg-slate-900 border-slate-800 h-7 text-[10px] px-1.5"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  value={row.noticeAmount}
                                  onChange={(e) => updatePvRow(idx, "noticeAmount", e.target.value)}
                                  className="bg-slate-900 border-slate-800 h-7 text-[10px] px-1.5 font-mono text-slate-300"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  value={row.adjustment}
                                  onChange={(e) => updatePvRow(idx, "adjustment", e.target.value)}
                                  className="bg-slate-900 border-slate-800 h-7 text-[10px] px-1.5 font-mono text-rose-400"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  value={row.netAmount}
                                  onChange={(e) => updatePvRow(idx, "netAmount", e.target.value)}
                                  className="bg-slate-900 border-slate-800 h-7 text-[10px] px-1.5 font-mono text-emerald-400 font-bold"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  value={row.remarks}
                                  onChange={(e) => updatePvRow(idx, "remarks", e.target.value)}
                                  placeholder="Notes..."
                                  className="bg-slate-900 border-slate-800 h-7 text-[10px] px-1.5"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => removePvRow(idx)}
                                  className="text-rose-500 hover:text-rose-400 font-bold text-xs"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-between items-center bg-black/25 p-3 rounded-lg border border-slate-900 mt-4">
                      <span className="text-slate-400 font-bold text-xs">Total Voucher Amount:</span>
                      <span className="text-emerald-400 font-black text-sm font-mono">PKR {Number(pvAmount).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "RI" && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-slate-400">Sr. No</Label>
                      <Input
                        value={riNo}
                        onChange={(e) => setRiNo(e.target.value)}
                        className="bg-slate-900 border-slate-800 text-xs font-mono font-bold text-amber-500 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400">Date</Label>
                      <Input
                        type="date"
                        value={riDate}
                        onChange={(e) => setRiDate(e.target.value)}
                        className="bg-slate-900 border-slate-800 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400">Flat No</Label>
                      <Input
                        value={riFlatNo}
                        onChange={(e) => setRiFlatNo(e.target.value)}
                        placeholder="e.g. 801..."
                        className="bg-slate-900 border-slate-800 text-xs mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-slate-400">Tenant Name</Label>
                      <Input
                        value={riTenantName}
                        onChange={(e) => setRiTenantName(e.target.value)}
                        placeholder="Name..."
                        className="bg-slate-900 border-slate-800 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400">Contact Details</Label>
                      <Input
                        value={riContact}
                        onChange={(e) => setRiContact(e.target.value)}
                        placeholder="e.g. 0300-9382022..."
                        className="bg-slate-900 border-slate-800 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400">CNIC No</Label>
                      <Input
                        value={riCnic}
                        onChange={(e) => setRiCnic(e.target.value)}
                        placeholder="37405-XXXXXXX-X..."
                        className="bg-slate-900 border-slate-800 text-xs mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-slate-400">Duration From</Label>
                      <Input
                        type="date"
                        value={riDurationFrom}
                        onChange={(e) => setRiDurationFrom(e.target.value)}
                        className="bg-slate-900 border-slate-800 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400">Duration To</Label>
                      <Input
                        type="date"
                        value={riDurationTo}
                        onChange={(e) => setRiDurationTo(e.target.value)}
                        className="bg-slate-900 border-slate-800 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400">No. of Days</Label>
                      <Input
                        type="number"
                        value={riNoOfDays}
                        onChange={(e) => setRiNoOfDays(e.target.value)}
                        className="bg-slate-900 border-slate-800 text-xs font-mono mt-1"
                      />
                    </div>
                  </div>

                  <div className="border border-slate-800 p-3 rounded-lg bg-slate-900/30">
                    <Label className="text-slate-400 block mb-2 font-bold text-[10px] uppercase tracking-wider">Property Specifications</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={riFurnished}
                            onChange={(e) => {
                              setRiFurnished(e.target.checked);
                              if (e.target.checked) setRiUnfurnished(false);
                            }}
                            className="rounded accent-blue-500 cursor-pointer"
                          />
                          Furnished
                        </label>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={riUnfurnished}
                            onChange={(e) => {
                              setRiUnfurnished(e.target.checked);
                              if (e.target.checked) setRiFurnished(false);
                            }}
                            className="rounded accent-blue-500 cursor-pointer"
                          />
                          Un-furnished (Default)
                        </label>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        {["1 Bedroom", "2 Bedroom", "3 Bedroom (Standard)", "3 Bedroom (Compact)", "Studio"].map((type) => (
                          <label key={type} className="flex items-center gap-1 text-[10px] cursor-pointer">
                            <input
                              type="radio"
                              name="riPropertyType"
                              checked={riBedType === type}
                              onChange={() => setRiBedType(type)}
                              className="accent-blue-500 cursor-pointer"
                            />
                            {type}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-slate-400">Current Base Rent Dues (PKR)</Label>
                      <Input
                        type="number"
                        value={riBaseRent}
                        onChange={(e) => setRiBaseRent(e.target.value)}
                        placeholder="Base Rent..."
                        className="bg-slate-900 border-slate-800 text-xs font-mono mt-1 text-slate-300 font-bold"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400">Fixed Maintenance Dues (PKR)</Label>
                      <Input
                        type="number"
                        value={riMaintenance}
                        onChange={(e) => setRiMaintenance(e.target.value)}
                        placeholder="Maintenance..."
                        className="bg-slate-900 border-slate-800 text-xs font-mono mt-1 text-slate-300 font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <div>
                      <Label className="text-slate-400">Extra Parking Spots (1st is Free)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={riParkSpots}
                        onChange={(e) => setRiParkSpots(e.target.value)}
                        placeholder="0"
                        className="bg-slate-900 border-slate-800 text-xs font-mono mt-1 text-slate-300 font-bold"
                      />
                    </div>
                    <div className="flex flex-col justify-end">
                      <Label className="text-slate-500 text-[10px]">Parking Fee (PKR)</Label>
                      <Input
                        type="number"
                        value={riParkingFee}
                        onChange={(e) => setRiParkingFee(e.target.value)}
                        className="bg-slate-900 border-slate-800 text-xs font-mono mt-1 text-amber-500 font-bold h-8"
                      />
                    </div>
                  </div>

                  <div className="border border-slate-800 p-3 rounded-lg bg-slate-900/30 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-amber-500 border-b border-slate-850 pb-1.5">Interactive Utility Calculations</h4>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-slate-400 block text-[10px] uppercase font-bold text-yellow-500">⚡ Electricity Reading Calculator</Label>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <Label className="text-[10px] text-slate-500">Previous</Label>
                          <Input
                            type="number"
                            value={riElecPrev}
                            onChange={(e) => setRiElecPrev(e.target.value)}
                            className="bg-slate-900 border-slate-800 h-8 text-xs font-mono mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-slate-500">Current</Label>
                          <Input
                            type="number"
                            value={riElecCurr}
                            onChange={(e) => setRiElecCurr(e.target.value)}
                            className="bg-slate-900 border-slate-800 h-8 text-xs font-mono mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-slate-500">Rate / Unit</Label>
                          <Input
                            type="number"
                            value={riElecRate}
                            onChange={(e) => setRiElecRate(e.target.value)}
                            className="bg-slate-900 border-slate-800 h-8 text-xs font-mono mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-slate-500">Multiplier</Label>
                          <Input
                            type="number"
                            value={riElecMultiplier}
                            onChange={(e) => setRiElecMultiplier(e.target.value)}
                            className="bg-slate-900 border-slate-800 h-8 text-xs font-mono mt-1"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono bg-black/20 p-2 rounded">
                        <span>Units Consumed: <strong className="text-yellow-400">{elecUnits}</strong></span>
                        <span>Electricity Dues: <strong className="text-yellow-400">PKR {elecTotal.toLocaleString()}</strong></span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-slate-400 block text-[10px] uppercase font-bold text-orange-400">🔥 Gas Bill Input</Label>
                      <div className="grid grid-cols-1">
                        <Input
                          type="number"
                          value={riGasBill}
                          onChange={(e) => setRiGasBill(e.target.value)}
                          placeholder="Enter Gas Flat / Meter Bill..."
                          className="bg-slate-900 border-slate-800 h-8 text-xs font-mono text-orange-400 mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-800 p-3 rounded-lg bg-slate-900/30">
                    <Label className="text-slate-400 block mb-2 font-bold text-blue-400 text-[10px] uppercase tracking-wider">🛡️ Security Deposit Grid</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-[10px] text-slate-500">Total Security to be Paid</Label>
                        <Input
                          type="number"
                          value={riSecTotal}
                          onChange={(e) => setRiSecTotal(e.target.value)}
                          className="bg-slate-900 border-slate-800 h-8 text-xs font-mono mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-slate-500">Security Received</Label>
                        <Input
                          type="number"
                          value={riSecReceived}
                          onChange={(e) => setRiSecReceived(e.target.value)}
                          className="bg-slate-900 border-slate-800 h-8 text-xs font-mono mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-slate-500">Pending Balance</Label>
                        <Input
                          value={`PKR ${securityPending.toLocaleString()}`}
                          className="bg-slate-950/60 border-slate-800 h-8 text-xs font-mono text-rose-400 font-bold mt-1"
                          readOnly
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-gradient-to-r from-amber-600/10 to-orange-600/10 p-4 rounded-xl border border-amber-500/20">
                    <span className="text-slate-200 font-black text-sm uppercase tracking-wide">Total Receivable Amount:</span>
                    <span className="text-amber-400 font-black text-lg font-mono">PKR {totalReceivable.toLocaleString()}</span>
                  </div>

                  <div className="bg-slate-950 p-3 border border-slate-900 rounded-lg text-center">
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1.5">Signature Block Preview (Included on Print/PDF)</p>
                    <div className="grid grid-cols-4 gap-2 text-[9px] text-slate-400">
                      <div className="border border-slate-900 p-1.5 rounded">1. Prepared By (Accounts)</div>
                      <div className="border border-slate-900 p-1.5 rounded">2. Checked By (Office)</div>
                      <div className="border border-slate-900 p-1.5 rounded">3. Approved By (Mgr)</div>
                      <div className="border border-slate-900 p-1.5 rounded">4. Customer Details</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "REFUND" && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-400">Refund No.</Label>
                      <Input
                        value={refundNo}
                        onChange={(e) => setRefundNo(e.target.value)}
                        className="bg-slate-900 border-slate-800 text-xs font-mono font-bold text-red-500 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400">Refund Date</Label>
                      <Input
                        type="date"
                        value={refundDate}
                        onChange={(e) => setRefundDate(e.target.value)}
                        className="bg-slate-900 border-slate-800 text-xs mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-400">Original Type</Label>
                      <select
                        value={refundOriginalType}
                        onChange={(e) => setRefundOriginalType(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg h-9 px-3 text-xs mt-1 text-slate-200 outline-none focus:border-red-500"
                      >
                        <option value="RV">Receipt Voucher (RV)</option>
                        <option value="PV">Payment Voucher (PV)</option>
                        <option value="RI">Rental Invoice (RI)</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-slate-400">Original Voucher No.</Label>
                      <Input
                        value={refundOriginalVoucherNo}
                        onChange={(e) => setRefundOriginalVoucherNo(e.target.value)}
                        placeholder="e.g. RV-00101, RI-2719"
                        className="bg-slate-900 border-slate-800 text-xs mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-400">Refund Amount (PKR)</Label>
                      <Input
                        type="number"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        placeholder="Enter refund amount..."
                        className="bg-slate-900 border-slate-800 text-xs font-mono text-red-400 font-bold mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-400 block mb-1">Refund Method</Label>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        {["Cash", "Cheque", "Transfer"].map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setRefundPaymentMethod(mode)}
                            className={`py-2 rounded-lg font-bold text-center border transition text-[10px] cursor-pointer ${
                              refundPaymentMethod === mode
                                ? "bg-red-500/20 text-red-500 border-red-500/60 shadow-[0_0_10px_rgba(239,68,68,0.2)] font-extrabold"
                                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-400">Reason for Refund / Reversal</Label>
                    <Textarea
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Type reason here..."
                      rows={2}
                      className="bg-slate-900 border-slate-800 text-xs mt-1 resize-none"
                    />
                  </div>

                  <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg text-center text-[10px] text-red-500 font-semibold tracking-wider uppercase">
                    🚨 Warning: Processing this refund will automatically post reversing entries to general ledger.
                  </div>
                </div>
              )}

              {/* Sticky Command Action Bar */}
              <div className="sticky bottom-0 bg-slate-950 pt-4 pb-1 border-t border-slate-900 grid grid-cols-6 gap-2">
                <Button
                  type="button"
                  onClick={handlePostDatabase}
                  disabled={saving}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black h-11 border border-blue-500 uppercase tracking-widest text-[10px] cursor-pointer shadow-lg"
                >
                  <Landmark className="h-4 w-4 mr-1 text-white" />
                  {saving ? "Saving..." : "Save to Ledger"}
                </Button>
                <Button
                  onClick={() => handlePrintOrSave("print", "a5")}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 border border-slate-800 uppercase tracking-wider text-[10px] cursor-pointer"
                >
                  <Printer className="h-4 w-4 mr-1 text-green-500" />
                  Print A5
                </Button>
                <Button
                  onClick={() => handlePrintOrSave("print", "a4double")}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 border border-slate-800 uppercase tracking-wider text-[10px] cursor-pointer"
                >
                  <Printer className="h-4 w-4 mr-1 text-yellow-500" />
                  Print A4 (×2)
                </Button>
                <Button
                  onClick={() => handlePrintOrSave("pdf", "a5")}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 border border-slate-800 uppercase tracking-wider text-[10px] cursor-pointer"
                >
                  <Download className="h-4 w-4 mr-1 text-blue-500" />
                  Download PDF
                </Button>
                <Button
                  type="button"
                  onClick={handleWhatsAppShare}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 border border-emerald-500 uppercase tracking-wider text-[10px] cursor-pointer flex items-center justify-center gap-1"
                >
                  <MessageSquare className="h-4 w-4 text-white mr-1" />
                  WhatsApp
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 border border-slate-800 uppercase tracking-wider text-[10px] cursor-pointer"
                >
                  Cancel / Close
                </Button>
              </div>

            </div>

            {/* Right-side Account Summary Sidebar */}
            <div className="lg:col-span-1 bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 space-y-4 max-h-[80vh] overflow-y-auto">
              <Label className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{isUrdu ? "کھاتہ خلاصہ" : "Account Summary"}</Label>
              {selectedRes ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-blue-900/30 text-blue-400 flex items-center justify-center font-bold uppercase"><User className="h-4 w-4" /></div>
                    <div className="truncate max-w-[150px]">
                      <h4 className="font-bold text-slate-200 truncate">{selectedRes.full_name || "Resident"}</h4>
                      <p className="text-[9px] text-slate-500 font-mono">ID: {selectedRes.client_id || "N/A"}</p>
                    </div>
                  </div>
                  <div className="space-y-2 bg-black/25 p-3 rounded-lg text-[10px] border border-slate-900">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Lease Rent:</span>
                      <span className="font-bold font-mono text-slate-200">PKR {Number(selectedRes.rent_amount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fixed Maint:</span>
                      <span className="font-bold font-mono text-slate-200">PKR {Number(selectedRes.fixed_maintenance || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-slate-800/40 mt-1.5 text-xs">
                      <span className="text-slate-400 font-bold">{isUrdu ? "کل بقایا" : "Total Arrears"}:</span>
                      <span className={`font-black font-mono ${Number(selectedRes.outstanding_balance || 0) > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                        PKR {Number(selectedRes.outstanding_balance || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-[9px] text-slate-400 leading-relaxed bg-slate-955 p-2.5 rounded border border-slate-900">
                    <p className="font-bold text-amber-500 uppercase tracking-widest text-[8px] mb-1">💡 System Notes</p>
                    <p>• Ledger posts instantly affect resident balance sheets.</p>
                    <p>• Receipts update client credits, reducing overall arrears.</p>
                    <p>• Rental invoices generate debits for rent, maintenance and utilities.</p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">{isUrdu ? "فلیٹ منتخب کریں" : "No resident profile selected."}</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
