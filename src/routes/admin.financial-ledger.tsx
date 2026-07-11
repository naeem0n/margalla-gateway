// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router';
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { StatCard } from "@/components/admin/StatCard";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Plus, Printer, Download, Upload, Search, Mail, MessageSquare, FileSpreadsheet, 
  Wallet, TrendingUp, TrendingDown, RefreshCw, FileText, ClipboardList, AlertCircle, Image as ImageIcon, Trash2,
  Zap, Check, X, ReceiptText, Pencil
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { isAfter } from "date-fns";
import { downloadInvoicePDF, downloadRentalBillPDF } from '@/lib/pdf';
import { calculateMargallaInvoice, processMargallaBilling } from '@/lib/print-invoice';
import { printLedgerStatement } from '@/lib/print-ledger';
import { toast } from 'sonner';
import { apiFetch, getApiBase } from '@/lib/api-client';
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { 
  downloadResidentStatementPDF,
  downloadTrialBalancePDF, 
  downloadProfitLossPDF, 
  downloadBalanceSheetPDF,
  downloadRentCollectionPDF,
  downloadArrearsRecoveryPDF,
  printHTMLReport
} from '@/lib/pdf';
import { format, startOfMonth, endOfMonth, startOfYear } from "date-fns";
import { QuickTransactionModal } from '@/components/admin/QuickTransactionModal';

export const Route = createFileRoute('/admin/financial-ledger')({
  head: () => ({
    meta: [
      { title: "Finance & Accounts Hub — Margalla Gateway" },
      { name: "description", content: "Unified accounting, billing, reports, cashbook and resident statement hub." },
    ]
  }),
  component: UnifiedFinanceHubPage,
});

interface LedgerRow {
  sno: number;
  unit: string;
  type1: string;
  name: string;
  type2: string;
  remarks: string;
  rentedOn: string;
  rent: number;
  security: number;
  commission: number;
  electricity: number;
  gas: number;
  pending: number;
  total: number;
  received: number;
  mode: string;
  rvNo: string;
  rvDate: string;
  balance: number;
  refund: number;
  adjustment: number;
  client_id?: string;
  tenant_id?: string;
  id?: string;
  invoice_no?: string;
}

type Entry = {
  id: string;
  entry_date: string;
  description: string;
  category: string | null;
  type: "credit" | "debit";
  amount: number;
  receipt_url: string | null;
  balance_after: number;
  resident_id?: string | null;
};

type CoaRow = { code: string; name: string; account_type: string; normal_balance: string; is_active: boolean };
type JournalRow = { id: string; entry_date: string; description: string; reference: string | null };
type TbRow = { code: string; name: string; account_type: string; normal_balance: string; total_debit: number; total_credit: number; balance: number };
type PlRow = { code: string; name: string; account_type: string; amount: number };

const ACCOUNT_CATEGORIES = [
  { group: "Assets", options: [
    { code: "1000", label: "Cash on Hand" },
    { code: "1100", label: "Bank Account" },
    { code: "1200", label: "Tenant Rent Receivable" },
    { code: "1300", label: "Staff Advances" }
  ]},
  { group: "Liabilities", options: [
    { code: "2000", label: "Accounts Payable" },
    { code: "2100", label: "Security Deposits Held" }
  ]},
  { group: "Equity", options: [
    { code: "3000", label: "Owner Equity" }
  ]},
  { group: "Income", options: [
    { code: "4000", label: "Rent Income" },
    { code: "4100", label: "Maintenance Income" },
    { code: "4200", label: "Daily Rental Income" },
    { code: "4300", label: "Utility Recovery" },
    { code: "4900", label: "Other Income" }
  ]},
  { group: "Expense", options: [
    { code: "5000", label: "Salary Expense" },
    { code: "5100", label: "Maintenance Expense" },
    { code: "5200", label: "Utilities Expense" },
    { code: "5300", label: "Cleaning & Supplies" },
    { code: "5400", label: "Repairs Expense" },
    { code: "5500", label: "Office & Admin" },
    { code: "5900", label: "Other Expense" }
  ]}
];

function UnifiedFinanceHubPage() {
  return (
    <AdminLayout title="Finance & Accounts Hub">
      <UnifiedFinanceHub />
    </AdminLayout>
  );
}

function UnifiedFinanceHub() {
  const { lang } = useLanguage();
  const isUrdu = lang === "ur";

  // =====================================================
  // UNIVERSAL CENTRAL ENTRY CONSOLE (VOUCHER MODES) STATES
  // =====================================================
  const [voucherMode, setVoucherMode] = useState<"RV" | "PV" | "RI">("RV");
  const [consoleOpen, setConsoleOpen] = useState(true);

  // RV fields
  const [rvNo, setRvNo] = useState("32350");
  const [rvDate, setRvDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [rvFrom, setRvFrom] = useState("");
  const [rvAccountNo, setRvAccountNo] = useState("");
  const [rvAmount, setRvAmount] = useState("");
  const [rvPayMode, setRvPayMode] = useState("Cash");
  const [rvPurpose, setRvPurpose] = useState("Maintenance");
  const [rvRemarks, setRvRemarks] = useState("");

  // PV fields
  const [pvNo, setPvNo] = useState("11535");
  const [pvDate, setPvDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [pvPaidTo, setPvPaidTo] = useState("");
  const [pvAmount, setPvAmount] = useState("0");
  const [pvPayMethod, setPvPayMethod] = useState("By Cash");
  const [pvRows, setPvRows] = useState<any[]>([
    { no: "1", date: format(new Date(), "yyyy-MM-dd"), noticeAmount: "0", adjustment: "0", netAmount: "0", remarks: "" }
  ]);

  // Rental Invoice (RI) fields
  const [riNo, setRiNo] = useState("02831");
  const [riDate, setRiDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [riTenantName, setRiTenantName] = useState("");
  const [riContact, setRiContact] = useState("0300-9382022");
  const [riCnic, setRiCnic] = useState("");
  const [riFlatNo, setRiFlatNo] = useState("801");
  const [riDurationFrom, setRiDurationFrom] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [riDurationTo, setRiDurationTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
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
  // Rent / Maintenance
  const [riBaseRent, setRiBaseRent] = useState("0");
  const [riMaintenance, setRiMaintenance] = useState("0");
  const [riParkSpots, setRiParkSpots] = useState("0");
  const [riParkingFee, setRiParkingFee] = useState("0");
  // Security
  const [riSecTotal, setRiSecTotal] = useState("0");
  const [riSecReceived, setRiSecReceived] = useState("0");

  // Universal Ledger Tab search states
  const [ledgerSubTab, setLedgerSubTab] = useState<"tenant" | "apartment" | "staff" | "inventory" | "general" | "rv" | "pv" | "ri" | "rf">("tenant");
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState("");
  
  // ERP True Accounting States
  const [ledgerTenantView, setLedgerTenantView] = useState<"1200" | "2100" | "combined">("1200");
  const [ledgerVoucherFilter, setLedgerVoucherFilter] = useState<string>("All");
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<string>("All");
  const [ledgerDateFrom, setLedgerDateFrom] = useState<string>("");
  const [ledgerDateTo, setLedgerDateTo] = useState<string>("");
  const [ledgerOpeningBalances, setLedgerOpeningBalances] = useState<Record<string, number>>({});
  
  // JV Modal State
  const [jvModalOpen, setJvModalOpen] = useState(false);
  const [jvModalId, setJvModalId] = useState<string>("");
  const [jvModalData, setJvModalData] = useState<any>(null);
  const [jvModalLoading, setJvModalLoading] = useState(false);

  useEffect(() => {
    if (jvModalOpen && jvModalId) {
      setJvModalLoading(true);
      apiFetch<any>('/rpc-bridge', {
        method: 'POST',
        body: JSON.stringify({ name: 'erp_get_journal_entry', data: { journal_id: jvModalId } })
      }).then(res => {
        setJvModalData(res.data);
      }).catch(e => {
        console.error("Failed to load journal entry:", e);
      }).finally(() => setJvModalLoading(false));
    } else {
      setJvModalData(null);
    }
  }, [jvModalOpen, jvModalId]);

  // === MOVED STATE DECLARATIONS TO PREVENT TEMPORAL DEAD ZONE CRASHES ===
  // ----------------------------------------------------
  // GENERAL TAB AND COMMON DATA STATES
  // ----------------------------------------------------
  const [activeTab, setActiveTab] = useState<string>("ledgers");
  const [residents, setResidents] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [allLedgerEntries, setAllLedgerEntries] = useState<any[]>([]);

  // ----------------------------------------------------
  // TAB 1: RESIDENT STATEMENT STATES
  // ----------------------------------------------------
  const [selectedResidentId, setSelectedResidentId] = useState<string>('');
  const [statementData, setStatementData] = useState<any>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const printStatementRef = useRef<HTMLDivElement>(null);

  // WhatsApp payload confirmation modal
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappPayload, setWhatsappPayload] = useState<{ phone: string; message: string }>({ phone: '', message: '' });

  // ----------------------------------------------------
  // TAB 2: INVOICES REGISTRY STATES
  // ----------------------------------------------------
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchUnit, setSearchUnit] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [searchFloor, setSearchFloor] = useState<string>('All');
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);
  
  const [editInvoiceOpen, setEditInvoiceOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<{
    id: string;
    name: string;
    unit: string;
    flat_rent: number;
    maintenance_charges: number;
    electricity_amount: number;
    gas_charges: number;
    previous_arrears: number;
    amount_received: number;
  } | null>(null);
  const [savingInvoice, setSavingInvoice] = useState(false);

  // ----------------------------------------------------
  // TAB 3: DAILY CASH BOOK STATES
  // ----------------------------------------------------
  const [cashbookRows, setCashbookRows] = useState<Entry[]>([]);
  const [loadingCashbook, setLoadingCashbook] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cashbookDialogOpen, setCashbookDialogOpen] = useState(false);
  const [savingCashbookEntry, setSavingCashbookEntry] = useState(false);
  const [cashbookForm, setCashbookForm] = useState({
    entry_date: selectedDate,
    description: "",
    category: "4900",
    type: "credit" as "debit" | "credit", 
    amount: "",
    resident_id: "",
    payment_channel: "Cash"
  });

  // ----------------------------------------------------
  // TAB 4: BOOKKEEPING REPORTS STATES
  // ----------------------------------------------------
  const todayDate = format(new Date(), "yyyy-MM-dd");
  const [repFrom, setRepFrom] = useState(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [repTo, setRepTo] = useState(todayDate);
  const [repAsOf, setRepAsOf] = useState(todayDate);
  const [coa, setCoa] = useState<CoaRow[]>([]);
  const [journal, setJournal] = useState<JournalRow[]>([]);
  const [tb, setTb] = useState<TbRow[]>([]);
  const [pl, setPl] = useState<PlRow[]>([]);
  const [bs, setBs] = useState<PlRow[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // ----------------------------------------------------
  // TAB 5: EXECUTIVE ANALYTICS STATES
  // ----------------------------------------------------
  const [analyticsType, setAnalyticsType] = useState<"collection" | "arrears">("collection");
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // ----------------------------------------------------
  // TAB 6: MONTHLY BILLING STATES (from Bulk Utility)
  // ----------------------------------------------------
  const [billingElecRate, setBillingElecRate] = useState(100);

  // =====================================================
  // UTILITY RECOVERY SYSTEM STATES
  // =====================================================
  const currentMonthStr = format(new Date(), 'yyyy-MM');
  const [utilBillingMonth, setUtilBillingMonth] = useState<string>(currentMonthStr);
  const [utilActiveStep, setUtilActiveStep] = useState<number>(1); // 1=Setup, 2=Electricity, 3=Gas

  // Step 1 — Per-apartment charges
  const [utilAptRows, setUtilAptRows] = useState<any[]>([]);
  const [utilAptLoading, setUtilAptLoading] = useState(false);
  const [utilSavingSetup, setUtilSavingSetup] = useState(false);

  // Step 2 — Electricity recovery
  const [utilElecGovtBill, setUtilElecGovtBill] = useState<number>(0);
  const [utilElecGovtUnits, setUtilElecGovtUnits] = useState<number>(0);
  const [utilElecReadings, setUtilElecReadings] = useState<any[]>([]);
  const [utilElecSaving, setUtilElecSaving] = useState(false);
  const [utilElecCollection, setUtilElecCollection] = useState<any>(null);

  // Step 3 — Gas recovery
  const [utilGasMethod, setUtilGasMethod] = useState<'fixed' | 'meter'>('fixed');
  const [utilGasFixedAmt, setUtilGasFixedAmt] = useState<number>(0);
  const [utilGasGovtBill, setUtilGasGovtBill] = useState<number>(0);
  const [utilGasGovtUnits, setUtilGasGovtUnits] = useState<number>(0);
  const [utilGasReadings, setUtilGasReadings] = useState<any[]>([]);
  const [utilGasSaving, setUtilGasSaving] = useState(false);
  const [utilGasCollection, setUtilGasCollection] = useState<any>(null);

  // History & summary
  const [utilHistory, setUtilHistory] = useState<any[]>([]);
  const [utilCollections, setUtilCollections] = useState<any[]>([]);
  const [utilHistoryLoading, setUtilHistoryLoading] = useState(false);

  // Finalize
  const [utilFinalizing, setUtilFinalizing] = useState(false);
  const [billingGasRate, setBillingGasRate] = useState(120);
  const [billingMaintPool, setBillingMaintPool] = useState(3500);
  const [billingApts, setBillingApts] = useState<any[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingPosting, setBillingPosting] = useState(false);
  const [billingMsg, setBillingMsg] = useState('');
  const [billingSetupOpen, setBillingSetupOpen] = useState(false);

  // Lock / Closing
  const [utilMonthLocked, setUtilMonthLocked] = useState(false);
  const [utilLockInfo, setUtilLockInfo] = useState<any>(null);
  const [utilLocking, setUtilLocking] = useState(false);

  // Recovery Status
  const [utilRecoveryStatus, setUtilRecoveryStatus] = useState<any>(null);

  // Utility Ledger
  const [utilLedger, setUtilLedger] = useState<any>(null);

  // Audit Trail
  const [utilAuditLog, setUtilAuditLog] = useState<any[]>([]);
  const [utilAdjVouchers, setUtilAdjVouchers] = useState<any[]>([]);

  // Adjustment Voucher Modal
  const [adjModalOpen, setAdjModalOpen] = useState(false);
  const [adjUtilType, setAdjUtilType] = useState('electricity');
  const [adjChargeType, setAdjChargeType] = useState('electricity');
  const [adjAptNo, setAdjAptNo] = useState('');
  const [adjOrigAmt, setAdjOrigAmt] = useState(0);
  const [adjAmt, setAdjAmt] = useState(0);
  const [adjReason, setAdjReason] = useState('');
  const [adjSaving, setAdjSaving] = useState(false);
  const [adjDate, setAdjDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [adjFile, setAdjFile] = useState<File | null>(null);

  // Step 5 sub-tab
  const [histSubTab, setHistSubTab] = useState<'history' | 'ledger' | 'audit'>('history');



  // ----------------------------------------------------
  // TAB 7: PAYMENTS & REQUESTS STATES (from Payment Requests)
  // ----------------------------------------------------
  const [payRows, setPayRows] = useState<any[]>([]);
  const [payResidents, setPayResidents] = useState<any[]>([]);
  const [payLoading, setPayLoading] = useState(false);
  const [payFilter, setPayFilter] = useState('all');
  const [quickTxOpen, setQuickTxOpen] = useState(false);
  const [quickTxTab, setQuickTxTab] = useState<"payment" | "request">("payment");
  const [quickTxReqType, setQuickTxReqType] = useState<string>("Rent");
  const [quickTxAction, setQuickTxAction] = useState<"Collect" | "Return">("Collect");
  const [quickTxNote, setQuickTxNote] = useState<string>("");
  const [quickTxType, setQuickTxType] = useState<string>("Rent Received");

  const openQuickTx = (
    tab: "payment" | "request",
    reqType: string = "Rent",
    action: "Collect" | "Return" = "Collect",
    note: string = "",
    txType: string = "Rent Received"
  ) => {
    setQuickTxTab(tab);
    setQuickTxReqType(reqType);
    setQuickTxAction(action);
    setQuickTxNote(note);
    setQuickTxType(txType);
    setQuickTxOpen(true);
  };
  // ========================================================================


  // Clear filters/states when ledger tab changes to prevent mismatched index tracking
  useEffect(() => {
    setLedgerSearchQuery("");
    setSelectedResidentId("");
  }, [ledgerSubTab]);

  // ----------------------------------------------------
  // STRICT CALCULATIONS & METER READING HANDLERS
  // ----------------------------------------------------
  // PV net amount recalculation effect
  useEffect(() => {
    const updated = pvRows.map(r => {
      const net = (Number(r.noticeAmount) || 0) - (Number(r.adjustment) || 0);
      return { ...r, netAmount: String(net) };
    });
    const sum = updated.reduce((s, r) => s + (Number(r.netAmount) || 0), 0);
    if (String(sum) !== pvAmount) {
      setPvAmount(String(sum));
    }
  }, [pvRows, pvAmount]);

  const addPvRow = () => {
    setPvRows(prev => [
      ...prev,
      { no: String(prev.length + 1), date: format(new Date(), "yyyy-MM-dd"), noticeAmount: "0", adjustment: "0", netAmount: "0", remarks: "" }
    ]);
  };

  const removePvRow = (index: number) => {
    if (pvRows.length === 1) return;
    setPvRows(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((r, i) => ({ ...r, no: String(i + 1) }));
    });
  };

  const updatePvRow = (index: number, field: string, val: string) => {
    setPvRows(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      if (field === "noticeAmount" || field === "adjustment") {
        const notice = Number(field === "noticeAmount" ? val : copy[index].noticeAmount) || 0;
        const adj = Number(field === "adjustment" ? val : copy[index].adjustment) || 0;
        copy[index].netAmount = String(notice - adj);
      }
      return copy;
    });
  };

  // Sync resident selection to Rental Invoice fields
  useEffect(() => {
    if (selectedResidentId) {
      const res = (residents || []).find(r => r.id === selectedResidentId);
      if (res) {
        setRvFrom(res.full_name || "");
        setRvAccountNo(res.apartment_no || res.client_id || "");
        setPvPaidTo(res.full_name || "");
        setRiTenantName(res.full_name || "");
        setRiFlatNo(res.apartment_no || "");
        setRiContact(res.phone || "0300-9382022");
        setRiElecPrev(String(res.elec_curr || res.elec_prev || 0));
        setRiBaseRent(String(res.rent_amount || 0));
        setRiMaintenance(String(res.fixed_maintenance || 0));
        setRiParkSpots(String(res.extra_parking_spots ?? 0));
      }
    }
  }, [selectedResidentId, residents]);

  // Rental Invoice strict calculations
  const riElecUnits = Math.max(0, (Number(riElecCurr) || 0) - (Number(riElecPrev) || 0));
  const riElecTotal = riElecUnits * (Number(riElecRate) || 0) * (Number(riElecMultiplier) || 1);
  const riTotalReceivable = (Number(riBaseRent) || 0) + (Number(riMaintenance) || 0) + riElecTotal + (Number(riGasBill) || 0) + (Number(riParkingFee) || 0);
  const riSecurityPending = Math.max(0, (Number(riSecTotal) || 0) - (Number(riSecReceived) || 0));

  const handlePostManualConsole = async () => {
    const activeRes = selectedResidentId 
      ? (residents || []).find(r => r.id === selectedResidentId)
      : (residents || []).find(r => r.apartment_no === (voucherMode === "RI" ? riFlatNo : rvAccountNo));

    if (voucherMode === "RI" && !activeRes) {
      toast.error("Please select a resident profile or apartment to post ledger history!");
      return;
    }

    try {
      if (voucherMode === "RV") {
        const amt = Number(rvAmount) || 0;
        if (amt <= 0) throw new Error("Amount must be greater than zero");
        const targetUserId = activeRes ? activeRes.id : "system";

        // Post Receipt Voucher via Universal Accounting API
        await apiFetch("/accounting/rv", {
          method: "POST",
          body: JSON.stringify({
            voucher_no: rvNo,
            date: rvDate,
            tenant_id: targetUserId,
            apartment_no: rvAccountNo,
            amount: amt,
            payment_method: rvPayMode,
            reference_no: rvRemarks
          })
        });
        toast.success("Receipt Voucher posted successfully!");
      } 
      
      else if (voucherMode === "PV") {
        const amt = Number(pvAmount) || 0;
        if (amt <= 0) throw new Error("Voucher amount must be greater than zero");
        const targetUserId = activeRes ? activeRes.id : "system";

        // Post Payment Voucher via Universal Accounting API
        const desc = `[PV-${pvNo}] Paid to ${pvPaidTo}. Method: ${pvPayMethod}. Breakdown: ${pvRows.map(r => `Notice: ${r.noticeAmount}, Adj: ${r.adjustment}, Net: ${r.netAmount}${r.remarks ? ` (${r.remarks})` : ""}`).join(' | ')}`;
        await apiFetch("/accounting/pv", {
          method: "POST",
          body: JSON.stringify({
            voucher_no: pvNo,
            date: pvDate,
            tenant_id: targetUserId,
            apartment_no: "N/A",
            amount: amt,
            payment_method: pvPayMethod,
            reference_no: desc
          })
        });
        toast.success("Payment Voucher posted successfully!");
      } 
      
      else if (voucherMode === "RI") {
        if (riElecUnits < 0 || (Number(riElecCurr) < Number(riElecPrev))) {
          throw new Error("Validation Error: Current Reading cannot be less than Previous Reading.");
        }
        if (riTotalReceivable <= 0) throw new Error("Total Receivable must be greater than zero");

        // 1. Post Rental Invoice via Universal Accounting API
        await apiFetch("/accounting/ri", {
          method: "POST",
          body: JSON.stringify({
            invoice_no: riNo,
            date: riDate,
            tenant_id: activeRes.id,
            apartment_no: riFlatNo,
            rent: Number(riBaseRent) || 0,
            maintenance: Number(riMaintenance) || 0,
            electricity: riElecTotal,
            gas: Number(riGasBill) || 0,
            water: 0,
            parking: riParkingFee,
            other_charges: 0,
            previous_arrears: Number(activeRes.outstanding_balance || 0)
          })
        });
        
        // 2. Update resident default parameters on users table
        await apiFetch("/query-bridge", {
          method: "POST",
          body: JSON.stringify({
            table: "users",
            action: "update",
            filters: [{ column: "id", value: activeRes.id }],
            data: {
              full_name: riTenantName,
              phone: riContact,
              rent_amount: Number(riBaseRent) || 0,
              maintenance_charges: Number(riMaintenance) || 0,
              elec_prev: Number(riElecCurr) || 0,
              elec_curr: Number(riElecCurr) || 0
            }
          })
        });

        // 3. Update meter readings in profiles
        if (riElecUnits > 0) {
          await apiFetch("/utility/meter-readings", {
            method: "POST",
            body: JSON.stringify({
              billing_month: riDate.substring(0, 7),
              utility_type: "electricity",
              readings: [{
                apartment_no: riFlatNo,
                user_id: activeRes.id,
                prev_reading: Number(riElecPrev) || 0,
                curr_reading: Number(riElecCurr) || 0,
                units_consumed: riElecUnits,
                cost_per_unit: Number(riElecRate) || 0,
                calculated_amount: riElecTotal
              }]
            })
          });
        }
        toast.success("Rental Invoice posted successfully!");
      }

      await fetchAllData();
    } catch (e: any) {
      toast.error(e.message || "Failed to post manual voucher");
    }
  };

  // ----------------------------------------------------
  // LEDGER RUNNING BALANCE ENGINE & DUAL-MODE EXPORTS
  // ----------------------------------------------------
  const isSingleSelection = useMemo(() => {
    if (selectedResidentId) return true;
    if (ledgerSearchQuery.trim() !== "") {
      const q = ledgerSearchQuery.toLowerCase();
      const matches = (residents || []).filter(r => 
        (r?.full_name || '').toLowerCase().includes(q) || 
        (r.apartment_no || "").toLowerCase().includes(q)
      );
      if (matches.length === 1) return true;
    }
    return false;
  }, [selectedResidentId, ledgerSearchQuery, residents]);

  const singleResident = useMemo(() => {
    if (selectedResidentId) {
      return (residents || []).find(r => r.id === selectedResidentId) || null;
    }
    if (ledgerSearchQuery.trim() !== "") {
      const q = ledgerSearchQuery.toLowerCase();
      const matches = (residents || []).filter(r => 
        (r?.full_name || '').toLowerCase().includes(q) || 
        (r.apartment_no || "").toLowerCase().includes(q)
      );
      if (matches.length === 1) return matches[0];
    }
    return null;
  }, [selectedResidentId, ledgerSearchQuery, residents]);

  const filteredLedgerEntries = useMemo(() => {
    let list = [...(allLedgerEntries || [])];
    
    // 1. Inject synthetic Security Deposit opening entry for Tenant sub-tab
    if (ledgerSubTab === "tenant" && selectedResidentId) {
      const res = (residents || []).find(r => r.id === selectedResidentId);
      if (res && Number(res.security_deposit || 0) > 0) {
        const alreadyHasSecurity = list.some(e => 
          (e.account_code === "2100" || (e.description || "").toLowerCase().includes("security deposit"))
        );
        if (!alreadyHasSecurity) {
          list.unshift({
            id: `sec-opening-${res.id}`,
            entry_date: res.joining_date || "2026-07-01",
            posting_date: res.joining_date || "2026-07-01",
            account_code: "2100",
            account_name: "Security Deposits Held",
            reference_no: "SEC-OPENING",
            posting_status: "posted",
            tenant_id: res.id,
            user_id: res.id,
            description: `Security Deposit Held (Lease Opening)`,
            remarks: `Security Deposit Held (Lease Opening)`,
            debit: 0,
            credit: Number(res.security_deposit || 0)
          });
        }
      }
    }

    try {
      // Sort entries by date ascending so running balance computes chronologically
      list.sort((a, b) => new Date(a.entry_date || 0).getTime() - new Date(b.entry_date || 0).getTime());
    } catch (e) {
      console.error("Failed sorting ledger entries:", e);
    }
    
    // Filter by sub-tab category
    if (ledgerSubTab === "tenant") {
      if (selectedResidentId) {
        list = list.filter(e => e.tenant_id === selectedResidentId);
      }
    } else if (ledgerSubTab === "apartment") {
      const selectedRes = (residents || []).find(r => r.id === selectedResidentId);
      const targetApt = selectedRes ? selectedRes.apartment_no : null;
      if (targetApt) {
        list = list.filter(e => {
          const res = (residents || []).find(r => r.id === e.tenant_id);
          return res && res.apartment_no === targetApt;
        });
      } else {
        list = list.filter(e => {
          const res = (residents || []).find(r => r.id === e.tenant_id);
          return res && res.apartment_no;
        });
      }
      // ONLY SHOW RENT entries in Apartment Ledgers!
      list = list.filter(e => 
        (e.account_code === "4000") || 
        (e.account_name || "").toLowerCase().includes("rent") ||
        (e.remarks || "").toLowerCase().includes("rent") ||
        (e.description || "").toLowerCase().includes("rent")
      );
    } else if (ledgerSubTab === "staff") {
      if (selectedResidentId) {
        const selectedStaff = (staff || []).find((s: any) => s.id === selectedResidentId);
        list = list.filter(e => {
          if (e.tenant_id === selectedResidentId) return true;
          if (e.tenant_id === "system" && selectedStaff) {
            const desc = (e.description || "").toLowerCase();
            return desc.includes(selectedStaff.full_name.toLowerCase()) ||
              desc.includes("salary") || desc.includes("advance") || desc.includes("wages");
          }
          return false;
        });
      } else {
        list = list.filter(e => {
          const desc = (e.description || "").toLowerCase();
          return desc.includes("staff") || desc.includes("salary") || desc.includes("advance") || desc.includes("wages");
        });
      }
    } else if (ledgerSubTab === "inventory") {
      list = list.filter(e => {
        const desc = (e.description || "").toLowerCase();
        return desc.includes("inventory") || desc.includes("asset") || desc.includes("equipment") || desc.includes("stock") || desc.includes("purchase");
      });
    } else if (ledgerSubTab === "general" || ledgerSubTab === "rv" || ledgerSubTab === "pv" || ledgerSubTab === "ri" || ledgerSubTab === "rf") {
      if (selectedResidentId) {
        list = list.filter(e => e.tenant_id === selectedResidentId || e.user_id === selectedResidentId);
      }
    }

    // Filter by search query
    if (ledgerSearchQuery.trim() !== "") {
      const q = ledgerSearchQuery.toLowerCase();
      list = list.filter(e => {
        const res = (residents || []).find(r => r.id === e.tenant_id);
        const nameMatch = res ? (res?.full_name || '').toLowerCase().includes(q) : false;
        const aptMatch = res ? (res?.apartment_no || '').toLowerCase().includes(q) : false;
        const clientMatch = res ? (res?.client_id || '').toLowerCase().includes(q) : false;
        const descMatch = (e.description || "").toLowerCase().includes(q);
        return nameMatch || aptMatch || clientMatch || descMatch;
      });
    }

    // Combined Tenant Statement: sort purely chronologically & compute single unified running balance
    if (ledgerSubTab === "tenant" && ledgerTenantView === "combined") {
      list.sort((a, b) => new Date(a.entry_date || 0).getTime() - new Date(b.entry_date || 0).getTime());
      let unifiedRunning = 0;
      return list.map((entry) => {
        unifiedRunning += ((Number(entry.debit) || 0) - (Number(entry.credit) || 0));
        return {
          ...entry,
          running_balance: unifiedRunning
        };
      });
    }

    // Calculate true accounting running balance grouped by account code (for non-combined views)
    const accountRunningTotals: Record<string, number> = { ...ledgerOpeningBalances };
    return list.map((entry) => {
      const acct = entry.account_code || "UNKNOWN";
      if (accountRunningTotals[acct] === undefined) accountRunningTotals[acct] = 0;
      accountRunningTotals[acct] += ((Number(entry.debit) || 0) - (Number(entry.credit) || 0));
      return {
        ...entry,
        running_balance: accountRunningTotals[acct]
      };
    });
  }, [allLedgerEntries, ledgerSubTab, ledgerSearchQuery, residents, ledgerTenantView, ledgerOpeningBalances, selectedResidentId]);

  const handlePrintLedger = (actionType: "print" | "pdf") => {
    const list = filteredLedgerEntries;
    const title = 
      ledgerSubTab === "tenant" ? "Tenant Ledger" : 
      ledgerSubTab === "apartment" ? "Apartment Ledger" : 
      ledgerSubTab === "parking" ? "Parking Ledger" : 
      ledgerSubTab === "staff" ? "Staff Ledger" : 
      "Inventory Ledger";
    
    const modeLabel = isSingleSelection && singleResident
      ? `Single Selection Statement: ${singleResident.full_name} (${singleResident.apartment_no || "N/A"})`
      : `Total Summary Batch Statement (${title})`;

    const totalDebits = list.reduce((sum, e) => sum + (Number(e.debit) || 0), 0);
    const totalCredits = list.reduce((sum, e) => sum + (Number(e.credit) || 0), 0);
    const grossBalance = totalDebits - totalCredits;

    if (actionType === "pdf") {
      const doc = new jsPDF();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("MARGALLA GATEWAY LUXURY RESIDENCES", 14, 20);
      doc.setFontSize(12);
      doc.text(title.toUpperCase() + " - STATEMENT REPORT", 14, 28);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 34);
      doc.text(`Mode: ${modeLabel}`, 14, 40);
      
      const tableHeaders = [["Date", "Ref/Doc No", "Type", "Entity/Unit", "Description", "Debit (Dr)", "Credit (Cr)", "Running Balance"]];
      const tableRows = list.map(e => {
        let ent = "General / Other";
        if (ledgerSubTab === "staff") {
          const desc = (e.description || "").toLowerCase();
          const matched = (staff || []).find(s => desc.includes(s.full_name.toLowerCase()));
          ent = matched ? matched.full_name : "Staff Member";
        } else if (ledgerSubTab === "inventory") {
          ent = "Company Asset";
        } else {
          const res = (residents || []).find(r => r.id === e.tenant_id);
          if (res) {
            ent = `${res.full_name} ${res.apartment_no ? `(Apt ${res.apartment_no})` : ""}`;
          } else if (e.tenant_id === "system") {
            const desc = e.description || "";
            const matchRv = desc.match(/Received from\s+(.*?)(?:\s+-|\s+\.|\s+Method:|\s+on account of|$)/i);
            const matchPv = desc.match(/Paid to\s+(.*?)(?:\s+\.|\s+Method:|$)/i);
            if (matchRv) {
              ent = matchRv[1].trim();
            } else if (matchPv) {
              ent = matchPv[1].trim();
            } else {
              ent = "System Account";
            }
          }
        }
        return [
          e.entry_date || "—",
          e.id ? `REF-${String(e.id || "").substring(0, 6).toUpperCase()}` : "—",
          e.entry_type || "manual",
          ent,
          e.description || "—",
          e.debit > 0 ? `PKR ${Number(e.debit).toLocaleString()}` : "—",
          e.credit > 0 ? `PKR ${Number(e.credit).toLocaleString()}` : "—",
          `PKR ${Number(e.running_balance).toLocaleString()}`
        ];
      });

      if (!isSingleSelection) {
        tableRows.push([
          "GRAND TOTAL",
          "—",
          "—",
          "—",
          "Summary of All Filtered Records",
          `PKR ${totalDebits.toLocaleString()}`,
          `PKR ${totalCredits.toLocaleString()}`,
          `PKR ${grossBalance.toLocaleString()}`
        ]);
      }

      (doc as any).autoTable({
        head: tableHeaders,
        body: tableRows,
        startY: 46,
        theme: "striped",
        headStyles: { fillColor: [15, 35, 70] },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
        styles: { fontSize: 8, font: "helvetica" }
      });

      doc.save(`${title.replace(" ", "_")}_Statement.pdf`);
      toast.success("PDF Statement downloaded successfully!");
    } else {
      const rowsHtml = list.map(e => {
        let ent = "General / Other";
        if (ledgerSubTab === "staff") {
          const desc = (e.description || "").toLowerCase();
          const matched = (staff || []).find(s => desc.includes(s.full_name.toLowerCase()));
          ent = matched ? matched.full_name : "Staff Member";
        } else if (ledgerSubTab === "inventory") {
          ent = "Company Asset";
        } else {
          const res = (residents || []).find(r => r.id === e.tenant_id);
          if (res) {
            ent = `${res.full_name} ${res.apartment_no ? `(Apt ${res.apartment_no})` : ""}`;
          } else if (e.tenant_id === "system") {
            const desc = e.description || "";
            const matchRv = desc.match(/Received from\s+(.*?)(?:\s+-|\s+\.|\s+Method:|\s+on account of|$)/i);
            const matchPv = desc.match(/Paid to\s+(.*?)(?:\s+\.|\s+Method:|$)/i);
            if (matchRv) {
              ent = matchRv[1].trim();
            } else if (matchPv) {
              ent = matchPv[1].trim();
            } else {
              ent = "System Account";
            }
          }
        }
        return `<tr>
          <td style="padding: 6px 10px; text-align: left;">${e.id ? `REF-${String(e.id || "").substring(0, 6).toUpperCase()}` : "—"}</td>
          <td style="padding: 6px 10px; text-align: left;">${e.entry_date || "—"}</td>
          <td style="padding: 6px 10px; text-align: left;">${ent}</td>
          <td style="padding: 6px 10px; text-align: left;">${e.description || "—"}</td>
          <td style="padding: 6px 10px; text-align: left;">${e.entry_type || "manual"}</td>
          <td style="padding: 6px 10px; text-align: right;">${e.debit > 0 ? Number(e.debit).toLocaleString() : ''}</td>
          <td style="padding: 6px 10px; text-align: right;">${e.credit > 0 ? Number(e.credit).toLocaleString() : ''}</td>
          <td style="padding: 6px 10px; text-align: right; font-weight: bold;">${Number(e.running_balance) < 0 ? Math.abs(Number(e.running_balance)).toLocaleString() + " (Credit Balance)" : Number(e.running_balance).toLocaleString()}</td>
        </tr>`;
      }).join("");

      const footerHtml = !isSingleSelection ? `
        <tr style="font-weight: bold; border-top: 2px solid #000;">
          <td style="padding: 8px 10px; border-top: 2px solid #000;">GRAND TOTAL</td>
          <td style="padding: 8px 10px; border-top: 2px solid #000;">—</td>
          <td style="padding: 8px 10px; border-top: 2px solid #000;">—</td>
          <td style="padding: 8px 10px; border-top: 2px solid #000;">Summary of All Filtered Records</td>
          <td style="padding: 8px 10px; border-top: 2px solid #000;">—</td>
          <td style="padding: 8px 10px; text-align: right; border-top: 2px solid #000;">${totalDebits.toLocaleString()}</td>
          <td style="padding: 8px 10px; text-align: right; border-top: 2px solid #000;">${totalCredits.toLocaleString()}</td>
          <td style="padding: 8px 10px; text-align: right; border-top: 2px solid #000;">${grossBalance.toLocaleString()}</td>
        </tr>
      ` : "";

      const headerId = isSingleSelection && singleResident ? singleResident.client_id : (ledgerSubTab === "tenant" ? "ALL TENANTS" : ledgerSubTab === "apartment" ? "ALL APARTMENTS" : "ALL");
      const headerName = isSingleSelection && singleResident ? singleResident.full_name + (singleResident.apartment_no ? " / " + singleResident.apartment_no : "") : (ledgerSubTab === "tenant" ? "All Tenant Records" : "All Records");

      const htmlContent = `
        <html>
        <head>
          <title>${title} - Statement</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 11pt; padding: 20px; background: #fff; color: #000; }
            .page-number { text-align: right; font-weight: bold; font-size: 10pt; margin-bottom: 10px; margin-right: 10px; }
            .header-info { text-align: center; margin-bottom: 15px; font-weight: bold; font-size: 15pt; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 5px; }
            thead tr th:first-child { border-top-left-radius: 5px; border-bottom-left-radius: 5px; }
            thead tr th:last-child { border-top-right-radius: 5px; border-bottom-right-radius: 5px; border-right: 1px solid #000; }
            th { border: 1px solid #000; border-right: none; padding: 6px 10px; font-weight: bold; font-size: 10pt; text-transform: capitalize; }
            td { font-size: 10pt; border: none; }
            @media print {
              @page { size: A5 landscape; margin: 5mm; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="page-number">1 Out Of 1</div>
          <div class="header-info">ID: ${headerId} Name: ${headerName}</div>
          <table>
            <thead>
              <tr>
                <th style="text-align: left;">Voucher</th>
                <th style="text-align: left;">Date</th>
                <th style="text-align: left;">Entity / Unit</th>
                <th style="text-align: left;">Description</th>
                <th style="text-align: left;">Type</th>
                <th style="text-align: right;">Debit</th>
                <th style="text-align: right;">Credit</th>
                <th style="text-align: right;">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              ${footerHtml}
            </tbody>
          </table>
        </body>
        </html>
      `;

      printHTMLReport(htmlContent);
    }
  };

  
  

  const fetchStaff = async () => {
    try {
      const res = await apiFetch<{ data: any[] | null; error: any }>("/query-bridge", {
        method: "POST",
        body: JSON.stringify({
          table: "staff",
          action: "select"
        })
      });
      if (res && res.data) {
        setStaff(Array.isArray(res.data) ? res.data : []);
      }
    } catch (e) {
      console.error("Failed to fetch staff:", e);
      setStaff([]);
    }
  };

  const fetchAllData = async () => {
    await fetchResidents();
    await fetchStaff();
    await fetchAllLedgerEntries();
    await fetchLedgerData();
    await fetchCashbook();
    await loadBillingData();
    await loadPayments();
  };

  // ----------------------------------------------------
  // COMMON LOADING METHODS
  // ----------------------------------------------------
  const fetchResidents = async () => {
    try {
      const res = await apiFetch<{ data: any[] | null; error: any }>("/query-bridge", {
        method: "POST",
        body: JSON.stringify({
          table: "users",
          action: "select",
          filters: [{ column: "role", value: "resident" }]
        })
      });
      if (res && res.data) {
        setResidents(Array.isArray(res.data) ? res.data : []);
      }
    } catch (e) {
      console.error("Failed to fetch residents:", e);
      setResidents([]);
    }
  };

  const fetchAllLedgerEntries = async () => {
    try {
      let accountCode = undefined;
      if (ledgerSubTab === "tenant") {
        if (ledgerTenantView === "1200") accountCode = "1200";
        if (ledgerTenantView === "2100") accountCode = "2100";
      }

      // Map ledgerSubTab to voucher_type for the ERP query
      let voucherTypeForApi = ledgerVoucherFilter;
      if (ledgerSubTab === "rv") voucherTypeForApi = "RV";
      else if (ledgerSubTab === "pv") voucherTypeForApi = "PV";
      else if (ledgerSubTab === "ri") voucherTypeForApi = "RI";
      else if (ledgerSubTab === "rf") voucherTypeForApi = "RF";

      const res = await apiFetch<any>('/rpc-bridge', {
        method: 'POST',
        body: JSON.stringify({
          name: 'erp_get_ledger_lines',
          data: {
            account_code: accountCode,
            tenant_id: selectedResidentId || undefined,
            voucher_type: voucherTypeForApi !== "All" ? voucherTypeForApi : undefined,
            status: ledgerStatusFilter !== "All" ? ledgerStatusFilter : undefined,
            start_date: ledgerDateFrom || undefined,
            end_date: ledgerDateTo || undefined
          }
        })
      });

      if (res && res.data) {
        // Map the ERP lines to LedgerEntry interface
        const mapped = (res.data.lines || []).map((l: any) => ({
          ...l,
          entry_date: l.entry_date || l.posting_date,
          user_id: l.tenant_id,
          description: l.description || l.remarks
        }));
        setAllLedgerEntries(mapped);
        setLedgerOpeningBalances(res.data.opening_balances || {});
      }
    } catch (e) {
      console.error("Failed to fetch ERP ledger lines:", e);
      setAllLedgerEntries([]);
      setLedgerOpeningBalances({});
    }
  };

  // ----------------------------------------------------
  // TAB 1: RESIDENT STATEMENT HANDLERS
  // ----------------------------------------------------
  const apartmentsWithResidents = useMemo(() => {
    return residents
      .filter(r => r.apartment_no)
      .map(r => ({ id: r.id, apartment_no: r.apartment_no }))
      .sort((a, b) => (a.apartment_no || "").localeCompare(b.apartment_no || ""));
  }, [residents]);

  const residentSummaries = useMemo(() => {
    const summaries: Record<string, { currentDue: number; amountReceived: number }> = {};
    residents.forEach(r => {
      summaries[r.id] = { currentDue: 0, amountReceived: 0 };
    });
    (allLedgerEntries || []).forEach(entry => {
      if (summaries[entry.user_id]) {
        summaries[entry.user_id].currentDue += (Number(entry.debit) || 0);
        summaries[entry.user_id].amountReceived += (Number(entry.credit) || 0);
      }
    });
    return summaries;
  }, [residents, allLedgerEntries]);

  const processedStatement = useMemo(() => {
    if (!statementData || !statementData.entries) return null;

    const originalEntries = statementData.entries;
    const originalOpening = Number(statementData.opening_balance || 0);

    const filtered = originalEntries.filter((entry: any) => {
      const entryDate = entry.entry_date;
      if (!entryDate) return true;

      if (filterStartDate && entryDate < filterStartDate) return false;
      if (filterEndDate && entryDate > filterEndDate) return false;

      const dateParts = entryDate.split('-');
      const year = dateParts[0];
      const month = dateParts[1];

      if (filterYear !== "all" && year !== filterYear) return false;
      if (filterMonth !== "all" && month !== filterMonth) return false;

      // Filter by Type
      if (filterType !== "all") {
        const desc = (entry.description || "").toLowerCase();
        const type = entry.entry_type;
        if (filterType === "rent" && type !== "rent" && !desc.includes("rent")) return false;
        if (filterType === "maintenance" && type !== "maintenance" && !desc.includes("maintenance")) return false;
        if (filterType === "utility" && !desc.includes("utility")) return false;
        if (filterType === "advance" && !desc.includes("advance")) return false;
        if (filterType === "security" && type !== "security" && !desc.includes("security")) return false;
        if (filterType === "extra" && !desc.includes("extra")) return false;
        if (filterType === "manual" && !desc.includes("manual")) return false;
        if (filterType === "opening" && !desc.includes("opening")) return false;
      }

      return true;
    });

    let debitsBefore = 0;
    let creditsBefore = 0;

    originalEntries.forEach((entry: any) => {
      const entryDate = entry.entry_date;
      let isBefore = false;
      if (filterStartDate && entryDate < filterStartDate) {
        isBefore = true;
      }
      if (entryDate) {
        const dateParts = entryDate.split('-');
        const year = dateParts[0];
        const month = dateParts[1];

        if (filterYear !== "all" && year < filterYear) {
          isBefore = true;
        }
        if (filterYear !== "all" && year === filterYear && filterMonth !== "all" && month < filterMonth) {
          isBefore = true;
        }
        if (filterYear === "all" && filterMonth !== "all" && month < filterMonth) {
          isBefore = true;
        }
      }

      if (isBefore) {
        debitsBefore += (Number(entry.debit) || 0);
        creditsBefore += (Number(entry.credit) || 0);
      }
    });

    const computedOpening = originalOpening + debitsBefore - creditsBefore;

    let running = computedOpening;
    const entriesWithRunning = filtered.map((entry: any) => {
      running += (Number(entry.debit) || 0) - (Number(entry.credit) || 0);
      return {
        ...entry,
        balance_after: running
      };
    });

    const totalCharges = filtered.reduce((s: number, e: any) => s + (Number(e.debit) || 0), 0);
    const totalPayments = filtered.reduce((s: number, e: any) => s + (Number(e.credit) || 0), 0);
    const computedClosing = computedOpening + totalCharges - totalPayments;

    let periodString = "All Historical";
    if (filterStartDate || filterEndDate) {
      periodString = `${filterStartDate || "Start"} to ${filterEndDate || "Today"}`;
    } else if (filterYear !== "all" || filterMonth !== "all") {
      const monthNames: Record<string, string> = {
        "01": "January", "02": "February", "03": "March", "04": "April",
        "05": "May", "06": "June", "07": "July", "08": "August",
        "09": "September", "10": "October", "11": "November", "12": "December"
      };
      const monthStr = filterMonth !== "all" ? monthNames[filterMonth] : "All Months";
      const yearStr = filterYear !== "all" ? filterYear : "All Years";
      periodString = `${monthStr} ${yearStr}`;
    }

    return {
      entries: entriesWithRunning,
      opening_balance: computedOpening,
      closing_balance: computedClosing,
      total_charges: totalCharges,
      total_payments: totalPayments,
      period: periodString,
    };
  }, [statementData, filterStartDate, filterEndDate, filterMonth, filterYear, filterType]);

  const handleSelectResident = async (userId: string) => {
    if (userId === "none" || !userId) {
      setSelectedResidentId("");
      setStatementData(null);
      return;
    }
    setSelectedResidentId(userId);
    setLoadingStatement(true);
    try {
      const res = await apiFetch<any>(`/ledger/statement/${userId}`);
      if (res && !res.error) {
        setStatementData(res);
      } else {
        toast.error(res?.error || "Failed to load resident statement");
      }
    } catch (e) {
      console.error("Failed to fetch statement:", e);
      toast.error("Could not load resident statement.");
    } finally {
      setLoadingStatement(false);
    }
  };

  const handlePrintStatement = () => {
    if (!statementData || !processedStatement) return;
    downloadResidentStatementPDF({
      user: statementData.user,
      opening_balance: processedStatement.opening_balance,
      closing_balance: processedStatement.closing_balance,
      security_deposit: statementData.security_deposit,
      entries: processedStatement.entries,
      period: processedStatement.period
    });
    toast.success("Resident statement PDF downloaded.");
  };

  const handleExportStatementCSV = () => {
    if (!statementData || !processedStatement) return;
    const headers = ["Date", "Voucher No", "Description", "Debit", "Credit", "Running Balance"];
    const rows = [
      [
        (statementData.entries && statementData.entries[0]) ? statementData.entries[0].entry_date || "" : "",
        "—",
        "OPENING BALANCE B/F",
        "0",
        "0",
        processedStatement.opening_balance
      ],
      ...processedStatement.entries.map((e: any) => [
        e.entry_date,
        e.voucher_no || String(e.id).slice(0, 8).toUpperCase(),
        `"${(e.description || "").replace(/"/g, '""')}"`,
        e.debit,
        e.credit,
        e.balance_after
      ])
    ];
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `statement_${statementData.user.full_name.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Resident statement CSV exported.");
  };

  const handleExportStatementExcel = () => {
    if (!statementData || !processedStatement) return;
    const headers = ["Date", "Voucher No", "Description", "Debit", "Credit", "Running Balance"];
    const rows = [
      [
        (statementData.entries && statementData.entries[0]) ? statementData.entries[0].entry_date || "" : "",
        "—",
        "OPENING BALANCE B/F",
        "0",
        "0",
        processedStatement.opening_balance
      ],
      ...processedStatement.entries.map((e: any) => [
        e.entry_date,
        e.voucher_no || String(e.id).slice(0, 8).toUpperCase(),
        e.description,
        e.debit,
        e.credit,
        e.balance_after
      ])
    ];
    const excelContent = [headers.join("\t"), ...rows.map(e => e.join("\t"))].join("\n");
    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `statement_${statementData.user.full_name.replace(/\s+/g, "_")}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Resident statement spreadsheet exported.");
  };

  const handleEmailStatement = () => {
    if (!statementData || !processedStatement) return;
    const email = statementData.user.email || "resident@margalla.local";
    const name = statementData.user.full_name;
    const balance = processedStatement.closing_balance.toLocaleString();
    const period = processedStatement.period;
    const subject = encodeURIComponent(`Margalla Gateway Account Statement - Period: ${period}`);
    const body = encodeURIComponent(`Dear Resident ${name},\n\nYour account statement for Margalla Gateway [Period: ${period}] has been compiled.\nOutstanding Dues: PKR ${balance}.\n\nPlease find your statement details on the resident portal.\n\nThank you!`);
    const mailtoUrl = `mailto:${email}?subject=${subject}&body=${body}`;

    let opened = false;
    try {
      if (typeof window !== "undefined" && (window as any).require) {
        const { shell } = (window as any).require('electron');
        shell.openExternal(mailtoUrl);
        opened = true;
      }
    } catch (err) {}

    if (!opened) {
      window.open(mailtoUrl, '_blank');
    }
    toast.success(`Email statement draft opened for ${email}!`);
  };

  const handleWhatsAppStatement = () => {
    if (!statementData || !processedStatement) return;
    const phone = statementData.user.phone || "N/A";
    const name = statementData.user.full_name;
    const balance = processedStatement.closing_balance.toLocaleString();
    const period = processedStatement.period;
    
    // Construct premium WhatsApp message alert template
    const message = `Dear Resident ${name},\nYour account statement for Margalla Gateway [Period: ${period}] has been compiled.\nOutstanding Dues: PKR ${balance}.\nKindly review the details and submit dues at your earliest convenience to avoid suspension.\nThank you!`;
    
    setWhatsappPayload({ phone, message });
    setWhatsappModalOpen(true);
  };

  const handleTriggerMockWhatsApp = () => {
    setWhatsappModalOpen(false);
    const cleanPhoneNumber = whatsappPayload.phone.replace(/[^0-9]/g, "");
    const encodedMessage = encodeURIComponent(whatsappPayload.message);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhoneNumber}&text=${encodedMessage}`;

    let opened = false;
    try {
      if (typeof window !== "undefined" && (window as any).require) {
        const { shell } = (window as any).require('electron');
        shell.openExternal(whatsappUrl);
        opened = true;
      }
    } catch (err) {}

    if (!opened) {
      window.open(whatsappUrl, '_blank');
    }
    toast.success(`WhatsApp statement dispatcher opened for ${whatsappPayload.phone}!`);
  };

  // ----------------------------------------------------
  // TAB 2: INVOICES REGISTRY HANDLERS
  // ----------------------------------------------------
  const getFloorFromApt = (aptNo: string): number => {
    if (!aptNo) return 0;
    const match = aptNo.match(/\d+/);
    if (!match) return 0;
    const num = parseInt(match[0], 10);
    if (num < 100) return 0; // Ground floor
    return Math.floor(num / 100); // e.g. 104 -> 1, 802 -> 8
  };

  const fetchLedgerData = async () => {
    setLoadingInvoices(true);
    try {
      const res = await apiFetch<{ data: any[] | null; error: any }>("/query-bridge", {
        method: "POST",
        body: JSON.stringify({ table: "invoices", action: "select" })
      });
      if (res && res.data) {
        try {
          const mapped: LedgerRow[] = res.data.map((item: any, idx: number) => {
            const isRV = item.invoice_no && item.invoice_no.startsWith("RV-");
            
            // Lookup resident details from the pre-loaded residents array
            const resident = (residents || []).find(r => r.id === item.tenant_id);
            const resRole = resident?.role || item.tenant_role;
            const roleLabel = resRole ? (String(resRole).charAt(0).toUpperCase() + String(resRole).slice(1)) : "Resident";
            
            return {
              sno: idx + 1,
              unit: item.apartment_no || "—",
              type1: roleLabel,
              name: resident?.full_name || item.tenant_name || "—",
              type2: resident?.apartment_type || "—",
              remarks: isRV ? "Payment Voucher" : "Monthly Utility Bill",
              rentedOn: item.date || "—",
              rent: Number(item.flat_rent || 0),
              security: Number(item.security_charges || item.tenant_security || 0),
              commission: 0,
              electricity: Number(item.electricity_amount || 0),
              gas: Number(item.gas_charges || 0),
              pending: Number(item.previous_arrears || 0),
              total: Number(item.total_bill_amount || 0),
              received: Number(item.amount_received || 0),
              mode: Number(item.amount_received || 0) > 0 ? "Processed Payment" : "—",
              rvNo: isRV ? item.invoice_no : "—",
              rvDate: isRV ? item.date : "—",
              balance: Number(item.current_balance || 0),
              refund: 0,
              adjustment: 0,
              client_id: resident?.client_id || "",
              tenant_id: item.tenant_id,
              id: item.id,
              invoice_no: item.invoice_no
            };
          });
          setLedgerRows(mapped);
        } catch (parseErr) {
          console.error("Failed to parse invoice database rows:", parseErr);
        }
      }
    } catch (e) {
      console.error("Failed to fetch invoices for ledger:", e);
      toast.error("Could not load financial records from database.");
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleUpdateInvoice = async () => {
    if (!editingInvoice) return;
    setSavingInvoice(true);
    try {
      const res = await apiFetch<any>("/utility/update-invoice", {
        method: "POST",
        body: JSON.stringify({
          id: editingInvoice.id,
          flat_rent: editingInvoice.flat_rent,
          maintenance_charges: editingInvoice.maintenance_charges,
          electricity_amount: editingInvoice.electricity_amount,
          gas_charges: editingInvoice.gas_charges,
          previous_arrears: editingInvoice.previous_arrears,
          amount_received: editingInvoice.amount_received
        })
      });
      if (res && res.success) {
        toast.success("Invoice and ledger entry updated successfully! Running balances recalculated.");
        setEditInvoiceOpen(false);
        setEditingInvoice(null);
        await fetchLedgerData();
        // Recalculate other general states
        fetchAllLedgerEntries();
        window.dispatchEvent(new CustomEvent("central-entry-submitted", { detail: { type: "invoice" } }));
      } else {
        toast.error(res?.message || "Failed to update invoice");
      }
    } catch (err: any) {
      console.error("Update invoice failed:", err);
      toast.error(err.message || "Failed to update invoice");
    } finally {
      setSavingInvoice(false);
    }
  };

  const filteredRows = useMemo(() => {
    return ledgerRows.map(row => {
      const resident = (residents || []).find(r => r.id === row.tenant_id);
      const resRole = resident?.role || row.type1;
      const roleLabel = resRole ? (String(resRole).charAt(0).toUpperCase() + String(resRole).slice(1)) : "Resident";
      
      return {
        ...row,
        type1: roleLabel,
        name: resident?.full_name || row.name,
        type2: resident?.apartment_type || row.type2,
        client_id: resident?.client_id || "",
        phone: resident?.phone || ""
      };
    }).filter(row => {
      const cId = row.client_id || "";
      const matchesUnit = row.unit.toLowerCase().includes(searchUnit.toLowerCase()) || 
                          row.name.toLowerCase().includes(searchUnit.toLowerCase()) ||
                          row.rvNo.toLowerCase().includes(searchUnit.toLowerCase()) ||
                          cId.toLowerCase().includes(searchUnit.toLowerCase());
      
      const matchesType = typeFilter === 'All' || row.type1 === typeFilter;
      
      // Date wise filter
      const matchesDate = (!startDate || !endDate) || (row.rentedOn >= startDate && row.rentedOn <= endDate);
      
      // Floor filter
      const aptFloor = getFloorFromApt(row.unit);
      let matchesFloor = true;
      if (searchFloor !== "All") {
        if (searchFloor === "Ground") {
          matchesFloor = aptFloor === 0;
        } else {
          matchesFloor = aptFloor === parseInt(searchFloor, 10);
        }
      }
      
      return matchesUnit && matchesType && matchesDate && matchesFloor;
    });
  }, [ledgerRows, residents, searchUnit, typeFilter, startDate, endDate, searchFloor]);

  const columnTotals = useMemo(() => {
    return filteredRows.reduce((acc, row) => {
      acc.rent += row.rent;
      acc.security += row.security;
      acc.commission += row.commission;
      acc.electricity += row.electricity;
      acc.gas += row.gas;
      acc.pending += row.pending;
      acc.total += row.total;
      acc.received += row.received;
      acc.balance += row.balance;
      acc.refund += row.refund;
      acc.adjustment += row.adjustment;
      return acc;
    }, {
      rent: 0, security: 0, commission: 0, electricity: 0, gas: 0,
      pending: 0, total: 0, received: 0, balance: 0, refund: 0, adjustment: 0
    });
  }, [filteredRows]);

  const handleExportCSV = () => {
    const headers = [
      "S.No", "Unit", "Property Type", "Client Name", "Unit Type", "Remarks", "Rented On", 
      "Rent", "Security", "Commission", "Electricity", "Gas", "Pending Dues", 
      "Total Dues", "Amount Received", "Payment Mode", "RV Number", "RV Date", 
      "Balance Payment", "Refund", "Adjustment"
    ];
    const rows = ledgerRows.map(row => [
      row.sno, `"${row.unit.replace(/"/g, '""')}"`, `"${row.type1.replace(/"/g, '""')}"`,
      `"${row.name.replace(/"/g, '""')}"`, `"${row.type2.replace(/"/g, '""')}"`,
      `"${row.remarks.replace(/"/g, '""')}"`, row.rentedOn, row.rent, row.security,
      row.commission, row.electricity, row.gas, row.pending, row.total, row.received,
      `"${row.mode.replace(/"/g, '""')}"`, `"${row.rvNo.replace(/"/g, '""')}"`, row.rvDate,
      row.balance, row.refund, row.adjustment
    ]);
    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Margalla_Gateway_Monthly_Invoices.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Invoices exported as CSV successfully.");
  };

  const handlePrintLedgerSheet = () => {
    const printContent = printAreaRef.current?.innerHTML;
    if (!printContent) {
      toast.error("Nothing to print.");
      return;
    }
    const htmlDoc = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Margalla Gateway - Monthly Invoices Registry</title>
          <style>
            body { font-family: monospace; padding: 20px; color: #000; background: #fff; font-size: 10px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .header h1 { margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; }
            table { border-collapse: collapse; margin-top: 10px; width: 100%; }
            th, td { border: 1px solid #000; padding: 6px; text-align: center; font-size: 8px; white-space: nowrap; }
            th { background-color: #f2f2f2; font-weight: bold; text-transform: uppercase; }
            .totals-row { font-weight: bold; background-color: #eaeaea; }
            th:last-child, td:last-child { display: none !important; }
            @media print { @page { size: landscape; margin: 0.5cm; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Margalla Gateway Management System</h1>
            <p>Monthly Invoices Registry &amp; Ledger Report</p>
            ${startDate && endDate ? `<p><strong>Filter Period:</strong> ${startDate} to ${endDate}</p>` : '<p><strong>Filter Period:</strong> All Accumulations</p>'}
          </div>
          ${printContent}
        </body>
      </html>
    `;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlDoc);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => { try { document.body.removeChild(iframe); } catch (_) {} }, 2000);
      }, 400);
    }
  };

  // ----------------------------------------------------
  // TAB 3: DAILY CASH BOOK HANDLERS
  // ----------------------------------------------------
  const fetchCashbook = async () => {
    setLoadingCashbook(true);
    try {
      const res = await apiFetch<any>('/rpc-bridge', {
        method: 'POST',
        body: JSON.stringify({
          name: 'erp_get_ledger_lines',
          data: { account_code: "1000" }
        })
      });
      if (res && res.data && res.data.lines) {
        setCashbookRows(res.data.lines.map((le: any) => ({
          id: le.journal_id, // Map journal_id as ID for deletion/reference
          entry_date: le.posting_date,
          description: le.remarks,
          category: le.voucher_type,
          type: Number(le.debit) > 0 ? "debit" : "credit", // In Cash account, DR is receipt (Cash In), CR is payment (Cash Out)
          amount: Number(le.debit) > 0 ? le.debit : le.credit,
          receipt_url: null,
          balance_after: 0
        })));
      }
    } catch (e) {
      console.error("Failed to fetch cashbook from ERP:", e);
      setCashbookRows([]);
    } finally {
      setLoadingCashbook(false);
    }
  };

  const dailyCashbookRows = useMemo(() => {
    return cashbookRows.filter(r => r.entry_date === selectedDate);
  }, [cashbookRows, selectedDate]);

  const cashbookTotals = useMemo(() => {
    const inc = dailyCashbookRows.filter(r => r.type === "credit").reduce((s, r) => s + Number(r.amount), 0);
    const exp = dailyCashbookRows.filter(r => r.type === "debit").reduce((s, r) => s + Number(r.amount), 0);
    return { inc, exp, bal: inc - exp };
  }, [dailyCashbookRows]);

  const handleCashbookTypeChange = (newType: "debit" | "credit") => {
    setCashbookForm(prev => ({
      ...prev,
      type: newType,
      category: newType === "credit" ? "4900" : "5900"
    }));
  };

  const filteredCashbookCategories = useMemo(() => {
    if (cashbookForm.type === "credit") {
      return ACCOUNT_CATEGORIES.filter(g => ["Income", "Liabilities"].includes(g.group));
    } else {
      return ACCOUNT_CATEGORIES.filter(g => ["Expense", "Assets"].includes(g.group));
    }
  }, [cashbookForm.type]);

  const submitCashbookEntry = async () => {
    if (!cashbookForm.description || !cashbookForm.amount) { 
      toast.error("Please fill in description and amount."); 
      return; 
    }
    setSavingCashbookEntry(true);
    try {
      const amt = Number(cashbookForm.amount);
      await apiFetch("/ledger", {
        method: "POST",
        body: JSON.stringify({
          user_id: cashbookForm.resident_id || "admin-id-default",
          entry_date: cashbookForm.entry_date,
          entry_type: cashbookForm.category,
          description: cashbookForm.description,
          debit: cashbookForm.type === "debit" ? amt : 0,
          credit: cashbookForm.type === "credit" ? amt : 0,
        }),
      });
      toast.success("Cash Book entry posted successfully!");
      setCashbookDialogOpen(false);
      setCashbookForm({
        entry_date: selectedDate,
        description: "",
        category: "4900",
        type: "credit",
        amount: "",
        resident_id: "",
        payment_channel: "Cash"
      });
      fetchCashbook();
      fetchAllLedgerEntries();
      window.dispatchEvent(new CustomEvent("central-entry-submitted", { detail: { type: "cashbook" } }));
    } catch (e) {
      console.error("Save accounting entry failed:", e);
      toast.error("Failed to save transaction entry.");
    } finally {
      setSavingCashbookEntry(false);
    }
  };

  const removeCashbookEntry = async (id: string) => {
    if (!confirm("Are you sure you want to delete this cash entry?")) return;
    try {
      await apiFetch(`/ledger/${id}`, { method: "DELETE" });
      toast.success("Entry deleted successfully.");
      fetchCashbook();
      fetchAllLedgerEntries();
      window.dispatchEvent(new CustomEvent("central-entry-submitted", { detail: { type: "cashbook" } }));
    } catch (e) {
      console.error("Delete finance entry failed:", e);
      toast.error("Failed to delete the entry.");
    }
  };

  const handlePrintCashbookInvoice = (r: Entry) => {
    let residentName = "General Public / Walk-in";
    let residentId = "N/A";
    let apartmentNo = "N/A";

    if (r.resident_id) {
      const resident = residents.find((res) => res.id === r.resident_id);
      if (resident) {
        residentName = resident.full_name || "Valued Resident";
        residentId = resident.client_id || "N/A";
        apartmentNo = resident.apartment_no || "N/A";
      }
    }

    import("@/lib/print-invoice").then(({ printInvoiceReceipt }) => {
      printInvoiceReceipt({
        residentName,
        residentId,
        apartmentNo,
        date: r.entry_date,
        refNo: String(r.id).slice(0, 8).toUpperCase(),
        description: r.description,
        amount: String(r.amount),
        status: r.type === "credit" ? "Paid" : "Disbursed",
      });
    });
  };

  const exportCashbookPdf = () => {
    const cashRows: any[][] = [];
    dailyCashbookRows.forEach((r, i) => {
      cashRows.push([
        r.entry_date,
        r.description,
        r.type === "credit" ? `PKR ${Number(r.amount).toLocaleString()}` : "—",
        r.type === "debit" ? `PKR ${Number(r.amount).toLocaleString()}` : "—"
      ]);
    });

    printHTMLReport({
      title: "Daily Cash Book Statement",
      titleUrdu: "روزانہ کیش بک اسٹیٹمنٹ",
      fileName: `Cashbook_${selectedDate}.pdf`,
      metaFields: [
        { label: "Book Date", labelUrdu: "کتاب کی تاریخ", value: selectedDate }
      ],
      tableHeaders: [
        { text: "Date", textUrdu: "تاریخ" },
        { text: "Description", textUrdu: "تفصیل" },
        { text: "Cash In (Receipts)", textUrdu: "آمدن (کیش ان)" },
        { text: "Cash Out (Payments)", textUrdu: "اخراجات (کیش آؤٹ)" }
      ],
      tableRows: cashRows,
      footerRows: [
        [
          isUrdu ? "کل میزان" : "TOTAL SUMMARY",
          "",
          `PKR ${cashbookTotals.inc.toLocaleString()}`,
          `PKR ${cashbookTotals.exp.toLocaleString()}`
        ],
        [
          isUrdu ? "خالص کیش ان ہینڈ" : "NET CASH IN HAND",
          "",
          `PKR ${cashbookTotals.bal.toLocaleString()}`,
          ""
        ]
      ]
    });
    toast.success("Daily Cash Book statement generated.");
  };

  // ----------------------------------------------------
  // TAB 4: BOOKKEEPING REPORTS HANDLERS
  // ----------------------------------------------------
  const loadReports = async () => {
    setLoadingReports(true);
    try {
      const [c, j, t, p, b] = await Promise.all([
        supabase.from("chart_of_accounts").select("*").order("code"),
        supabase.from("journal_entries").select("id, entry_date, description, reference").order("entry_date", { ascending: false }).limit(200),
        supabase.rpc("fn_trial_balance", { _from: repFrom, _to: repTo }),
        supabase.rpc("fn_profit_loss", { _from: repFrom, _to: repTo }),
        supabase.rpc("fn_balance_sheet", { _as_of: repAsOf }),
      ]);
      setCoa((c.data ?? []) as any);
      setJournal((j.data ?? []) as any);
      setTb((t.data ?? []) as any);
      setPl((p.data ?? []) as any);
      setBs((b.data ?? []) as any);
    } catch (e) {
      console.error("Reports loading error:", e);
      toast.error("Failed to load bookkeeping records.");
    } finally {
      setLoadingReports(false);
    }
  };

  const reportTotals = useMemo(() => {
    const dr = tb.reduce((s, r) => s + Number(r.total_debit), 0);
    const cr = tb.reduce((s, r) => s + Number(r.total_credit), 0);
    const inc = pl.filter(r => r.account_type === "income").reduce((s, r) => s + Number(r.amount), 0);
    const exp = pl.filter(r => r.account_type === "expense").reduce((s, r) => s + Number(r.amount), 0);
    const ast = bs.filter(r => r.account_type === "asset").reduce((s, r) => s + Number(r.amount), 0);
    const lia = bs.filter(r => r.account_type === "liability").reduce((s, r) => s + Number(r.amount), 0);
    const eq = bs.filter(r => r.account_type === "equity").reduce((s, r) => s + Number(r.amount), 0);
    return { dr, cr, inc, exp, net: inc - exp, ast, lia, eq };
  }, [tb, pl, bs]);

  const quickRange = (kind: "mtd" | "ytd" | "lastMonth") => {
    const now = new Date();
    if (kind === "mtd") { 
      setRepFrom(format(startOfMonth(now), "yyyy-MM-dd")); 
      setRepTo(format(now, "yyyy-MM-dd")); 
    } else if (kind === "ytd") { 
      setRepFrom(format(startOfYear(now), "yyyy-MM-dd")); 
      setRepTo(format(now, "yyyy-MM-dd")); 
    } else { 
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1); 
      setRepFrom(format(startOfMonth(lm), "yyyy-MM-dd")); 
      setRepTo(format(endOfMonth(lm), "yyyy-MM-dd")); 
    }
  };

  // ----------------------------------------------------
  // TAB 5: EXECUTIVE ANALYTICS HANDLERS
  // ----------------------------------------------------
  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      if (analyticsType === "collection") {
        const rentEntries = allLedgerEntries.filter((le: any) => le.entry_type === 'rent');
        const months: Record<string, { month: string; billed: number; collected: number }> = {};
        
        rentEntries.forEach((le: any) => {
          if (!le.entry_date) return; // skip entries with no date
          const m = le.entry_date.slice(0, 7); 
          if (!months[m]) {
            months[m] = { month: m, billed: 0, collected: 0 };
          }
          months[m].billed += Number(le.debit || 0);
          months[m].collected += Number(le.credit || 0);
        });
        
        const mapped = Object.values(months).map((m: any) => {
          const outstanding = m.billed - m.collected;
          const percentage = m.billed > 0 ? (m.collected / m.billed) * 100 : 0;
          return {
            month: m.month,
            billed: m.billed,
            collected: m.collected,
            outstanding,
            percentage
          };
        }).sort((a, b) => (b.month || "").localeCompare(a.month || ""));
        setAnalyticsData(mapped);
      } else {
        const mapped = residents.map((res: any) => {
          const resEntries = allLedgerEntries.filter((le: any) => le.tenant_id === res.id);
          const bal = Number(res.outstanding_balance || 0);
          
          let age_30 = 0, age_60 = 0, age_90 = 0, age_120 = 0, age_plus = 0;
          const debits = resEntries.filter((le: any) => Number(le.debit || 0) > 0).sort((a, b) => (b.entry_date || '').localeCompare(a.entry_date || ''));
          
          let remaining = bal;
          const today = new Date();
          for (const d of debits) {
            if (remaining <= 0) break;
            const entryDate = d.entry_date ? new Date(d.entry_date) : new Date();
            const diffTime = Math.abs(today.getTime() - entryDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const amt = Math.min(remaining, Number(d.debit || 0));
            if (diffDays <= 30) age_30 += amt;
            else if (diffDays <= 60) age_60 += amt;
            else if (diffDays <= 90) age_90 += amt;
            else if (diffDays <= 120) age_120 += amt;
            else age_plus += amt;
            remaining -= amt;
          }
          if (remaining > 0) age_plus += remaining;
          
          const totalBilled = resEntries.reduce((sum: number, le: any) => sum + Number(le.debit || 0), 0);
          const totalCollected = resEntries.reduce((sum: number, le: any) => sum + Number(le.credit || 0), 0);
          const recoveryRate = totalBilled > 0 ? Math.min(100, (totalCollected / totalBilled) * 100) : (bal <= 0 ? 100 : 0);
          
          return {
            name: res.full_name,
            unit: res.apartment_no || "—",
            client_id: res.client_id,
            age_30, age_60, age_90, age_120, age_plus,
            total: bal,
            recoveryRate
          };
        }).sort((a, b) => b.total - a.total);
        setAnalyticsData(mapped);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const triggerAnalyticsExport = () => {
    if (analyticsType === "collection") {
      downloadRentCollectionPDF({
        summaryRows: analyticsData.map(item => ({
          month: item.month,
          billed: item.billed,
          collected: item.collected,
          outstanding: item.outstanding,
          percentage: item.percentage
        })),
        propertyRows: [{
          property_name: "Margalla Gateway",
          billed: columnTotals.rent,
          collected: columnTotals.received,
          outstanding: columnTotals.total - columnTotals.received,
          percentage: columnTotals.rent > 0 ? (columnTotals.received / columnTotals.rent) * 100 : 0
        }],
        apartmentRows: [],
        residentRows: []
      });
    } else {
      downloadArrearsRecoveryPDF({
        propertySummary: [{
          property_name: "Margalla Gateway",
          total_arrears: analyticsData.reduce((s, x) => s + x.total, 0),
          recovered: analyticsData.reduce((s, x) => s + (x.total * (x.recoveryRate / 100)), 0),
          outstanding: analyticsData.reduce((s, x) => s + x.total, 0),
          recovery_rate: 100
        }],
        agingRows: analyticsData.map(item => ({
          name: item.name,
          unit: item.unit,
          client_id: item.client_id,
          age_30: item.age_30,
          age_60: item.age_60,
          age_90: item.age_90,
          age_120: item.age_120,
          age_plus: item.age_plus,
          total: item.total,
          last_payment_date: "Check Statement",
          recovery_rate: item.recoveryRate
        }))
      });
    }
  };

  // ----------------------------------------------------
  // TAB 6: MONTHLY BILLING HANDLERS
  // ----------------------------------------------------
  const loadBillingData = async () => {
    setBillingLoading(true);
    try {
      const res = await apiFetch<{ users: any[] }>("/users");
      if (res && res.users) {
        const mapped = res.users
          .filter((u: any) => u.role === "resident" && u.apartment_no)
          .map((u: any) => ({
            id: u.id,
            apartment_no: u.apartment_no || "",
            rental_name: u.full_name || "",
            elec_prev: Number(u.elec_prev || 0),
            elec_curr: Number(u.elec_curr || 0),
            elec_rate: Number(u.elec_rate || billingElecRate),
            elec_arrears: 0,
            gas_fixed_payment: Number(u.gas_fixed_payment || 0),
            rent_amount: Number(u.rent_amount || 0),
            fixed_maintenance: Number(u.fixed_maintenance || billingMaintPool),
            stall_rent: Number(u.stall_rent || 0),
            opening_balance: Number(u.outstanding_balance || 0),
            amount_received: 0,
          }));
        setBillingApts(mapped);
      }
    } catch (err) {
      toast.error("Could not load billing data");
    } finally {
      setBillingLoading(false);
    }
  };

  const updateBillingRow = (id: string, field: string, value: any) => {
    setBillingApts(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const calcBillingRow = (apt: any) => {
    const elecUnits = Math.max(0, apt.elec_curr - apt.elec_prev);
    const elecCost = elecUnits * apt.elec_rate;
    const gasCost = Number(apt.gas_fixed_payment || 0);
    const maint = apt.fixed_maintenance || billingMaintPool;
    const openBal = Number(apt.opening_balance || 0);
    const currentBill = elecCost + gasCost + apt.rent_amount + maint;
    const grossPayable = currentBill + openBal;
    const netDue = Math.max(0, grossPayable - Number(apt.amount_received || 0));
    return { elecUnits, elecCost, gasUnits: 0, gasCost, maint, stall: 0, openBal, currentBill, grossPayable, netDue };
  };

  const handlePrintInvoiceStep4 = (r: any) => {
    const elecR = (utilElecReadings || []).find(x => x?.apartment_no === r?.apartment_no);
    const gasR  = (utilGasReadings || []).find(x => x?.apartment_no === r?.apartment_no);
    const total = r.rent + r.maintenance + r.gas + r.electricity + r.previous_arrears;
    const received = Number(r.payment_received || 0);
    const remaining = Math.max(0, total - received);
    printLedgerStatement({
      invoiceNo: `MGT-${r.apartment_no}-${Date.now()}`,
      billingPeriod: new Date(utilBillingMonth + '-02').toLocaleDateString('en-PK', { month: 'long', year: 'numeric' }),
      issueDate: new Date().toLocaleDateString('en-PK'),
      tenantName: r.full_name || 'Resident',
      apartmentNo: r.apartment_no || 'N/A',
      rent: r.rent,
      maintenance: r.maintenance,
      elecPrev: elecR ? elecR.prev_reading : 0,
      elecCurr: elecR ? elecR.curr_reading : 0,
      elecUnits: elecR ? elecR.units_consumed : 0,
      elecRate: utilElecCostPerUnit,
      gasPrev: gasR ? gasR.prev_reading : 0,
      gasCurr: gasR ? gasR.curr_reading : 0,
      gasUnits: gasR ? gasR.units_consumed : 0,
      gasRate: utilGasCostPerUnit,
      gas: r.gas,
      openingBalance: r.previous_arrears,
      totalBill: r.rent + r.maintenance + r.electricity + r.gas,
      arrears: r.previous_arrears,
      grossPayable: total,
      cashReceived: received,
      netArrears: remaining,
    });
  };

  const handleWhatsAppInvoiceStep4 = (r: any) => {
    const phone = r.phone || "";
    const cleanPhone = phone.replace(/\D/g, "");
    let formattedPhone = cleanPhone;
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "92" + formattedPhone.slice(1);
    } else if (formattedPhone.length === 10) {
      formattedPhone = "92" + formattedPhone;
    }

    const total = r.rent + r.maintenance + r.gas + r.electricity + r.previous_arrears;
    const received = Number(r.payment_received || 0);
    const remaining = Math.max(0, total - received);

    let msg = `*MARGALLA GATEWAY - MONTHLY BILL INVOICE*\n\n`;
    msg += `*Month:* ${utilBillingMonth}\n`;
    msg += `*Unit / Apartment:* ${r.apartment_no}\n`;
    msg += `*Resident:* ${r.full_name}\n\n`;
    msg += `*Rent:* PKR ${r.rent.toLocaleString()}/-\n`;
    msg += `*Maintenance:* PKR ${r.maintenance.toLocaleString()}/-\n`;
    msg += `*Sui Gas Charges:* PKR ${r.gas.toLocaleString()}/-\n`;
    msg += `*Electricity Charges:* PKR ${r.electricity.toLocaleString()}/-\n`;
    msg += `*Previous Outstanding Arrears:* PKR ${r.previous_arrears.toLocaleString()}/-\n\n`;
    msg += `*TOTAL PAYABLE:* PKR ${total.toLocaleString()}/-\n`;
    msg += `*Payment Received:* PKR ${received.toLocaleString()}/-\n`;
    msg += `*Remaining Balance Due:* PKR ${remaining.toLocaleString()}/-\n\n`;
    msg += `Please submit your dues at your earliest convenience to avoid utility suspension.\n`;
    msg += `Thank you. Powered by Margalla Gateway ERP.`;

    const encodedMsg = encodeURIComponent(msg);
    const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedMsg}`;

    let opened = false;
    try {
      if (typeof window !== "undefined" && (window as any).require) {
        const { shell } = (window as any).require('electron');
        shell.openExternal(url);
        opened = true;
      }
    } catch (err) {}

    if (!opened) {
      window.open(url, '_blank');
    }
    toast.success(`WhatsApp invoice dispatcher opened for ${r.apartment_no}!`);
  };

  const handlePrintInvoiceFromRegistry = (row: any) => {
    printLedgerStatement({
      invoiceNo: row.rvNo !== "—" ? row.rvNo : `MGT-${row.unit}-${Date.now().toString().slice(-6)}`,
      billingPeriod: row.rentedOn,
      issueDate: row.rentedOn,
      tenantName: row.name || 'Resident',
      apartmentNo: row.unit || 'N/A',
      rent: row.rent,
      maintenance: row.security,
      elecPrev: 0,
      elecCurr: 0,
      elecUnits: 0,
      elecRate: 0,
      gasPrev: 0,
      gasCurr: 0,
      gasUnits: 0,
      gasRate: 0,
      gas: row.gas + row.electricity,
      openingBalance: row.pending,
      totalBill: row.total,
      arrears: row.pending,
      grossPayable: row.total,
      cashReceived: row.received,
      netArrears: row.balance,
    });
  };

  const handleWhatsAppInvoiceFromRegistry = (row: any) => {
    const phone = row.phone || "";
    const cleanPhone = phone.replace(/\D/g, "");
    let formattedPhone = cleanPhone;
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "92" + formattedPhone.slice(1);
    } else if (formattedPhone.length === 10) {
      formattedPhone = "92" + formattedPhone;
    }

    const total = row.total;
    const remaining = row.balance;

    let msg = `*MARGALLA GATEWAY - BILL STATEMENT*\n\n`;
    msg += `*Date:* ${row.rentedOn}\n`;
    msg += `*Unit / Apartment:* ${row.unit}\n`;
    msg += `*Resident:* ${row.name}\n\n`;
    if (row.rent > 0) msg += `*Rent:* PKR ${row.rent.toLocaleString()}/-\n`;
    if (row.security > 0) msg += `*Security/Maint:* PKR ${row.security.toLocaleString()}/-\n`;
    if (row.electricity > 0) msg += `*Electricity:* PKR ${row.electricity.toLocaleString()}/-\n`;
    if (row.gas > 0) msg += `*Sui Gas:* PKR ${row.gas.toLocaleString()}/-\n`;
    if (row.pending > 0) msg += `*Previous Arrears:* PKR ${row.pending.toLocaleString()}/-\n\n`;
    msg += `*TOTAL DUE:* PKR ${total.toLocaleString()}/-\n`;
    msg += `*Amount Paid:* PKR ${row.received.toLocaleString()}/-\n`;
    msg += `*Outstanding Balance:* PKR ${remaining.toLocaleString()}/-\n\n`;
    msg += `Please submit any pending dues at your earliest convenience.\n`;
    msg += `Thank you. Powered by Margalla Gateway ERP.`;

    const encodedMsg = encodeURIComponent(msg);
    const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedMsg}`;

    let opened = false;
    try {
      if (typeof window !== "undefined" && (window as any).require) {
        const { shell } = (window as any).require('electron');
        shell.openExternal(url);
        opened = true;
      }
    } catch (err) {}

    if (!opened) {
      window.open(url, '_blank');
    }
    toast.success(`WhatsApp invoice dispatcher opened for ${row.unit}!`);
  };

  // --- REFUND HANDLER ---
  const handleRefundFromRegistry = async (row: any, type: "RI" | "RV" | "PV") => {
    const reason = window.prompt(`Enter refund reason for ${type} — ${row.unit || row.name}:`);
    if (reason === null) return; // cancelled
    const amount = type === "RI" ? (row.total || 0) : (row.amount || row.total || 0);
    if (!amount || amount <= 0) {
      toast.error("Amount is zero — cannot process refund.");
      return;
    }

    try {
      const tenantId = row.tenantId || row.tenant_id || "system";
      const refundNo = `RF-${Date.now().toString().slice(-6)}`;
      const now = new Date().toISOString().slice(0, 10);

      // 1. Reverse ledger entry
      const desc = `[REFUND ${type} ${refundNo}] Original: ${row.rvNo || row.invoice_no || "N/A"} | Reason: ${reason}`;
      await apiFetch("/ledger", {
        method: "POST",
        body: JSON.stringify({
          user_id: tenantId,
          entry_date: now,
          entry_type: "other",
          description: desc,
          debit: type === "RI" || type === "RV" ? amount : 0,
          credit: type === "PV" ? amount : 0,
        })
      });

      // 2. Record in refund_vouchers table
      await apiFetch('/query-bridge', {
        method: 'POST',
        body: JSON.stringify({
          table: 'refund_vouchers',
          action: 'insert',
          data: {
            id: crypto.randomUUID ? crypto.randomUUID() : `rf-${Date.now()}`,
            refund_no: refundNo,
            original_type: type,
            original_voucher_no: row.rvNo || row.invoice_no || "N/A",
            tenant_id: tenantId,
            amount,
            reason,
            refund_date: now,
            posted_by: "admin",
            created_at: new Date().toISOString(),
          }
        })
      });

      toast.success(`✅ Refund ${refundNo} processed — PKR ${amount.toLocaleString()} reversed!`);
    } catch (e: any) {
      toast.error(e.message || "Refund processing failed.");
    }
  };

  const handlePrintBillingRow = (apt: any) => {
    const { elecUnits, elecCost, gasUnits, gasCost, maint, stall, openBal, currentBill, grossPayable, netDue } = calcBillingRow(apt);
    printLedgerStatement({
      invoiceNo: `MGT-${apt.apartment_no}-${Date.now()}`,
      billingPeriod: new Date().toLocaleDateString('en-PK', { month: 'long', year: 'numeric' }),
      issueDate: new Date().toLocaleDateString('en-PK'),
      tenantName: apt.rental_name || 'Resident',
      apartmentNo: apt.apartment_no || 'N/A',
      rent: apt.rent_amount,
      maintenance: maint,
      elecPrev: apt.elec_prev,
      elecCurr: apt.elec_curr,
      elecUnits,
      elecRate: apt.elec_rate,
      gasPrev: 0,
      gasCurr: 0,
      gasUnits: 0,
      gasRate: 0,
      gas: gasCost,
      openingBalance: openBal,
      stallRent: undefined,
      totalBill: currentBill,
      arrears: openBal,
      grossPayable,
      cashReceived: Number(apt.amount_received || 0),
      netArrears: netDue,
    });
  };

  const handlePrintBillSeparate = (apt: any, type: 'rent' | 'maint' | 'utility') => {
    const { elecUnits, elecCost, gasCost, maint, openBal } = calcBillingRow(apt);
    const billingPeriod = new Date().toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
    const issueDate = new Date().toLocaleDateString('en-PK');
    const doc = new jsPDF();
    
    // Header Style
    doc.setFillColor(15, 23, 42); // slate-900 / navy
    doc.rect(0, 0, 210, 35, "F");
    
    doc.setTextColor(212, 175, 55); // gold #d4af37
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("MARGALLA GATEWAY MANAGEMENT SYSTEM", 15, 15);
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    let title = "";
    if (type === 'rent') title = "MONTHLY RENT INVOICE";
    else if (type === 'maint') title = "MONTHLY MAINTENANCE CHARGES BILL";
    else if (type === 'utility') title = "MONTHLY UTILITIES BILL (ELECTRICITY & GAS)";
    
    doc.text(title, 15, 22);
    doc.text(`Billing Period: ${billingPeriod} | Issue Date: ${issueDate}`, 15, 28);
    
    // Tenant Details
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Apartment No: ${apt.apartment_no}`, 15, 45);
    doc.text(`Resident Name: ${apt.rental_name || 'Resident'}`, 15, 51);
    
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.5);
    doc.line(15, 55, 195, 55);
    
    // Table Details
    let headers: string[][] = [];
    let body: any[][] = [];
    
    if (type === 'rent') {
      headers = [["DESCRIPTION", "AMOUNT (PKR)"]];
      body = [
        ["Monthly Flat Lease Rent", `PKR ${Number(apt.rent_amount || 0).toLocaleString()}`],
        ["Previous Outstanding Arrears", `PKR ${Number(openBal).toLocaleString()}`],
        ["Total Rent Payable", `PKR ${Number(Number(apt.rent_amount || 0) + Number(openBal)).toLocaleString()}`]
      ];
    } else if (type === 'maint') {
      headers = [["DESCRIPTION", "AMOUNT (PKR)"]];
      body = [
        ["Fixed Building Maintenance Charges", `PKR ${Number(maint).toLocaleString()}`],
        ["Service Pool Allocation", "Included"],
        ["Total Maintenance Cost", `PKR ${Number(maint).toLocaleString()}`]
      ];
    } else if (type === 'utility') {
      headers = [["UTILITY PARAMETER", "READING / CONSUMPTION", "RATE", "AMOUNT (PKR)"]];
      body = [
        ["Electricity Meter reading (Prev)", `${apt.elec_prev} units`, "—", "—"],
        ["Electricity Meter reading (Curr)", `${apt.elec_curr} units`, "—", "—"],
        ["Electricity Units Consumed", `${elecUnits} units`, `PKR ${apt.elec_rate}`, `PKR ${elecCost.toLocaleString()}`],
        ["Fixed Gas Charges", "Fixed Rate", "—", `PKR ${gasCost.toLocaleString()}`],
        ["Total Utilities Charges", "—", "—", `PKR ${(elecCost + gasCost).toLocaleString()}`]
      ];
    }
    
    (doc as any).autoTable({
      head: headers,
      body: body,
      startY: 60,
      theme: "striped",
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [212, 175, 55],
        fontSize: 9,
        fontStyle: "bold"
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [50, 50, 50]
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { left: 15, right: 15 }
    });
    
    // Footer notes
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text("Notes: Please clear your dues within the due date to avoid service disconnections.", 15, finalY);
    doc.text("This is an electronically generated statement.", 15, finalY + 5);
    
    doc.save(`MG_Bill_${type.toUpperCase()}_${apt.apartment_no}_${new Date().toISOString().slice(0,10)}.pdf`);
    toast.success(`${type.toUpperCase()} PDF downloaded!`);
  };

  const handlePostAllBills = async () => {
    setBillingPosting(true);
    try {
      for (const apt of billingApts) {
        const { elecUnits, elecCost, gasUnits, gasCost, maint, stall, openBal, currentBill, grossPayable, netDue } = calcBillingRow(apt);
        const invoiceNo = `MGT-${apt.apartment_no}-${Date.now()}`;
        // Update user readings, fixed gas, maintenance, AND outstanding_balance in the users table
        await apiFetch('/query-bridge', { 
          method: 'POST', 
          body: JSON.stringify({ 
            table: 'users', 
            action: 'update', 
            filters: [{ column: 'id', value: apt.id }], 
            data: { 
              elec_prev: apt.elec_curr, 
              elec_curr: apt.elec_curr, 
              elec_rate: apt.elec_rate, 
              gas_fixed_payment: apt.gas_fixed_payment, 
              fixed_maintenance: maint, 
              stall_rent: apt.stall_rent, 
              outstanding_balance: netDue, 
              last_billing_date: new Date().toISOString() 
            } 
          }) 
        });
        // Insert invoice
        await apiFetch('/query-bridge', { method: 'POST', body: JSON.stringify({ table: 'invoices', action: 'insert', data: { invoice_no: invoiceNo, date: new Date().toISOString().slice(0,10), tenant_id: apt.id, apartment_no: apt.apartment_no, prev_reading: apt.elec_prev, curr_reading: apt.elec_curr, units_consumed: elecUnits, electricity_amount: elecCost, gas_charges: gasCost, flat_rent: apt.rent_amount, maintenance_charges: maint, previous_arrears: openBal, total_bill_amount: currentBill, amount_received: Number(apt.amount_received || 0), current_balance: netDue, grand_total: grossPayable, consolidated_total: apt.rent_amount + maint } }) });
        // Post to ledger
        const descParts = [`Rent: PKR ${apt.rent_amount.toLocaleString()}`];
        if (elecCost > 0) descParts.push(`Elec: PKR ${elecCost.toLocaleString()}`);
        if (gasCost > 0) descParts.push(`Gas: PKR ${gasCost.toLocaleString()}`);
        if (maint > 0) descParts.push(`Maint: PKR ${maint.toLocaleString()}`);
        await apiFetch('/ledger', { method: 'POST', body: JSON.stringify({ user_id: apt.id, entry_date: new Date().toISOString().slice(0,10), entry_type: 'rent', description: `Monthly Invoice — ${new Date().toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })} (${descParts.join(', ')})`, debit: currentBill, credit: Number(apt.amount_received || 0) }) });
      }
      toast.success('✅ All bills posted successfully!');
      setBillingMsg('✅ All bills posted to ledger and invoices registry.');
      fetchLedgerData();
      fetchAllLedgerEntries();
      window.dispatchEvent(new CustomEvent("central-entry-submitted", { detail: { type: "billing" } }));
    } catch (err) {
      toast.error('Failed to post bills');
      setBillingMsg('❌ Error posting bills.');
    } finally {
      setBillingPosting(false);
    }
  };

  // =====================================================
  // UTILITY RECOVERY SYSTEM HANDLERS
  // =====================================================

  const loadUtilApts = async () => {
    setUtilAptLoading(true);
    try {
      const res = await apiFetch<{ users: any[] }>('/users');
      const invoiceRes = await apiFetch<{ data: any[] | null }>('/query-bridge', {
        method: 'POST',
        body: JSON.stringify({ table: 'invoices', action: 'select' })
      });
      const activeInvoices = invoiceRes?.data || [];

      if (res?.users) {
        const apts = res.users
          .filter((u: any) => u.role === 'resident' && u.apartment_no)
          .sort((a: any, b: any) => (a.apartment_no || '').localeCompare(b.apartment_no || ''))
          .map((u: any) => {
            const userInvoices = activeInvoices.filter(i => i.tenant_id === u.id);
            userInvoices.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
            const latestInvoice = userInvoices[0];

            return {
              id: u.id,
              apartment_no: u.apartment_no,
              full_name: u.full_name,
              phone: u.phone || "",
              rent: latestInvoice ? Number(latestInvoice.flat_rent || 0) : Number(u.rent_amount || 0),
              maintenance: latestInvoice ? Number(latestInvoice.maintenance_charges || 0) : Number(u.monthly_maintenance || u.fixed_maintenance || 0),
              gas: latestInvoice ? Number(latestInvoice.gas_charges || 0) : Number(u.monthly_gas_fixed || u.gas_fixed_payment || 0),
              previous_arrears: latestInvoice ? Number(latestInvoice.previous_arrears || 0) : Number(u.previous_arrears || u.outstanding_balance || 0),
              electricity: 0,
            };
          });
        setUtilAptRows(apts);
        // Seed electricity readings from users
        const elecRows = res.users
          .filter((u: any) => u.role === 'resident' && u.apartment_no)
          .sort((a: any, b: any) => (a.apartment_no || '').localeCompare(b.apartment_no || ''))
          .map((u: any) => {
            const prev = Number(u.elec_prev || 0);
            const curr = Number(u.elec_curr || 0);
            const consumed = Math.max(0, curr - prev);
            return {
              apartment_no: u.apartment_no,
              user_id: u.id,
              prev_reading: prev,
              curr_reading: curr,
              units_consumed: consumed,
              cost_per_unit: 0,
              calculated_amount: 0,
            };
          });
        setUtilElecReadings(elecRows);
        const gasRows = res.users
          .filter((u: any) => u.role === 'resident' && u.apartment_no)
          .sort((a: any, b: any) => (a.apartment_no || '').localeCompare(b.apartment_no || ''))
          .map((u: any) => {
            const prev = Number(u.gas_prev || 0);
            const curr = Number(u.gas_curr || 0);
            const consumed = Math.max(0, curr - prev);
            return {
              apartment_no: u.apartment_no,
              user_id: u.id,
              prev_reading: prev,
              curr_reading: curr,
              units_consumed: consumed,
              cost_per_unit: 0,
              calculated_amount: 0,
            };
          });
        setUtilGasReadings(gasRows);
      }
    } catch (e) {
      toast.error('Failed to load apartments');
    } finally {
      setUtilAptLoading(false);
    }
  };

  const loadUtilHistory = async () => {
    setUtilHistoryLoading(true);
    try {
      const res = await apiFetch<any>('/utility/history');
      if (res?.success) {
        setUtilHistory(res.bills || []);
        setUtilCollections(res.collections || []);
      }
      // Also load lock status, recovery status, ledger, audit
      await Promise.all([loadLockStatus(), loadRecoveryStatus(), loadUtilLedger(), loadAuditLog()]);
    } catch (e) { /* silent */ } finally {
      setUtilHistoryLoading(false);
    }
  };


  const handleUtilSaveSetup = async () => {
    setUtilSavingSetup(true);
    try {
      await apiFetch('/utility/monthly-billing', {
        method: 'POST',
        body: JSON.stringify({
          billing_month: utilBillingMonth,
          billing_rows: utilAptRows.map(r => ({
            user_id: r.id,
            apartment_no: r.apartment_no,
            rent: r.rent,
            maintenance: r.maintenance,
            electricity: r.electricity,
            gas: r.gas,
            previous_arrears: r.previous_arrears,
          }))
        })
      });
      toast.success('✅ Per-apartment charges saved!');
    } catch (e) {
      toast.error('Failed to save charges');
    } finally {
      setUtilSavingSetup(false);
    }
  };

  const utilElecCostPerUnit = useMemo(() => {
    if (!utilElecGovtUnits || utilElecGovtUnits === 0) return 0;
    return utilElecGovtUnits > 0 ? Number((utilElecGovtBill / utilElecGovtUnits).toFixed(4)) : 0;
  }, [utilElecGovtBill, utilElecGovtUnits]);

  const utilGasCostPerUnit = useMemo(() => {
    if (!utilGasGovtUnits || utilGasGovtUnits === 0) return 0;
    return Number((utilGasGovtBill / utilGasGovtUnits).toFixed(4));
  }, [utilGasGovtBill, utilGasGovtUnits]);

  const updateElecReading = (aptNo: string, field: 'prev_reading' | 'curr_reading', val: number) => {
    setUtilElecReadings(prev => prev.map(r => {
      if (r.apartment_no !== aptNo) return r;
      const updated = { ...r, [field]: val };
      updated.units_consumed = Math.max(0, updated.curr_reading - updated.prev_reading);
      updated.cost_per_unit = utilElecCostPerUnit;
      updated.calculated_amount = updated.units_consumed * utilElecCostPerUnit;
      return updated;
    }));
  };

  // Recalculate elec when cost_per_unit changes
  useEffect(() => {
    setUtilElecReadings(prev => prev.map(r => ({
      ...r,
      cost_per_unit: utilElecCostPerUnit,
      calculated_amount: r.units_consumed * utilElecCostPerUnit,
    })));
  }, [utilElecCostPerUnit]);

  const updateGasReading = (aptNo: string, field: 'prev_reading' | 'curr_reading', val: number) => {
    setUtilGasReadings(prev => prev.map(r => {
      if (r.apartment_no !== aptNo) return r;
      const updated = { ...r, [field]: val };
      updated.units_consumed = Math.max(0, updated.curr_reading - updated.prev_reading);
      updated.cost_per_unit = utilGasCostPerUnit;
      updated.calculated_amount = updated.units_consumed * utilGasCostPerUnit;
      return updated;
    }));
  };

  useEffect(() => {
    setUtilGasReadings(prev => prev.map(r => ({
      ...r,
      cost_per_unit: utilGasCostPerUnit,
      calculated_amount: r.units_consumed * utilGasCostPerUnit,
    })));
  }, [utilGasCostPerUnit]);

  const utilElecTotalCollected = useMemo(() => utilElecReadings.reduce((s, r) => s + Number(r.calculated_amount || 0), 0), [utilElecReadings]);
  const utilElecDiff = utilElecTotalCollected - utilElecGovtBill;

  const utilGasEffective = useMemo(() => {
    if (utilGasMethod === 'fixed') {
      return utilAptRows.reduce((s) => s + utilGasFixedAmt, 0);
    }
    return utilGasReadings.reduce((s, r) => s + Number(r.calculated_amount || 0), 0);
  }, [utilGasMethod, utilGasFixedAmt, utilAptRows, utilGasReadings]);
  const utilGasDiff = utilGasEffective - utilGasGovtBill;

  const handleSaveElecRecovery = async () => {
    setUtilElecSaving(true);
    try {
      await apiFetch('/utility/bills', {
        method: 'POST',
        body: JSON.stringify({
          billing_month: utilBillingMonth,
          utility_type: 'electricity',
          govt_bill_amount: utilElecGovtBill,
          govt_total_units: utilElecGovtUnits,
          billing_method: 'meter',
        })
      });
      await apiFetch('/utility/meter-readings', {
        method: 'POST',
        body: JSON.stringify({
          billing_month: utilBillingMonth,
          utility_type: 'electricity',
          readings: utilElecReadings.map(r => ({ ...r, cost_per_unit: utilElecCostPerUnit }))
        })
      });
      // Update electricity amounts in apt rows
      const elecMap: Record<string, number> = {};
      (utilElecReadings || []).forEach(r => { if(r?.apartment_no) elecMap[r.apartment_no] = r.calculated_amount; });
      setUtilAptRows(prev => (prev || []).map(r => ({ ...r, electricity: (r?.apartment_no ? (elecMap[r.apartment_no] || r.electricity) : r.electricity) })));
      // Save collection summary
      const collRes = await apiFetch<any>('/utility/collections', {
        method: 'POST',
        body: JSON.stringify({
          billing_month: utilBillingMonth,
          utility_type: 'electricity',
          govt_bill: utilElecGovtBill,
          total_collected: utilElecTotalCollected,
        })
      });

      // 3. Post difference to Ledger for Society Auditing
      const diffVal = Math.round(utilElecDiff);
      if (diffVal !== 0) {
        try {
          await apiFetch('/ledger', {
            method: 'POST',
            body: JSON.stringify({
              user_id: 'system',
              entry_date: new Date().toISOString().slice(0, 10),
              entry_type: 'other',
              description: `[Utility Recovery Difference] WAPDA Electricity variance for ${utilBillingMonth}. (Govt Bill: PKR ${utilElecGovtBill} vs Billed: PKR ${utilElecTotalCollected})`,
              debit: diffVal < 0 ? Math.abs(diffVal) : 0,
              credit: diffVal > 0 ? diffVal : 0
            })
          });
        } catch (e2) {
          console.warn("Failed posting recovery variance to ledger:", e2);
        }
      }

      setUtilElecCollection(collRes);
      toast.success('✅ Electricity recovery saved & posted to ledger!');
      loadUtilHistory();
      fetchAllLedgerEntries();
    } catch (e) {
      toast.error('Failed to save electricity recovery');
    } finally {
      setUtilElecSaving(false);
    }
  };

  const handleSaveGasRecovery = async () => {
    setUtilGasSaving(true);
    try {
      await apiFetch('/utility/bills', {
        method: 'POST',
        body: JSON.stringify({
          billing_month: utilBillingMonth,
          utility_type: 'gas',
          govt_bill_amount: utilGasGovtBill,
          govt_total_units: utilGasGovtUnits,
          billing_method: utilGasMethod,
          fixed_amount: utilGasFixedAmt,
        })
      });
      if (utilGasMethod === 'meter') {
        await apiFetch('/utility/meter-readings', {
          method: 'POST',
          body: JSON.stringify({
            billing_month: utilBillingMonth,
            utility_type: 'gas',
            readings: utilGasReadings.map(r => ({ ...r, cost_per_unit: utilGasCostPerUnit }))
          })
        });
      }
      // Update gas amounts in apt rows
      if (utilGasMethod === 'fixed') {
        setUtilAptRows(prev => prev.map(r => ({ ...r, gas: utilGasFixedAmt })));
      } else {
        const gasMap: Record<string, number> = {};
        (utilGasReadings || []).forEach(r => { if(r?.apartment_no) gasMap[r.apartment_no] = r.calculated_amount; });
        setUtilAptRows(prev => (prev || []).map(r => ({ ...r, gas: (r?.apartment_no ? (gasMap[r.apartment_no] || r.gas) : r.gas) })));
      }
      const collRes = await apiFetch<any>('/utility/collections', {
        method: 'POST',
        body: JSON.stringify({
          billing_month: utilBillingMonth,
          utility_type: 'gas',
          govt_bill: utilGasGovtBill,
          total_collected: utilGasEffective,
        })
      });

      // 3. Post difference to Ledger for Society Auditing
      const diffVal = Math.round(utilGasDiff);
      if (diffVal !== 0) {
        try {
          await apiFetch('/ledger', {
            method: 'POST',
            body: JSON.stringify({
              user_id: 'system',
              entry_date: new Date().toISOString().slice(0, 10),
              entry_type: 'other',
              description: `[Utility Recovery Difference] Sui Gas variance for ${utilBillingMonth}. (Govt Bill: PKR ${utilGasGovtBill} vs Billed: PKR ${utilGasEffective})`,
              debit: diffVal < 0 ? Math.abs(diffVal) : 0,
              credit: diffVal > 0 ? diffVal : 0
            })
          });
        } catch (e2) {
          console.warn("Failed posting recovery variance to ledger:", e2);
        }
      }

      setUtilGasCollection(collRes);
      toast.success('✅ Gas recovery saved & posted to ledger!');
      loadUtilHistory();
      fetchAllLedgerEntries();
    } catch (e) {
      toast.error('Failed to save gas recovery');
    } finally {
      setUtilGasSaving(false);
    }
  };

  const handleFinalizeMonth = async () => {
    if (!confirm(`Post all ${utilBillingMonth} bills to ledger AND lock this month? This action is permanent. Edits will only be allowed via Adjustment Vouchers.`)) return;
    setUtilFinalizing(true);
    try {
      // Save final billing first
      await handleUtilSaveSetup();
      const res = await apiFetch<any>(`/utility/finalize/${utilBillingMonth}`, { method: 'POST', body: '{}' });
      if (res?.success) {
        // Lock the month
        await apiFetch<any>(`/utility/lock/${utilBillingMonth}`, {
          method: 'POST',
          body: JSON.stringify({ locked_by: 'admin', notes: `Finalized ${res.posted} billing rows` })
        });
        setUtilMonthLocked(true);
        toast.success(`✅ ${res.posted} bills posted & ${utilBillingMonth} locked!`);
        fetchAllLedgerEntries();
        fetchLedgerData();
        await loadLockStatus();
        await loadRecoveryStatus();
        await loadAuditLog();
      } else {
        toast.error('Finalize failed');
      }
    } catch (e) {
      toast.error('Failed to finalize month');
    } finally {
      setUtilFinalizing(false);
    }
  };

  const loadLockStatus = async () => {
    try {
      const res = await apiFetch<any>(`/utility/lock-status/${utilBillingMonth}`);
      if (res?.success) {
        setUtilMonthLocked(res.locked);
        setUtilLockInfo(res.closing);
      }
    } catch {}
  };

  const loadRecoveryStatus = async () => {
    try {
      const res = await apiFetch<any>(`/utility/recovery-status/${utilBillingMonth}`);
      if (res?.success) setUtilRecoveryStatus(res);
    } catch {}
  };

  const loadUtilLedger = async () => {
    try {
      const res = await apiFetch<any>(`/utility/ledger/${utilBillingMonth}`);
      if (res?.success) setUtilLedger(res);
    } catch {}
  };

  const loadAuditLog = async () => {
    try {
      const [auditRes, adjRes] = await Promise.all([
        apiFetch<any>(`/utility/audit-log/${utilBillingMonth}`),
        apiFetch<any>(`/utility/adjustments/${utilBillingMonth}`),
      ]);
      if (auditRes?.success) setUtilAuditLog(auditRes.logs);
      if (adjRes?.success) setUtilAdjVouchers(adjRes.vouchers);
    } catch {}
  };

  const handleCreateAdjustment = async () => {
    if (!adjReason.trim()) { toast.error(isUrdu ? 'وجہ درج کرنا لازمی ہے' : 'Reason is required'); return; }
    if (!adjAmt) { toast.error(isUrdu ? 'رقم درج کرنا لازمی ہے' : 'Adjustment amount is required'); return; }
    setAdjSaving(true);

    let attachment_url = null;
    if (adjFile) {
      if (adjFile.size > 5 * 1024 * 1024) {
        toast.error(isUrdu ? "فائل کا سائز 5MB سے کم ہونا چاہیے" : "File size must be under 5MB");
        setAdjSaving(false);
        return;
      }
      const allowedExts = ["pdf", "jpg", "jpeg", "png"];
      const ext = adjFile.name.split(".").pop()?.toLowerCase();
      if (!ext || !allowedExts.includes(ext)) {
        toast.error(isUrdu ? "صرف PDF، JPG، اور PNG فارمیٹس سپورٹڈ ہیں" : "Only PDF, JPG, and PNG formats are supported");
        setAdjSaving(false);
        return;
      }

      try {
        const fd = new FormData();
        fd.append("file", adjFile);
        fd.append("title", adjFile.name);
        fd.append("owner_type", "adjustment");
        fd.append("owner_id", adjAptNo || "general");
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
        attachment_url = `${apiHost}/uploads/${data.file_path}`;
      } catch (uploadErr: any) {
        console.warn("Local upload failed, trying cloud fallback:", uploadErr);
        try {
          const filePath = `adjustments/${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(filePath, adjFile);
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filePath);
          attachment_url = publicUrl;
        } catch (cloudErr: any) {
          toast.error(isUrdu ? `فائل اپلوڈ ناکام: ${cloudErr.message}` : `File upload failed: ${cloudErr.message}`);
          setAdjSaving(false);
          return;
        }
      }
    }

    try {
      const res = await apiFetch<any>('/utility/adjustment', {
        method: 'POST',
        body: JSON.stringify({
          billing_month: utilBillingMonth,
          utility_type: adjUtilType,
          apartment_no: adjAptNo,
          charge_type: adjChargeType,
          original_amount: adjOrigAmt,
          adjustment_amount: adjAmt,
          reason: adjReason,
          created_by: 'admin',
          attachment_url,
          entry_date: adjDate
        })
      });
      if (res?.success) {
        toast.success(isUrdu ? `✅ ایڈجسٹمنٹ واؤچر ${res.voucher_no} پوسٹ ہو گیا!` : `✅ Adjustment Voucher ${res.voucher_no} created!`);
        setAdjModalOpen(false);
        setAdjReason(''); setAdjAmt(0); setAdjOrigAmt(0); setAdjAptNo(''); setAdjFile(null);
        await loadAuditLog();
        await loadRecoveryStatus();
        await loadUtilLedger();
        await loadUtilApts();
      } else {
        toast.error(res?.message || 'Failed to create adjustment');
      }
    } catch (e: any) { 
      toast.error(e.message || 'Failed to create adjustment'); 
    } finally { 
      setAdjSaving(false); 
    }
  };


  const exportUtilReportPDF = (month: string) => {
    const elecColl = utilCollections.find(c => c.billing_month === month && c.utility_type === 'electricity');
    const gasColl = utilCollections.find(c => c.billing_month === month && c.utility_type === 'gas');

    const summaryRows = [
      ['Electricity', elecColl ? `PKR ${Number(elecColl.govt_bill).toLocaleString()}` : '—',
        elecColl ? `PKR ${Number(elecColl.total_collected).toLocaleString()}` : '—',
        elecColl ? `PKR ${Number(elecColl.difference).toLocaleString()}` : '—',
        elecColl ? elecColl.result_type.toUpperCase() : '—'],
      ['Gas', gasColl ? `PKR ${Number(gasColl.govt_bill).toLocaleString()}` : '—',
        gasColl ? `PKR ${Number(gasColl.total_collected).toLocaleString()}` : '—',
        gasColl ? `PKR ${Number(gasColl.difference).toLocaleString()}` : '—',
        gasColl ? gasColl.result_type.toUpperCase() : '—'],
    ];

    const readingRows = utilElecReadings.map(r => [
      r.apartment_no,
      r.prev_reading,
      r.curr_reading,
      r.units_consumed,
      `PKR ${r.cost_per_unit}`,
      `PKR ${Number(r.calculated_amount).toLocaleString()}`
    ]);

    const tableRows = [
      [isUrdu ? "--- سوسائٹی مجموعی یوٹیلیٹی سمری ---" : "--- SOCIETY UTILITY RECOVERY SUMMARY ---", "", "", "", "", ""],
      ...summaryRows.map(row => [row[0], row[1], row[2], row[3], row[4], ""]),
      ["", "", "", "", "", ""],
      [isUrdu ? "--- اپارٹمنٹ بجلی ریڈنگ بریک ڈاؤن ---" : "--- APARTMENT ELECTRICITY READINGS BREAKDOWN ---", "", "", "", "", ""],
      ...readingRows
    ];

    printHTMLReport({
      title: "Utility Recovery Report",
      titleUrdu: "یوٹیلیٹی ریکوری رپورٹ",
      fileName: `Utility_Recovery_${month}.pdf`,
      metaFields: [
        { label: "Billing Month", labelUrdu: "بلنگ کا مہینہ", value: month }
      ],
      tableHeaders: [
        { text: "Parameter / Apartment", textUrdu: "پیرامیٹر / اپارٹمنٹ" },
        { text: "Govt Bill / Prev Rdg", textUrdu: "سرکاری بل / سابقہ ریڈنگ" },
        { text: "Collected / Curr Rdg", textUrdu: "وصول شدہ / موجودہ ریڈنگ" },
        { text: "Difference / Units", textUrdu: "فرق / یونٹس" },
        { text: "Status / Rate", textUrdu: "حالت / ریٹ" },
        { text: "Amount (PKR)", textUrdu: "رقم" }
      ],
      tableRows: tableRows
    });
    toast.success("Utility recovery report generated.");
  };

  const exportUtilReportCSV = (month: string) => {
    const elecColl = utilCollections.find(c => c.billing_month === month && c.utility_type === 'electricity');
    const gasColl = utilCollections.find(c => c.billing_month === month && c.utility_type === 'gas');
    const lines = [
      `Margalla Gateway — Utility Recovery Report — ${month}`,
      '',
      'COLLECTION SUMMARY',
      'Utility,Govt Bill,Collected,Difference,Status',
      `Electricity,${elecColl?.govt_bill||0},${elecColl?.total_collected||0},${elecColl?.difference||0},${elecColl?.result_type||'N/A'}`,
      `Gas,${gasColl?.govt_bill||0},${gasColl?.total_collected||0},${gasColl?.difference||0},${gasColl?.result_type||'N/A'}`,
      '',
      'ELECTRICITY METER READINGS',
      'Apartment,Prev,Curr,Units,Rate,Amount',
      ...utilElecReadings.map(r => `${r.apartment_no},${r.prev_reading},${r.curr_reading},${r.units_consumed},${r.cost_per_unit},${r.calculated_amount}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Utility_Recovery_${month}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success('CSV exported!');
  };

  const updateUtilAptRow = (id: string, field: string, val: any) => {
    setUtilAptRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  // Load util data when billing tab is opened
  useEffect(() => {
    if (activeTab === 'billing') {
      loadUtilApts();
      loadUtilHistory();
    }
  }, [activeTab, utilBillingMonth]);

  // ----------------------------------------------------
  // TAB 7: PAYMENTS HANDLERS
  // ----------------------------------------------------

  const loadPayments = async () => {
    setPayLoading(true);
    const [{ data: rqs }, { data: profs }] = await Promise.all([
      supabase.from('payment_requests').select('id,resident_id,apartment_no,bill_type,category,type,amount,due_date,method,reference,note,status,created_at,reviewed_at,finance_entry_id').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,full_name,apartment_no,phone,rent_amount,security_deposit').order('apartment_no'),
    ]);
    setPayRows(rqs ?? []);
    setPayResidents(profs ?? []);
    setPayLoading(false);
  };

  const payResidentMap = useMemo(() => new Map(payResidents.map((r: any) => [r.id, r])), [payResidents]);

  const payFiltered = useMemo(() => {
    if (payFilter === 'all') return payRows;
    return payRows.filter((r: any) => {
      const st = (r.status === 'pending' && r.due_date && isAfter(new Date(), new Date(r.due_date))) ? 'overdue' : r.status;
      return st === payFilter;
    });
  }, [payRows, payFilter]);

  const payTotals = useMemo(() => {
    const pending = payRows.filter((r: any) => r.status === 'pending').reduce((s: number, r: any) => s + Number(r.amount), 0);
    const overdue = payRows.filter((r: any) => r.status === 'pending' && r.due_date && isAfter(new Date(), new Date(r.due_date))).reduce((s: number, r: any) => s + Number(r.amount), 0);
    const approved = payRows.filter((r: any) => r.status === 'approved').reduce((s: number, r: any) => s + Number(r.amount), 0);
    return { pending, overdue, approved };
  }, [payRows]);


  const approvePayReq = async (r: any) => {
    try {
      const { error } = await supabase.rpc('approve_payment_request', { _id: r.id });
      if (error) throw error;
      toast.success(`Approved · PKR ${Number(r.amount).toLocaleString()} credited`);
      loadPayments();
    } catch { toast.error('Could not approve'); }
  };

  const rejectPayReq = async (r: any) => {
    try {
      const { error } = await supabase.from('payment_requests').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', r.id);
      if (error) throw error;
      toast.success('Rejected'); loadPayments();
    } catch { toast.error('Could not reject'); }
  };

  const removePayReq = async (id: string) => {
    if (!confirm('Delete this request?')) return;
    try {
      const { error } = await supabase.from('payment_requests').delete().eq('id', id);
      if (error) throw error;
      loadPayments();
    } catch { toast.error('Could not delete'); }
  };

  const downloadPayInvoice = (r: any) => {
    const res = payResidentMap.get(r.resident_id);
    downloadInvoicePDF({ invoiceNo: String(r.id).slice(0,8).toUpperCase(), date: format(new Date(r.created_at), 'dd MMM yyyy'), dueDate: r.due_date ? format(new Date(r.due_date), 'dd MMM yyyy') : null, billTo: { name: (res as any)?.full_name ?? 'Resident', apartment: r.apartment_no ?? (res as any)?.apartment_no, phone: (res as any)?.phone }, lineItem: { label: `${(r.bill_type ?? 'rent').toUpperCase()} — ${r.note ?? ''}`.trim(), amount: Number(r.amount) }, bankDetails: 'Bank transfer to Margalla Gateway · Account details available in your resident portal.' });
  };

  // ----------------------------------------------------
  // INITIAL EFFECTS
  // ----------------------------------------------------
  useEffect(() => {
    fetchResidents();
    fetchAllLedgerEntries();
    fetchLedgerData();
    fetchCashbook();
    loadBillingData();
    loadPayments();
  }, []);

  // Real-time sync: refresh all data when Central Entry Console posts a transaction
  useEffect(() => {
    const handleCentralEntry = () => {
      fetchResidents();
      fetchAllLedgerEntries();
      fetchLedgerData();
      fetchCashbook();
      loadBillingData();
      loadPayments();
    };
    window.addEventListener("central-entry-submitted", handleCentralEntry);
    return () => window.removeEventListener("central-entry-submitted", handleCentralEntry);
  }, []);

  // Reload ledger entries dynamically when filters or tabs change
  useEffect(() => {
    fetchAllLedgerEntries();
  }, [
    ledgerSubTab,
    ledgerTenantView,
    selectedResidentId,
    ledgerVoucherFilter,
    ledgerStatusFilter,
    ledgerDateFrom,
    ledgerDateTo
  ]);

  // Sync active tab triggers
  useEffect(() => {
    if (activeTab === "financial_reports") {
      loadReports();
      loadAnalytics();
    }
  }, [activeTab, repFrom, repTo, repAsOf, analyticsType]);

  // ----------------------------------------------------
  // MAIN COMPONENT RENDERING
  // ----------------------------------------------------
  return (
    <div className="w-full space-y-6">
      <div className="rounded-2xl overflow-hidden border border-slate-800/80 shadow-xl mb-2">
        {/* Premium Header Bar */}
        <div className="bg-gradient-to-r from-slate-950 via-[#0f1a2e] to-slate-900 px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/60">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-900/40">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-300 tracking-wider uppercase">
                Finance & Accounts Hub
              </h1>
              <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                {isUrdu ? "بلنگ • لیجر • رپورٹس • ادائیگیاں" : "Billing · Ledger · Reports · Payments — Auto-sync Enabled"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-full">
              v1.5.0
            </span>
            <Button 
              onClick={() => window.dispatchEvent(new Event("open-central-entry"))} 
              className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white text-xs font-black uppercase tracking-wider py-2 px-5 rounded-xl shadow-lg shadow-blue-900/30 transition flex items-center gap-1.5 h-10 border border-blue-500/20"
            >
              <ReceiptText className="h-4 w-4" />
              {isUrdu ? "سینٹرل انٹری" : "Central Entry Console"}
            </Button>
          </div>
        </div>

      {/* ====================================================
          UNIVERSAL ENTRY CONSOLE (VOUCHER MODE SWITCHER)
          ==================================================== */}
      {/* Tabs Navigation */}
        <div className="bg-slate-950/80 px-3 py-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-5 bg-slate-900/60 border border-slate-800/60 rounded-xl p-1 h-11 gap-0.5">
              <TabsTrigger value="billing" className="text-[10px] font-bold py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all">
                <Zap className="h-3.5 w-3.5 mr-1" />
                {isUrdu ? "بلنگ اور یوٹیلیٹی" : "Utility & Billing"}
              </TabsTrigger>
              <TabsTrigger value="ledgers" className="text-[10px] font-bold py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all">
                <ClipboardList className="h-3.5 w-3.5 mr-1" />
                {isUrdu ? "ٹرانزیکشن لیجر" : "Transaction Ledger"}
              </TabsTrigger>
              <TabsTrigger value="invoices" className="text-[10px] font-bold py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all">
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
                {isUrdu ? "بلز رجسٹری" : "Invoices Registry"}
              </TabsTrigger>
              <TabsTrigger value="cashbook" className="text-[10px] font-bold py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all">
                <Wallet className="h-3.5 w-3.5 mr-1" />
                {isUrdu ? "کیش بک" : "Cash Book"}
              </TabsTrigger>
              <TabsTrigger value="financial_reports" className="text-[10px] font-bold py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all">
                <FileText className="h-3.5 w-3.5 mr-1" />
                {isUrdu ? "رپورٹس" : "Reports"}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

        {/* ====================================================
            TAB 1: MONTHLY BILLING + UTILITY RECOVERY SYSTEM
            ==================================================== */}
        <TabsContent value="billing" className="mt-4 space-y-4">
          <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
            {/* Module Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-amber-400 flex items-center gap-2">
                  <Zap className="h-4 w-4" /> Housing Society Billing & Utility Recovery
                  {utilMonthLocked && (
                    <span className="ml-2 inline-flex items-center gap-1 bg-red-900/60 border border-red-700/60 text-red-300 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                      🔒 LOCKED — {utilBillingMonth}
                    </span>
                  )}
                  {!utilMonthLocked && (
                    <span className="ml-2 inline-flex items-center gap-1 bg-emerald-900/40 border border-emerald-700/40 text-emerald-400 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                      ✅ OPEN
                    </span>
                  )}
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">Electricity & Gas recovery, per-apartment charges, collection tracking & reports.</p>
                {utilMonthLocked && utilLockInfo && (
                  <p className="text-[9px] text-red-400/70 mt-0.5">Locked on {new Date(utilLockInfo.locked_at).toLocaleString()} by {utilLockInfo.locked_by}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAdjModalOpen(true)}
                  className="text-[10px] bg-orange-600 hover:bg-orange-500 text-white px-2.5 py-1.5 rounded transition font-black flex items-center gap-1 shadow-md shadow-orange-950/20"
                >
                  📝 {isUrdu ? "ایڈجسٹمنٹ واؤچر" : "Adjustment Voucher"}
                </button>
                <label className="text-[10px] text-slate-400">Billing Month:</label>
                <input
                  type="month"
                  value={utilBillingMonth}
                  onChange={e => setUtilBillingMonth(e.target.value)}
                  className="bg-slate-800 border border-slate-600 text-white text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button onClick={loadUtilApts} className="text-[10px] border border-slate-600 text-slate-300 px-2 py-1 rounded hover:bg-slate-700 transition"><RefreshCw className="h-3 w-3 inline mr-1" />Reload</button>
              </div>
            </div>

            {/* Step Nav */}
            <div className="flex border-b border-border/60 bg-muted/20">
              {[{n:1,label:'Step 1: Charges Setup'},{n:2,label:'Step 2: Electricity'},{n:3,label:'Step 3: Gas'},{n:4,label:'Invoice Preview'},{n:5,label:'History & Reports'}].map(s => (
                <button
                  key={s.n}
                  onClick={() => setUtilActiveStep(s.n)}
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider border-r border-border/40 last:border-r-0 transition ${
                    utilActiveStep === s.n ? 'bg-amber-500/20 text-amber-400 border-b-2 border-b-amber-500' : 'text-muted-foreground hover:bg-muted/40'
                  }`}
                >{s.label}</button>
              ))}
            </div>

            {/* Recovery Status Dashboard Cards */}
            {utilRecoveryStatus && (
              <div className="bg-slate-900/50 border-b border-border/40 px-5 py-3">
                <div className="text-[9px] font-black text-slate-400 uppercase mb-2">📊 Recovery Status — {utilBillingMonth}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                  {/* Electricity cards */}
                  {[{label:'⚡ Elec Opening',val:utilRecoveryStatus.electricity?.opening,color:'yellow'}].map(c => (
                    <div key={c.label} className={`bg-${c.color}-950/30 border border-${c.color}-800/40 rounded-lg p-2`}>
                      <div className="text-muted-foreground text-[9px]">{c.label}</div>
                      <div className={`font-black text-${c.color}-400 font-mono`}>PKR {Math.round(c.val||0).toLocaleString()}</div>
                    </div>
                  ))}
                  <div className="bg-yellow-950/20 border border-yellow-800/30 rounded-lg p-2">
                    <div className="text-muted-foreground text-[9px]">⚡ Elec Recovery</div>
                    <div className="font-black text-yellow-300 font-mono">PKR {Math.round(utilRecoveryStatus.electricity?.collected||0).toLocaleString()}</div>
                    <div className="text-[8px] mt-0.5">
                      <span className={`font-black ${
                        utilRecoveryStatus.electricity?.status === 'fully_recovered' ? 'text-emerald-400' :
                        utilRecoveryStatus.electricity?.status === 'over_recovered' ? 'text-blue-400' :
                        utilRecoveryStatus.electricity?.status === 'under_recovered' ? 'text-orange-400' : 'text-red-400'
                      }`}>
                        {utilRecoveryStatus.electricity?.pct?.toFixed(1)}% • {
                          utilRecoveryStatus.electricity?.status === 'fully_recovered' ? '✅ 100% Recovered' :
                          utilRecoveryStatus.electricity?.status === 'over_recovered' ? '🔵 Over Recovered' :
                          utilRecoveryStatus.electricity?.status === 'under_recovered' ? '⚠️ Under Recovered' : '🔴 Outstanding'
                        }
                      </span>
                    </div>
                  </div>
                  <div className="bg-yellow-950/20 border border-yellow-800/30 rounded-lg p-2">
                    <div className="text-muted-foreground text-[9px]">⚡ Elec Remaining</div>
                    <div className={`font-black font-mono ${ (utilRecoveryStatus.electricity?.remaining||0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      PKR {Math.round(Math.abs(utilRecoveryStatus.electricity?.remaining||0)).toLocaleString()}
                      <span className="text-[8px] ml-1">{(utilRecoveryStatus.electricity?.remaining||0) > 0 ? 'SHORTFALL' : 'SURPLUS'}</span>
                    </div>
                  </div>
                  {/* Gas cards */}
                  <div className="bg-orange-950/30 border border-orange-800/40 rounded-lg p-2">
                    <div className="text-muted-foreground text-[9px]">🔥 Gas Opening</div>
                    <div className="font-black text-orange-400 font-mono">PKR {Math.round(utilRecoveryStatus.gas?.opening||0).toLocaleString()}</div>
                  </div>
                  <div className="bg-orange-950/20 border border-orange-800/30 rounded-lg p-2">
                    <div className="text-muted-foreground text-[9px]">🔥 Gas Recovery</div>
                    <div className="font-black text-orange-300 font-mono">PKR {Math.round(utilRecoveryStatus.gas?.collected||0).toLocaleString()}</div>
                    <div className="text-[8px] mt-0.5">
                      <span className={`font-black ${
                        utilRecoveryStatus.gas?.status === 'fully_recovered' ? 'text-emerald-400' :
                        utilRecoveryStatus.gas?.status === 'over_recovered' ? 'text-blue-400' :
                        utilRecoveryStatus.gas?.status === 'under_recovered' ? 'text-orange-400' : 'text-red-400'
                      }`}>
                        {utilRecoveryStatus.gas?.pct?.toFixed(1)}% • {
                          utilRecoveryStatus.gas?.status === 'fully_recovered' ? '✅ 100% Recovered' :
                          utilRecoveryStatus.gas?.status === 'over_recovered' ? '🔵 Over Recovered' :
                          utilRecoveryStatus.gas?.status === 'under_recovered' ? '⚠️ Under Recovered' : '🔴 Outstanding'
                        }
                      </span>
                    </div>
                  </div>
                  <div className="bg-orange-950/20 border border-orange-800/30 rounded-lg p-2">
                    <div className="text-muted-foreground text-[9px]">🔥 Gas Remaining</div>
                    <div className={`font-black font-mono ${ (utilRecoveryStatus.gas?.remaining||0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      PKR {Math.round(Math.abs(utilRecoveryStatus.gas?.remaining||0)).toLocaleString()}
                      <span className="text-[8px] ml-1">{(utilRecoveryStatus.gas?.remaining||0) > 0 ? 'SHORTFALL' : 'SURPLUS'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ADJUSTMENT VOUCHER MODAL */}
            {adjModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
                <div className="bg-slate-900 border border-orange-700/60 rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-orange-400">
                      {isUrdu ? "📝 ایڈجسٹمنٹ واؤچر" : "📝 Adjustment Voucher"} — {utilBillingMonth}
                    </h3>
                    <button onClick={() => setAdjModalOpen(false)} className="text-slate-400 hover:text-white text-lg">×</button>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="bg-orange-950/30 border border-orange-800/40 rounded-lg p-2 text-[10px] text-orange-200/80">
                      {isUrdu 
                        ? `⚠️ ایڈجسٹمنٹ واؤچر کے ذریعے کیے گئے تمام بدلاؤ کا مکمل آڈٹ ریکارڈ رکھا جائے گا۔`
                        : `⚠️ All changes through this Adjustment Voucher will be permanently logged in the audit trail.`}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-muted-foreground block mb-1">{isUrdu ? "ایڈجسٹمنٹ کی قسم" : "Adjustment Type"}</label>
                        <select value={adjChargeType} onChange={e => {
                          setAdjChargeType(e.target.value);
                          setAdjUtilType(e.target.value);
                        }}
                          className="w-full bg-slate-800 border border-slate-600 text-white rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-500">
                          <option value="rent">{isUrdu ? "کرایہ ایڈجسٹمنٹ" : "Rent Adjustment"}</option>
                          <option value="maintenance">{isUrdu ? "مینٹیننس ایڈجسٹمنٹ" : "Maintenance Adjustment"}</option>
                          <option value="electricity">{isUrdu ? "بجلی ایڈجسٹمنٹ" : "Electricity Adjustment"}</option>
                          <option value="gas">{isUrdu ? "گیس ایڈجسٹمنٹ" : "Gas Adjustment"}</option>
                          <option value="arrears">{isUrdu ? "سابقہ بقایا جات ایڈجسٹمنٹ" : "Previous Arrears Adjustment"}</option>
                          <option value="other">{isUrdu ? "دیگر چارجز" : "Other Charges"}</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-muted-foreground block mb-1">{isUrdu ? "رہائشی (اپارٹمنٹ)" : "Resident (Apartment)"}</label>
                        <select value={adjAptNo} onChange={e => {
                          setAdjAptNo(e.target.value);
                          const selectedRes = (residents || []).find(r => r.apartment_no === e.target.value);
                          if (selectedRes) {
                            setAdjOrigAmt(Number(selectedRes.outstanding_balance || 0));
                          }
                        }}
                          className="w-full bg-slate-800 border border-slate-600 text-white rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-500">
                          <option value="">{isUrdu ? "فلیٹ منتخب کریں" : "Select Apartment"}</option>
                          {(residents || []).filter(r => r.apartment_no).map(r => (
                            <option key={r.id} value={r.apartment_no}>{r.apartment_no} - {r.full_name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-muted-foreground block mb-1">{isUrdu ? "موجودہ بقایا (PKR)" : "Current Balance (PKR)"}</label>
                        <input type="number" value={adjOrigAmt} disabled
                          className="w-full bg-slate-800/50 border border-slate-700 text-slate-400 rounded px-2 py-1.5 cursor-not-allowed focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-muted-foreground block mb-1">{isUrdu ? "ایڈجسٹمنٹ رقم (+/-)" : "Adjustment Amount (+/-)"}</label>
                        <input type="number" value={adjAmt} onChange={e => setAdjAmt(Number(e.target.value))}
                          placeholder={isUrdu ? "منفی = کٹوتی" : "Negative = deduction"}
                          className="w-full bg-slate-800 border border-slate-600 text-orange-400 font-bold rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-muted-foreground block mb-1">{isUrdu ? "ایڈجسٹمنٹ کی تاریخ" : "Adjustment Date"}</label>
                        <input type="date" value={adjDate} onChange={e => setAdjDate(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-600 text-white rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-500" />
                      </div>
                      <div>
                        <label className="text-muted-foreground block mb-1">{isUrdu ? "ثبوت / فائل (اختیاری)" : "Attachment (Optional)"}</label>
                        <input type="file" onChange={e => setAdjFile(e.target.files?.[0] || null)} accept=".pdf,.jpg,.jpeg,.png"
                          className="w-full bg-slate-800 border border-slate-600 text-slate-300 text-[10px] rounded px-2 py-1 focus:outline-none file:bg-slate-700 file:border-none file:text-white file:px-2 file:py-0.5 file:rounded file:cursor-pointer" />
                        {adjFile && <span className="text-[9px] text-orange-400 mt-1 block">{(adjFile.size / 1024 / 1024).toFixed(2)} MB</span>}
                      </div>
                    </div>
                    <div>
                      <label className="text-muted-foreground block mb-1">{isUrdu ? "وجہ / تفصیل" : "Reason / Narration"} <span className="text-red-400">*</span></label>
                      <textarea value={adjReason} onChange={e => setAdjReason(e.target.value)}
                        rows={3} placeholder={isUrdu ? "ایڈجسٹمنٹ کی تفصیلی وجہ لکھیں..." : "Reason for this adjustment (required for audit trail)..."}
                        className="w-full bg-slate-800 border border-slate-600 text-white rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none" />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setAdjModalOpen(false)} className="text-[11px] border border-slate-600 text-slate-300 px-3 py-1.5 rounded hover:bg-slate-700 transition">
                        {isUrdu ? "منسوخ" : "Cancel"}
                      </button>
                      <button onClick={handleCreateAdjustment} disabled={adjSaving} className="text-[11px] bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-black px-4 py-1.5 rounded transition">
                        {adjSaving ? (isUrdu ? '⏳ محفوظ ہو رہا ہے...' : '⏳ Saving...') : (isUrdu ? '📝 ایڈجسٹمنٹ پوسٹ کریں' : '📝 Post Adjustment Voucher')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 space-y-4">

              {/* STEP 1: PER-APARTMENT CHARGES SETUP */}
              {utilActiveStep === 1 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-amber-400">Per-Apartment Monthly Charges — {utilBillingMonth}</h3>
                    <button
                      onClick={handleUtilSaveSetup}
                      disabled={utilSavingSetup || utilMonthLocked}
                      className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-black text-[10px] px-3 py-1.5 rounded transition"
                    >{utilSavingSetup ? 'Saving...' : utilMonthLocked ? '🔒 Locked' : '💾 Save All Charges'}</button>
                  </div>
                  {utilMonthLocked && (
                    <div className="bg-red-950/20 border border-red-800/50 rounded-xl p-3 text-[10px] text-red-200/80">
                      🔒 This month is finalized and locked. Direct edits are disabled. To adjust billing, please use the <strong>Adjustment Voucher</strong> button above.
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-[10px] border-collapse border border-border/40">
                      <thead className="bg-muted/40">
                        <tr className="text-[9px] font-black uppercase text-muted-foreground">
                          <th className="p-2 border border-border/30 text-left">APT</th>
                          <th className="p-2 border border-border/30 text-left">RESIDENT</th>
                          <th className="p-2 border border-border/30 text-right text-blue-400">RENT (PKR)</th>
                          <th className="p-2 border border-border/30 text-right text-cyan-400">MAINTENANCE (PKR)</th>
                          <th className="p-2 border border-border/30 text-right text-orange-400">GAS FIXED (PKR)</th>
                          <th className="p-2 border border-border/30 text-right text-rose-400">PREV ARREARS (PKR)</th>
                          <th className="p-2 border border-border/30 text-right text-yellow-400">ELEC (auto)</th>
                          <th className="p-2 border border-border/30 text-right font-black text-white">TOTAL PAYABLE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {utilAptLoading ? (
                          <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">🔄 Loading...</td></tr>
                        ) : utilAptRows.length === 0 ? (
                          <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No resident apartments found.</td></tr>
                        ) : utilAptRows.map(r => {
                          const total = r.rent + r.maintenance + r.gas + r.electricity + r.previous_arrears;
                          return (
                            <tr key={r.id} className="hover:bg-muted/10 border-b border-border/30">
                              <td className="p-2 border border-border/20 font-black text-amber-500">{r.apartment_no}</td>
                              <td className="p-2 border border-border/20 text-foreground">{r.full_name}</td>
                              <td className="p-2 border border-border/20 text-right text-blue-400 font-bold font-mono">PKR {Number(r.rent).toLocaleString()}</td>
                              <td className="p-2 border border-border/20 text-right text-cyan-400 font-bold font-mono">PKR {Number(r.maintenance).toLocaleString()}</td>
                              <td className="p-2 border border-border/20 text-right text-orange-400 font-bold font-mono">PKR {Number(r.gas).toLocaleString()}</td>
                              <td className="p-2 border border-border/20 text-right text-rose-400 font-bold font-mono">PKR {Number(r.previous_arrears).toLocaleString()}</td>
                              <td className="p-2 border border-border/20 text-right text-yellow-400 font-mono">{Number(r.electricity).toLocaleString()}</td>
                              <td className="p-2 border border-border/20 text-right font-black text-white font-mono">PKR {Math.round(total).toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {utilAptRows.length > 0 && (
                        <tfoot className="bg-muted/30">
                          <tr className="font-black text-[10px]">
                            <td colSpan={2} className="p-2 border border-border/30 text-muted-foreground uppercase">TOTALS</td>
                            <td className="p-2 border border-border/30 text-right text-blue-400">PKR {utilAptRows.reduce((s,r)=>s+r.rent,0).toLocaleString()}</td>
                            <td className="p-2 border border-border/30 text-right text-cyan-400">PKR {utilAptRows.reduce((s,r)=>s+r.maintenance,0).toLocaleString()}</td>
                            <td className="p-2 border border-border/30 text-right text-orange-400">PKR {utilAptRows.reduce((s,r)=>s+r.gas,0).toLocaleString()}</td>
                            <td className="p-2 border border-border/30 text-right text-rose-400">PKR {utilAptRows.reduce((s,r)=>s+r.previous_arrears,0).toLocaleString()}</td>
                            <td className="p-2 border border-border/30 text-right text-yellow-400">PKR {utilAptRows.reduce((s,r)=>s+r.electricity,0).toLocaleString()}</td>
                            <td className="p-2 border border-border/30 text-right text-white">PKR {utilAptRows.reduce((s,r)=>s+r.rent+r.maintenance+r.gas+r.electricity+r.previous_arrears,0).toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={() => setUtilActiveStep(2)} className="bg-amber-500 hover:bg-amber-600 text-black font-black text-xs px-4 py-2 rounded transition">Next: Electricity Recovery →</button>
                  </div>
                </div>
              )}

              {/* STEP 2: ELECTRICITY RECOVERY */}
              {utilActiveStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-yellow-400 flex items-center gap-2"><Zap className="h-4 w-4" /> Electricity Recovery — {utilBillingMonth}</h3>

                  {/* OPENING BALANCE EXPLANATION BANNER */}
                  <div className="bg-yellow-950/30 border border-yellow-700/50 rounded-xl p-3 flex gap-3 items-start">
                    <div className="text-yellow-400 text-lg">⚡</div>
                    <div className="text-[10px] text-yellow-200/80 leading-relaxed">
                      <strong className="text-yellow-400 text-xs block mb-0.5">Opening Balance = Govt Electricity Bill</strong>
                      Society ko WAPDA/LESCO se jo bill aaya — woh <em>Opening Balance</em> hai. Is amount ko residents se recover karna hai.
                      <br/><span className="text-yellow-400/70">Formula: Govt Bill ÷ Total Units = Rate/Unit → Har apartment ke units × Rate = Apartment charge</span>
                    </div>
                  </div>

                  {/* Govt Bill Entry */}
                  <div className="bg-yellow-950/20 border border-yellow-800/40 rounded-xl p-4">
                    <h4 className="text-[10px] font-black text-yellow-400 uppercase mb-3">Opening Balance — Govt Electricity Bill Entry</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="text-muted-foreground block mb-1">Opening Balance / Govt Bill (PKR) <span className="text-yellow-500">★</span></label>
                        <input type="number" value={utilElecGovtBill} onChange={e => setUtilElecGovtBill(Number(e.target.value))}
                          disabled={utilMonthLocked}
                          className={`w-full bg-background border border-yellow-700/50 rounded px-2 py-1.5 text-yellow-400 font-bold focus:outline-none focus:ring-1 focus:ring-yellow-500 ${utilMonthLocked ? 'opacity-40 cursor-not-allowed' : ''}`} />
                        <div className="text-[9px] text-yellow-600 mt-0.5">Total society electricity cost</div>
                      </div>
                      <div>
                        <label className="text-muted-foreground block mb-1">Total Govt Units (kWh) <span className="text-yellow-500">★</span></label>
                        <input type="number" value={utilElecGovtUnits} onChange={e => setUtilElecGovtUnits(Number(e.target.value))}
                          disabled={utilMonthLocked}
                          className={`w-full bg-background border border-yellow-700/50 rounded px-2 py-1.5 text-yellow-400 font-bold focus:outline-none focus:ring-1 focus:ring-yellow-500 ${utilMonthLocked ? 'opacity-40 cursor-not-allowed' : ''}`} />
                        <div className="text-[9px] text-yellow-600 mt-0.5">From WAPDA/LESCO bill</div>
                      </div>
                      <div className="flex flex-col justify-end">
                        <label className="text-muted-foreground block mb-1">Rate Per Unit (Auto-Calculated)</label>
                        <div className="bg-yellow-900/30 border border-yellow-700/30 rounded px-2 py-1.5 text-yellow-300 font-black font-mono">
                          PKR {utilElecCostPerUnit.toFixed(4)}
                        </div>
                        <div className="text-[9px] text-yellow-600 mt-0.5">{utilElecGovtBill.toLocaleString()} ÷ {utilElecGovtUnits.toLocaleString()} units</div>
                      </div>
                      <div className="flex flex-col justify-end">
                        <label className="text-muted-foreground block mb-1">Apartments to Bill</label>
                        <div className="bg-muted/30 border border-border/40 rounded px-2 py-1.5 text-foreground font-bold">{utilElecReadings.length} units</div>
                      </div>
                    </div>
                  </div>

                  {/* CALCULATION FLOW DIAGRAM */}
                  {utilElecGovtBill > 0 && utilElecGovtUnits > 0 && (
                    <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3">
                      <div className="text-[9px] font-black text-slate-400 uppercase mb-2">📐 Transparent Calculation Flow</div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        <div className="bg-yellow-900/40 border border-yellow-700/40 rounded px-2 py-1 text-yellow-300 font-mono">
                          Opening Balance<br/><span className="font-black text-yellow-400">PKR {Number(utilElecGovtBill).toLocaleString()}</span>
                        </div>
                        <div className="text-slate-500 font-black">÷</div>
                        <div className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-300 font-mono">
                          Govt Units<br/><span className="font-black text-white">{Number(utilElecGovtUnits).toLocaleString()} kWh</span>
                        </div>
                        <div className="text-slate-500 font-black">=</div>
                        <div className="bg-amber-900/40 border border-amber-700/40 rounded px-2 py-1 text-amber-300 font-mono">
                          Rate/Unit<br/><span className="font-black text-amber-400">PKR {utilElecCostPerUnit.toFixed(4)}</span>
                        </div>
                        <div className="text-slate-500 font-black">×</div>
                        <div className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-300">
                          Each Apt Units<br/><span className="font-black text-white">(see table)</span>
                        </div>
                        <div className="text-slate-500 font-black">=</div>
                        <div className="bg-green-900/40 border border-green-700/40 rounded px-2 py-1 text-green-300 font-mono">
                          Apt Charge<br/><span className="font-black text-green-400">Auto-calculated</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Meter Reading Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-[10px] border-collapse border border-border/40">
                      <thead className="bg-yellow-950/30">
                        <tr className="text-[9px] font-black uppercase text-yellow-400">
                          <th className="p-2 border border-border/30 text-left">APT</th>
                          <th className="p-2 border border-border/30 text-right">PREV READING</th>
                          <th className="p-2 border border-border/30 text-right">CURR READING</th>
                          <th className="p-2 border border-border/30 text-right">UNITS CONSUMED</th>
                          <th className="p-2 border border-border/30 text-right">COST/UNIT</th>
                          <th className="p-2 border border-border/30 text-right">AMOUNT (PKR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {utilElecReadings.map(r => (
                          <tr key={r.apartment_no} className="hover:bg-muted/10 border-b border-border/20">
                            <td className="p-2 border border-border/20 font-black text-amber-500">{r.apartment_no}</td>
                            <td className="p-2 border border-border/20 text-right font-mono text-muted-foreground">{Number(r.prev_reading).toLocaleString()}</td>
                            <td className="p-2 border border-border/20 text-right font-mono text-yellow-400 font-bold">{Number(r.curr_reading).toLocaleString()}</td>
                            <td className="p-2 border border-border/20 text-right font-mono text-foreground">{r.units_consumed}</td>
                            <td className="p-2 border border-border/20 text-right font-mono text-muted-foreground">{utilElecCostPerUnit.toFixed(4)}</td>
                            <td className="p-2 border border-border/20 text-right font-black font-mono text-yellow-400">PKR {Math.round(r.calculated_amount).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                      {utilElecReadings.length > 0 && (
                        <tfoot className="bg-muted/30">
                          <tr>
                            <td colSpan={3} className="p-2 border border-border/30 text-[9px] uppercase font-black text-muted-foreground">TOTALS</td>
                            <td className="p-2 border border-border/30 text-right font-black">{utilElecReadings.reduce((s,r)=>s+r.units_consumed,0)} units</td>
                            <td className="p-2 border border-border/30"></td>
                            <td className="p-2 border border-border/30 text-right font-black text-yellow-400">PKR {Math.round(utilElecTotalCollected).toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>

                  {/* Opening Balance Recovery Summary */}
                  <div className={`rounded-xl border p-4 ${ utilElecDiff < 0 ? 'bg-red-950/30 border-red-800/50' : utilElecDiff > 0 ? 'bg-emerald-950/30 border-emerald-800/50' : 'bg-muted/30 border-border/40'}`}>
                    <h4 className="text-[10px] font-black uppercase mb-3 text-muted-foreground">⚡ Opening Balance Recovery Summary</h4>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="text-center">
                        <div className="text-[9px] text-muted-foreground mb-1">Opening Balance (Govt Bill)</div>
                        <div className="font-black text-white font-mono text-sm">PKR {Number(utilElecGovtBill).toLocaleString()}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">Amount society owes WAPDA</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[9px] text-muted-foreground mb-1">Total Wasool from Residents</div>
                        <div className="font-black text-yellow-400 font-mono text-sm">PKR {Math.round(utilElecTotalCollected).toLocaleString()}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">{utilElecReadings.length} apartments billed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[9px] text-muted-foreground mb-1">Net Difference</div>
                        <div className={`font-black font-mono text-sm ${ utilElecDiff < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {utilElecDiff >= 0 ? '+' : ''}{Math.round(utilElecDiff).toLocaleString()}
                          <span className="block text-[9px] mt-0.5">{utilElecDiff < 0 ? '⚠️ LOSS — Shortfall in recovery' : utilElecDiff > 0 ? '✅ SURPLUS — Extra collected' : '✅ BREAK EVEN'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-between">
                    <button onClick={() => setUtilActiveStep(1)} className="text-xs border border-border/60 text-muted-foreground px-3 py-1.5 rounded hover:bg-muted/40 transition">← Back</button>
                    <div className="flex gap-2">
                      <button onClick={handleSaveElecRecovery} disabled={utilElecSaving || utilMonthLocked}
                        className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black font-black text-xs px-4 py-2 rounded transition">
                        {utilElecSaving ? '⏳ Saving...' : utilMonthLocked ? '🔒 Locked' : '💾 Save Electricity Recovery'}
                      </button>
                      <button onClick={() => setUtilActiveStep(3)} className="bg-amber-500 hover:bg-amber-600 text-black font-black text-xs px-4 py-2 rounded transition">Next: Gas Recovery →</button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: GAS RECOVERY */}
              {utilActiveStep === 3 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-orange-400">🔥 Gas Recovery — {utilBillingMonth}</h3>

                  {/* Method Selector */}
                  <div className="flex gap-3">
                    <button onClick={() => setUtilGasMethod('fixed')} className={`text-xs px-4 py-2 rounded font-bold transition border ${ utilGasMethod === 'fixed' ? 'bg-orange-500 text-black border-orange-500' : 'border-border/60 text-muted-foreground hover:bg-muted/40'}`}>
                      Method 1: Fixed Monthly Rate (Recommended)
                    </button>
                    <button onClick={() => setUtilGasMethod('meter')} className={`text-xs px-4 py-2 rounded font-bold transition border ${ utilGasMethod === 'meter' ? 'bg-orange-500 text-black border-orange-500' : 'border-border/60 text-muted-foreground hover:bg-muted/40'}`}>
                      Method 2: Meter-Based Recovery
                    </button>
                  </div>

                  {/* Fixed Method */}
                  {utilGasMethod === 'fixed' && (
                    <div className="bg-orange-950/20 border border-orange-800/40 rounded-xl p-4 space-y-3">
                      <h4 className="text-[10px] font-black text-orange-400 uppercase">Fixed Monthly Gas Charge</h4>
                      <div className="flex items-end gap-4">
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-1">Fixed Amount Per Apartment (PKR)</label>
                          <input type="number" value={utilGasFixedAmt} onChange={e => setUtilGasFixedAmt(Number(e.target.value))}
                            disabled={utilMonthLocked}
                            className={`bg-background border border-orange-700/50 rounded px-3 py-1.5 text-orange-400 font-bold text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 w-40 ${utilMonthLocked ? 'opacity-40 cursor-not-allowed' : ''}`} />
                        </div>
                        <div className="text-xs">
                          <div className="text-muted-foreground">Total Apartments: <span className="text-foreground font-bold">{utilAptRows.length}</span></div>
                          <div className="text-muted-foreground">Total Gas Collection: <span className="text-orange-400 font-black">PKR {(utilGasFixedAmt * utilAptRows.length).toLocaleString()}</span></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Meter Method */}
                  {utilGasMethod === 'meter' && (
                    <div className="space-y-3">
                      <div className="bg-orange-950/20 border border-orange-800/40 rounded-xl p-4">
                        <h4 className="text-[10px] font-black text-orange-400 uppercase mb-3">Government Gas Bill Entry</h4>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <label className="text-muted-foreground block mb-1">Govt Gas Bill (PKR)</label>
                            <input type="number" value={utilGasGovtBill} onChange={e => setUtilGasGovtBill(Number(e.target.value))}
                              disabled={utilMonthLocked}
                              className={`w-full bg-background border border-orange-700/50 rounded px-2 py-1.5 text-orange-400 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 ${utilMonthLocked ? 'opacity-40 cursor-not-allowed' : ''}`} />
                          </div>
                          <div>
                            <label className="text-muted-foreground block mb-1">Total Govt Units (m³)</label>
                            <input type="number" value={utilGasGovtUnits} onChange={e => setUtilGasGovtUnits(Number(e.target.value))}
                              disabled={utilMonthLocked}
                              className={`w-full bg-background border border-orange-700/50 rounded px-2 py-1.5 text-orange-400 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 ${utilMonthLocked ? 'opacity-40 cursor-not-allowed' : ''}`} />
                          </div>
                          <div>
                            <label className="text-muted-foreground block mb-1">Cost Per Unit (Auto)</label>
                            <div className="bg-orange-900/30 border border-orange-700/30 rounded px-2 py-1.5 text-orange-300 font-black font-mono">
                              PKR {utilGasCostPerUnit.toFixed(4)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-[10px] border-collapse border border-border/40">
                          <thead className="bg-orange-950/30">
                            <tr className="text-[9px] font-black uppercase text-orange-400">
                              <th className="p-2 border border-border/30 text-left">APT</th>
                              <th className="p-2 border border-border/30 text-right">PREV READING</th>
                              <th className="p-2 border border-border/30 text-right">CURR READING</th>
                              <th className="p-2 border border-border/30 text-right">UNITS</th>
                              <th className="p-2 border border-border/30 text-right">AMOUNT (PKR)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {utilGasReadings.map(r => (
                              <tr key={r.apartment_no} className="hover:bg-muted/10">
                                <td className="p-2 border border-border/20 font-black text-amber-500">{r.apartment_no}</td>
                                <td className="p-2 border border-border/20 text-right font-mono text-muted-foreground">{Number(r.prev_reading).toLocaleString()}</td>
                                <td className="p-2 border border-border/20 text-right font-mono text-orange-400 font-bold">{Number(r.curr_reading).toLocaleString()}</td>
                                <td className="p-2 border border-border/20 text-right font-mono">{r.units_consumed}</td>
                                <td className="p-2 border border-border/20 text-right font-black font-mono text-orange-400">PKR {Math.round(r.calculated_amount).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Gas Opening Balance Summary */}
                  {utilGasGovtBill > 0 && (
                    <div className={`rounded-xl border p-4 ${ utilGasDiff < 0 ? 'bg-red-950/30 border-red-800/50' : utilGasDiff > 0 ? 'bg-emerald-950/30 border-emerald-800/50' : 'bg-muted/30 border-border/40'}`}>
                      <h4 className="text-[10px] font-black uppercase mb-3 text-muted-foreground">🔥 Gas Opening Balance Recovery Summary</h4>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div className="text-center">
                          <div className="text-[9px] text-muted-foreground mb-1">Opening Balance (Govt Gas Bill)</div>
                          <div className="font-black text-white font-mono text-sm">PKR {Number(utilGasGovtBill).toLocaleString()}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[9px] text-muted-foreground mb-1">Total Wasool from Residents</div>
                          <div className="font-black text-orange-400 font-mono text-sm">PKR {Math.round(utilGasEffective).toLocaleString()}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[9px] text-muted-foreground mb-1">Net Difference</div>
                          <div className={`font-black font-mono text-sm ${ utilGasDiff < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {utilGasDiff >= 0 ? '+' : ''}{Math.round(utilGasDiff).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 justify-between">
                    <button onClick={() => setUtilActiveStep(2)} className="text-xs border border-border/60 text-muted-foreground px-3 py-1.5 rounded hover:bg-muted/40 transition">← Back</button>
                    <div className="flex gap-2">
                      <button onClick={handleSaveGasRecovery} disabled={utilGasSaving || utilMonthLocked}
                        className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-black font-black text-xs px-4 py-2 rounded transition">
                        {utilGasSaving ? '⏳ Saving...' : utilMonthLocked ? '🔒 Locked' : '💾 Save Gas Recovery'}
                      </button>
                      <button onClick={() => setUtilActiveStep(4)} className="bg-amber-500 hover:bg-amber-600 text-black font-black text-xs px-4 py-2 rounded transition">View Invoice Preview →</button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: INVOICE PREVIEW */}
              {utilActiveStep === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-amber-400">Monthly Invoice Preview — {utilBillingMonth}</h3>
                    <button
                      onClick={handleFinalizeMonth}
                      disabled={utilFinalizing || utilMonthLocked}
                      className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-black text-xs px-4 py-2 rounded transition"
                    >{utilFinalizing ? '⏳ Finalizing...' : utilMonthLocked ? '🔒 Locked' : '🚀 FINALIZE & LOCK MONTH'}</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {utilAptRows.map(r => {
                      const total = r.rent + r.maintenance + r.gas + r.electricity + r.previous_arrears;
                      const received = Number(r.payment_received || 0);
                      const remaining = Math.max(0, total - received);
                      return (
                        <div key={r.id} className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-md">
                          <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-3 py-2 border-b border-slate-700">
                            <div className="flex justify-between items-center">
                              <span className="font-black text-amber-400 text-xs">{r.apartment_no}</span>
                              <span className="text-[9px] text-slate-400 font-bold">{r.full_name}</span>
                            </div>
                          </div>
                          <div className="p-3 space-y-1.5 text-[10px]">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Rent</span>
                              <span className="text-blue-400 font-mono">PKR {Number(r.rent).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Maintenance</span>
                              <span className="text-cyan-400 font-mono">PKR {Number(r.maintenance).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Sui Gas</span>
                              <span className="text-orange-400 font-mono">PKR {Number(r.gas).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Electricity</span>
                              <span className="text-yellow-400 font-mono">PKR {Number(r.electricity).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Previous Arrears</span>
                              <span className={`font-mono ${r.previous_arrears > 0 ? 'text-rose-400' : 'text-slate-500'}`}>PKR {Number(r.previous_arrears).toLocaleString()}</span>
                            </div>
                            <div className="border-t border-slate-800 pt-1 flex justify-between">
                              <span className="font-black text-white uppercase text-[9px]">TOTAL PAYABLE</span>
                              <span className="font-black text-amber-400 font-mono text-xs">PKR {Math.round(total).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Payment Received</span>
                              <span className="text-emerald-400 font-mono">PKR {received.toLocaleString()}</span>
                            </div>
                            <div className="border-t border-dashed border-slate-800 pt-1 flex justify-between">
                              <span className="font-black text-muted-foreground uppercase text-[8px]">Balance Remaining</span>
                              <span className={`font-black font-mono text-xs ${remaining > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>PKR {Math.round(remaining).toLocaleString()}</span>
                            </div>
                            <div className="border-t border-slate-800/60 pt-2 mt-1 flex gap-1.5">
                              <button
                                onClick={() => handlePrintInvoiceStep4(r)}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white py-1 rounded text-[9px] font-black uppercase tracking-wider transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Printer className="h-2.5 w-2.5" /> Print Bill
                              </button>
                              <button
                                onClick={() => handleWhatsAppInvoiceStep4(r)}
                                className="flex-1 bg-[#25D366] hover:bg-[#20ba5a] text-white py-1 rounded text-[9px] font-black uppercase tracking-wider transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <MessageSquare className="h-2.5 w-2.5" /> WhatsApp
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Double-Entry Ledger Preview before Finalization */}
                  <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-4 shadow-md space-y-3">
                    <h4 className="text-xs font-black text-amber-400 uppercase flex items-center gap-2">
                      📖 Double-Entry Ledger Posting Preview (Before Finalization)
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      The following general ledger journal entries will be posted automatically to resident ledgers and society expenses upon finalization:
                    </p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-[10px] font-mono border-collapse border border-border/40">
                        <thead className="bg-slate-950/40">
                          <tr className="text-[9px] font-black uppercase text-slate-400">
                            <th className="p-2 border border-border/30 text-left">Account Description</th>
                            <th className="p-2 border border-border/30 text-left">Type</th>
                            <th className="p-2 border border-border/30 text-right text-emerald-400 font-bold">Debit (Dr.)</th>
                            <th className="p-2 border border-border/30 text-right text-rose-400 font-bold">Credit (Cr.)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {utilElecGovtBill > 0 && (
                            <tr className="border-b border-border/20">
                              <td className="p-2 border border-border/20 font-bold text-white">⚡ WAPDA Electricity Expense (Govt Bill)</td>
                              <td className="p-2 border border-border/20 text-blue-400 font-bold">Expense (Dr)</td>
                              <td className="p-2 border border-border/20 text-right text-emerald-400 font-bold font-mono">PKR {Number(utilElecGovtBill).toLocaleString()}</td>
                              <td className="p-2 border border-border/20 text-right font-mono text-slate-600">-</td>
                            </tr>
                          )}
                          {utilGasGovtBill > 0 && (
                            <tr className="border-b border-border/20">
                              <td className="p-2 border border-border/20 font-bold text-white">🔥 Sui Gas Expense (Govt Bill)</td>
                              <td className="p-2 border border-border/20 text-blue-400 font-bold">Expense (Dr)</td>
                              <td className="p-2 border border-border/20 text-right text-emerald-400 font-bold font-mono">PKR {Number(utilGasGovtBill).toLocaleString()}</td>
                              <td className="p-2 border border-border/20 text-right font-mono text-slate-600">-</td>
                            </tr>
                          )}
                          {utilElecTotalCollected > 0 && (
                            <tr className="border-b border-border/20">
                              <td className="p-2 border border-border/20 pl-6 text-slate-300">↳ Resident Utility Recovery (Electricity)</td>
                              <td className="p-2 border border-border/20 text-amber-500 font-bold">Recovery (Cr)</td>
                              <td className="p-2 border border-border/20 text-right font-mono text-slate-600">-</td>
                              <td className="p-2 border border-border/20 text-right text-rose-400 font-bold font-mono">PKR {Math.round(utilElecTotalCollected).toLocaleString()}</td>
                            </tr>
                          )}
                          {utilGasEffective > 0 && (
                            <tr className="border-b border-border/20">
                              <td className="p-2 border border-border/20 pl-6 text-slate-300">↳ Resident Utility Recovery (Gas)</td>
                              <td className="p-2 border border-border/20 text-amber-500 font-bold">Recovery (Cr)</td>
                              <td className="p-2 border border-border/20 text-right font-mono text-slate-600">-</td>
                              <td className="p-2 border border-border/20 text-right text-rose-400 font-bold font-mono">PKR {Math.round(utilGasEffective).toLocaleString()}</td>
                            </tr>
                          )}
                          {utilAptRows.length > 0 && (
                            <tr className="border-b border-border/20 bg-slate-900/40">
                              <td className="p-2 border border-border/20 font-bold text-amber-400">💰 Resident Accounts Receivable (Billed Total)</td>
                              <td className="p-2 border border-border/20 text-amber-400 font-bold">Asset (Dr)</td>
                              <td className="p-2 border border-border/20 text-right text-emerald-400 font-bold font-mono">PKR {Math.round(utilAptRows.reduce((s,r) => s + r.rent + r.maintenance + r.gas + r.electricity + r.previous_arrears, 0)).toLocaleString()}</td>
                              <td className="p-2 border border-border/20 text-right font-mono text-slate-600">-</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Enhanced Finance Dashboard Summary with 10 cards */}
                  <div className="bg-muted/20 border border-border/40 rounded-xl p-4">
                    <h4 className="text-xs font-black text-amber-400 mb-3">📊 Finance Dashboard — Society Recovery & Utilities</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-[10px]">
                      <div className="bg-background border border-yellow-800/30 rounded-lg p-2.5">
                        <div className="text-slate-500 text-[8px] uppercase tracking-wider mb-1">⚡ Elec Opening</div>
                        <div className="font-black text-white font-mono text-xs">PKR {Number(utilElecGovtBill).toLocaleString()}</div>
                      </div>
                      <div className="bg-background border border-yellow-800/30 rounded-lg p-2.5">
                        <div className="text-slate-500 text-[8px] uppercase tracking-wider mb-1">⚡ Elec Recovery</div>
                        <div className="font-black text-yellow-400 font-mono text-xs">PKR {Math.round(utilElecTotalCollected).toLocaleString()}</div>
                      </div>
                      <div className="bg-background border border-yellow-800/30 rounded-lg p-2.5">
                        <div className="text-slate-500 text-[8px] uppercase tracking-wider mb-1">⚡ Elec Outstanding</div>
                        <div className="font-black text-rose-400 font-mono text-xs">PKR {Math.round(Math.max(0, utilElecGovtBill - utilElecTotalCollected)).toLocaleString()}</div>
                      </div>
                      <div className={`border rounded-lg p-2.5 ${ utilElecDiff < 0 ? 'bg-red-950/20 border-red-800/30' : 'bg-emerald-950/20 border-emerald-800/30'}`}>
                        <div className="text-[8px] uppercase tracking-wider mb-1">{utilElecDiff < 0 ? '⚡ Elec Loss' : '⚡ Elec Profit'}</div>
                        <div className={`font-black font-mono text-xs ${ utilElecDiff < 0 ? 'text-red-400' : 'text-emerald-400'}`}>PKR {Math.abs(Math.round(utilElecDiff)).toLocaleString()}</div>
                      </div>
                      <div className="bg-background border border-orange-800/30 rounded-lg p-2.5">
                        <div className="text-slate-500 text-[8px] uppercase tracking-wider mb-1">🔥 Gas Opening</div>
                        <div className="font-black text-white font-mono text-xs">PKR {Number(utilGasGovtBill).toLocaleString()}</div>
                      </div>
                      <div className="bg-background border border-orange-800/30 rounded-lg p-2.5">
                        <div className="text-slate-500 text-[8px] uppercase tracking-wider mb-1">🔥 Gas Recovery</div>
                        <div className="font-black text-orange-400 font-mono text-xs">PKR {Math.round(utilGasEffective).toLocaleString()}</div>
                      </div>
                      <div className="bg-background border border-orange-800/30 rounded-lg p-2.5">
                        <div className="text-slate-500 text-[8px] uppercase tracking-wider mb-1">🔥 Gas Outstanding</div>
                        <div className="font-black text-rose-400 font-mono text-xs">PKR {Math.round(Math.max(0, utilGasGovtBill - utilGasEffective)).toLocaleString()}</div>
                      </div>
                      <div className={`border rounded-lg p-2.5 ${ utilGasDiff < 0 ? 'bg-red-950/20 border-red-800/30' : 'bg-emerald-950/20 border-emerald-800/30'}`}>
                        <div className="text-[8px] uppercase tracking-wider mb-1">{utilGasDiff < 0 ? '🔥 Gas Loss' : '🔥 Gas Profit'}</div>
                        <div className={`font-black font-mono text-xs ${ utilGasDiff < 0 ? 'text-red-400' : 'text-emerald-400'}`}>PKR {Math.abs(Math.round(utilGasDiff)).toLocaleString()}</div>
                      </div>
                      <div className="bg-background border border-emerald-800/30 rounded-lg p-2.5">
                        <div className="text-slate-500 text-[8px] uppercase tracking-wider mb-1">💰 Society Total Recovery</div>
                        <div className="font-black text-emerald-400 font-mono text-xs">PKR {Math.round(utilElecTotalCollected + utilGasEffective + utilAptRows.reduce((s,r)=>s+r.rent+r.maintenance, 0)).toLocaleString()}</div>
                      </div>
                      <div className="bg-background border border-rose-800/30 rounded-lg p-2.5">
                        <div className="text-slate-500 text-[8px] uppercase tracking-wider mb-1">⚠️ Outstanding Arrears</div>
                        <div className="font-black text-rose-400 font-mono text-xs">PKR {utilAptRows.reduce((s,r)=>s+Math.max(0,r.previous_arrears),0).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  <button onClick={() => setUtilActiveStep(3)} className="text-xs border border-border/60 text-muted-foreground px-3 py-1.5 rounded hover:bg-muted/40 transition">← Back to Gas</button>
                </div>
              )}

              {/* STEP 5: HISTORY & REPORTS */}
              {utilActiveStep === 5 && (
                <div className="space-y-4">
                  {/* Step 5 Sub Tab Nav */}
                  <div className="flex gap-2 border-b border-border/40 pb-2">
                    {[{id:'history',label:'Collection History'},{id:'ledger',label:'Utility Ledger'},{id:'audit',label:'Audit Trail & Adjustments'}].map(t => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setHistSubTab(t.id as any);
                          if (t.id === 'ledger') loadUtilLedger();
                          if (t.id === 'audit') loadAuditLog();
                        }}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded transition ${
                          histSubTab === t.id ? 'bg-amber-500 text-black' : 'text-muted-foreground hover:bg-muted/40'
                        }`}
                      >{t.label}</button>
                    ))}
                  </div>

                  {/* HISTORY SUB-TAB */}
                  {histSubTab === 'history' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black text-amber-400">Utility Recovery History & Reports</h3>
                        <button onClick={loadUtilHistory} className="text-xs border border-border/60 text-muted-foreground px-3 py-1.5 rounded hover:bg-muted/40 transition"><RefreshCw className="h-3 w-3 inline mr-1" />Refresh</button>
                      </div>

                      {/* Current month report actions */}
                      <div className="bg-muted/20 border border-border/40 rounded-xl p-4">
                        <h4 className="text-[10px] font-black text-amber-400 mb-3">Current Month: {utilBillingMonth}</h4>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => exportUtilReportPDF(utilBillingMonth)}
                            className="bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold px-3 py-1.5 rounded transition flex items-center gap-1">
                            <Download className="h-3 w-3" /> PDF Report
                          </button>
                          <button onClick={() => exportUtilReportCSV(utilBillingMonth)}
                            className="bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold px-3 py-1.5 rounded transition flex items-center gap-1">
                            <FileSpreadsheet className="h-3 w-3" /> CSV Export
                          </button>
                        </div>
                      </div>

                      {/* Collections History Table */}
                      <div className="overflow-x-auto">
                        <h4 className="text-[10px] font-black text-muted-foreground uppercase mb-2">All Months — Utility Collection History</h4>
                        <table className="min-w-full text-[10px] border-collapse border border-border/40">
                          <thead className="bg-muted/40">
                            <tr className="text-[9px] font-black uppercase text-muted-foreground">
                              <th className="p-2 border border-border/30 text-left">Month</th>
                              <th className="p-2 border border-border/30 text-left">Utility</th>
                              <th className="p-2 border border-border/30 text-right">Govt Bill</th>
                              <th className="p-2 border border-border/30 text-right">Collected</th>
                              <th className="p-2 border border-border/30 text-right">Difference</th>
                              <th className="p-2 border border-border/30 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {utilHistoryLoading ? (
                              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">🔄 Loading history...</td></tr>
                            ) : utilCollections.length === 0 ? (
                              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No history yet. Complete billing for a month first.</td></tr>
                            ) : utilCollections.map((c, i) => (
                              <tr key={i} className="hover:bg-muted/10 border-b border-border/20">
                                <td className="p-2 border border-border/20 font-bold text-amber-500">{c.billing_month}</td>
                                <td className="p-2 border border-border/20 capitalize">{c.utility_type}</td>
                                <td className="p-2 border border-border/20 text-right font-mono">PKR {Number(c.govt_bill).toLocaleString()}</td>
                                <td className="p-2 border border-border/20 text-right font-mono">PKR {Number(c.total_collected).toLocaleString()}</td>
                                <td className={`p-2 border border-border/20 text-right font-mono font-bold ${ Number(c.difference) < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                  {Number(c.difference) >= 0 ? '+' : ''}{Number(c.difference).toLocaleString()}
                                </td>
                                <td className="p-2 border border-border/20 text-center">
                                  <span className={`inline-block text-[9px] px-2 py-0.5 rounded font-black uppercase ${
                                    c.result_type === 'loss' ? 'bg-red-900/50 text-red-400' :
                                    c.result_type === 'profit' ? 'bg-emerald-900/50 text-emerald-400' :
                                    'bg-slate-700 text-slate-300'
                                  }`}>{c.result_type}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* LEDGER SUB-TAB */}
                  {histSubTab === 'ledger' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-amber-400">📖 Permanent Utility Ledger — {utilBillingMonth}</h4>
                      {utilLedger ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Electricity Ledger Box */}
                          <div className="bg-slate-900/40 border border-yellow-800/30 rounded-xl p-4 space-y-3">
                            <h5 className="font-black text-yellow-400 text-xs border-b border-yellow-800/20 pb-2">⚡ Electricity Ledger</h5>
                            <table className="min-w-full text-[11px] font-mono">
                              <tbody>
                                <tr className="border-b border-border/20 py-1.5"><td className="text-slate-400 py-1.5">Opening Balance (Govt Bill)</td><td className="text-right text-white font-bold">PKR {utilLedger.electricity?.opening?.toLocaleString()}</td></tr>
                                <tr className="border-b border-border/20 py-1.5"><td className="text-slate-400 py-1.5">Recoveries (Residents Wasool)</td><td className="text-right text-yellow-400 font-bold">- PKR {utilLedger.electricity?.collected?.toLocaleString()}</td></tr>
                                <tr className="border-b border-border/20 py-1.5"><td className="text-slate-400 py-1.5">Adjustments (Vouchers)</td><td className="text-right text-orange-400 font-bold">{utilLedger.electricity?.adjustments >= 0 ? '+' : ''} PKR {utilLedger.electricity?.adjustments?.toLocaleString()}</td></tr>
                                <tr className="border-b border-border/20 py-1.5"><td className="text-slate-400 py-1.5">Loss / Profit (Net Deficit)</td><td className={`text-right font-bold ${ (utilLedger.electricity?.opening - utilLedger.electricity?.collected) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>PKR {Math.round(utilLedger.electricity?.opening - utilLedger.electricity?.collected).toLocaleString()}</td></tr>
                                <tr className="pt-2"><td className="text-white font-black py-2">Closing Balance</td><td className="text-right text-emerald-400 font-black text-xs py-2">PKR {Math.round(utilLedger.electricity?.closing).toLocaleString()}</td></tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Gas Ledger Box */}
                          <div className="bg-slate-900/40 border border-orange-800/30 rounded-xl p-4 space-y-3">
                            <h5 className="font-black text-orange-400 text-xs border-b border-orange-800/20 pb-2">🔥 Gas Ledger</h5>
                            <table className="min-w-full text-[11px] font-mono">
                              <tbody>
                                <tr className="border-b border-border/20 py-1.5"><td className="text-slate-400 py-1.5">Opening Balance (Govt Bill)</td><td className="text-right text-white font-bold">PKR {utilLedger.gas?.opening?.toLocaleString()}</td></tr>
                                <tr className="border-b border-border/20 py-1.5"><td className="text-slate-400 py-1.5">Recoveries (Residents Wasool)</td><td className="text-right text-orange-400 font-bold">- PKR {utilLedger.gas?.collected?.toLocaleString()}</td></tr>
                                <tr className="border-b border-border/20 py-1.5"><td className="text-slate-400 py-1.5">Adjustments (Vouchers)</td><td className="text-right text-orange-400 font-bold">{utilLedger.gas?.adjustments >= 0 ? '+' : ''} PKR {utilLedger.gas?.adjustments?.toLocaleString()}</td></tr>
                                <tr className="border-b border-border/20 py-1.5"><td className="text-slate-400 py-1.5">Loss / Profit (Net Deficit)</td><td className={`text-right font-bold ${ (utilLedger.gas?.opening - utilLedger.gas?.collected) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>PKR {Math.round(utilLedger.gas?.opening - utilLedger.gas?.collected).toLocaleString()}</td></tr>
                                <tr className="pt-2"><td className="text-white font-black py-2">Closing Balance</td><td className="text-right text-emerald-400 font-black text-xs py-2">PKR {Math.round(utilLedger.gas?.closing).toLocaleString()}</td></tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-center py-6">🔄 Loading Ledger Details...</div>
                      )}
                    </div>
                  )}

                  {/* AUDIT TRAIL SUB-TAB */}
                  {histSubTab === 'audit' && (
                    <div className="space-y-4">
                      {/* Adjustment Vouchers Log */}
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-muted-foreground uppercase">📋 Adjustment Vouchers (Audited)</h4>
                        <div className="overflow-x-auto border border-border/40 rounded-xl">
                          <table className="min-w-full text-[10px] border-collapse">
                            <thead className="bg-muted/40">
                              <tr className="text-[9px] font-black uppercase text-muted-foreground">
                                <th className="p-2 border-b border-border/30 text-left">Voucher No</th>
                                <th className="p-2 border-b border-border/30 text-left">Utility</th>
                                <th className="p-2 border-b border-border/30 text-left">Apt</th>
                                <th className="p-2 border-b border-border/30 text-right">Original</th>
                                <th className="p-2 border-b border-border/30 text-right">Adjustment</th>
                                <th className="p-2 border-b border-border/30 text-right">Net</th>
                                <th className="p-2 border-b border-border/30 text-left">Reason</th>
                                <th className="p-2 border-b border-border/30 text-left">Created By</th>
                              </tr>
                            </thead>
                            <tbody>
                              {utilAdjVouchers.length === 0 ? (
                                <tr><td colSpan={8} className="p-4 text-center text-slate-500">No adjustments posted for this month.</td></tr>
                              ) : utilAdjVouchers.map((v, i) => (
                                <tr key={i} className="hover:bg-muted/10 border-b border-border/20 font-mono">
                                  <td className="p-2 text-orange-400 font-black">{v.voucher_no}</td>
                                  <td className="p-2 capitalize">{v.utility_type}</td>
                                  <td className="p-2">{v.apartment_no || '-'}</td>
                                  <td className="p-2 text-right">PKR {Number(v.original_amount).toLocaleString()}</td>
                                  <td className={`p-2 text-right font-bold ${v.adjustment_amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>PKR {v.adjustment_amount >= 0 ? '+' : ''}{Number(v.adjustment_amount).toLocaleString()}</td>
                                  <td className="p-2 text-right font-bold">PKR {Number(v.net_amount).toLocaleString()}</td>
                                  <td className="p-2 text-left font-sans max-w-xs truncate">{v.reason}</td>
                                  <td className="p-2 text-left font-sans">{v.created_by}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Audit Log Entries */}
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-muted-foreground uppercase">📜 Activity Audit Trail</h4>
                        <div className="overflow-x-auto border border-border/40 rounded-xl">
                          <table className="min-w-full text-[10px] border-collapse">
                            <thead className="bg-muted/40">
                              <tr className="text-[9px] font-black uppercase text-muted-foreground">
                                <th className="p-2 border-b border-border/30 text-left">Action</th>
                                <th className="p-2 border-b border-border/30 text-left">Details</th>
                                <th className="p-2 border-b border-border/30 text-left">Performed By</th>
                                <th className="p-2 border-b border-border/30 text-left">Timestamp</th>
                              </tr>
                            </thead>
                            <tbody>
                              {utilAuditLog.length === 0 ? (
                                <tr><td colSpan={4} className="p-4 text-center text-slate-500">No logs found.</td></tr>
                              ) : utilAuditLog.map((l, i) => (
                                <tr key={i} className="hover:bg-muted/10 border-b border-border/20 font-mono">
                                  <td className="p-2 text-amber-500 font-bold">{l.action}</td>
                                  <td className="p-2 text-left font-sans">{l.details}</td>
                                  <td className="p-2 text-left font-sans">{l.performed_by}</td>
                                  <td className="p-2 text-left">{new Date(l.created_at).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          </div>
        </TabsContent>

        {/* ====================================================
            TAB 2: TRANSACTION LEDGER (Resident Statements)
            ==================================================== */}
        <TabsContent value="ledgers" className="mt-4 space-y-6">
          <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-805 pb-4">
              <div>
                <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-blue-400" />
                  Universal Searchable Multi-Category Ledger
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">Explore Tenant, Apartment, and Parking ledgers with strict running balance calculation chains.</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setLedgerSubTab("tenant")}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition ${
                    ledgerSubTab === "tenant" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Tenant Ledgers
                </button>
                <button
                  onClick={() => setLedgerSubTab("apartment")}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition ${
                    ledgerSubTab === "apartment" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Apartment Ledgers
                </button>
                <button
                  onClick={() => setLedgerSubTab("general")}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition ${
                    ledgerSubTab === "general" ? "bg-amber-600 text-white shadow-[0_0_10px_rgba(217,119,6,0.4)]" : "text-amber-500/70 hover:text-amber-400"
                  }`}
                >
                  Master Ledger (All)
                </button>
                <button
                  onClick={() => setLedgerSubTab("staff")}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition ${
                    ledgerSubTab === "staff" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Staff Ledgers
                </button>
                <button
                  onClick={() => setLedgerSubTab("inventory")}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition ${
                    ledgerSubTab === "inventory" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Inventory Ledgers
                </button>
              </div>
            </div>

            {ledgerSubTab === "tenant" && (
              <div className="flex items-center gap-2 mt-2 bg-slate-900/50 p-1.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 font-bold uppercase ml-2 mr-2">Account View:</span>
                <button onClick={() => setLedgerTenantView("1200")} className={`text-[10px] font-bold px-3 py-1 rounded transition ${ledgerTenantView === "1200" ? "bg-amber-600/80 text-white" : "text-slate-400 hover:text-slate-200 bg-slate-950"}`}>Outstanding Ledger (1200)</button>
                <button onClick={() => setLedgerTenantView("2100")} className={`text-[10px] font-bold px-3 py-1 rounded transition ${ledgerTenantView === "2100" ? "bg-amber-600/80 text-white" : "text-slate-400 hover:text-slate-200 bg-slate-950"}`}>Security Deposit (2100)</button>
                <button onClick={() => setLedgerTenantView("combined")} className={`text-[10px] font-bold px-3 py-1 rounded transition ${ledgerTenantView === "combined" ? "bg-amber-600/80 text-white" : "text-slate-400 hover:text-slate-200 bg-slate-950"}`}>Combined Statement</button>
              </div>
            )}

            {/* Voucher Ledgers Sub-navigation */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 mt-3">
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  Voucher Ledgers (Central Console Sync)
                </h3>
                <p className="text-[9px] text-slate-500">Explore financial sheets directly filtered by transaction types synced from Central Console.</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setLedgerSubTab("rv")}
                  className={`text-[9px] font-bold px-2.5 py-1.5 rounded-md transition ${
                    ledgerSubTab === "rv" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Receipt Voucher (RV)
                </button>
                <button
                  onClick={() => setLedgerSubTab("pv")}
                  className={`text-[9px] font-bold px-2.5 py-1.5 rounded-md transition ${
                    ledgerSubTab === "pv" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Payment Voucher (PV)
                </button>
                <button
                  onClick={() => setLedgerSubTab("ri")}
                  className={`text-[9px] font-bold px-2.5 py-1.5 rounded-md transition ${
                    ledgerSubTab === "ri" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Rental Invoice (RI)
                </button>
                <button
                  onClick={() => setLedgerSubTab("rf")}
                  className={`text-[9px] font-bold px-2.5 py-1.5 rounded-md transition ${
                    ledgerSubTab === "rf" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Refund Voucher (RF)
                </button>
              </div>
            </div>

            {/* Select Profile and Search Bar Grid */}
            {((ledgerSubTab === "tenant" && selectedResidentId === "") || (ledgerSubTab === "apartment" && selectedResidentId === "")) ? (
              <div className="bg-slate-950/40 p-6 rounded-xl border border-slate-800/80 mt-3 space-y-6">
                {ledgerSubTab === "tenant" ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">Registered Tenants Directory</h3>
                      <span className="text-[10px] text-slate-500">{residents.length} Tenants Active</span>
                    </div>
                    <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/20">
                      <table className="w-full text-[10px] text-left border-collapse whitespace-nowrap">
                        <thead>
                          <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase text-[9px] tracking-wider font-bold">
                            <th className="p-3">Client ID</th>
                            <th className="p-3">Name</th>
                            <th className="p-3">Apartment</th>
                            <th className="p-3">Phone</th>
                            <th className="p-3 text-right">Security Deposit</th>
                            <th className="p-3 text-right">Outstanding Balance</th>
                            <th className="p-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {residents.length === 0 ? (
                            <tr><td colSpan={7} className="p-4 text-center text-slate-500">No tenants registered.</td></tr>
                          ) : residents.map(r => (
                            <tr key={r.id} className="border-b border-slate-900 hover:bg-slate-900/30 transition">
                              <td className="p-3 font-bold text-slate-400">{r.client_id}</td>
                              <td className="p-3 text-white font-semibold">{r.full_name}</td>
                              <td className="p-3 text-slate-300">{r.apartment_no || "—"}</td>
                              <td className="p-3 text-slate-400">{r.phone || "—"}</td>
                              <td className="p-3 text-right font-bold text-amber-400">PKR {Number(r.security_deposit || 0).toLocaleString()}</td>
                              <td className={`p-3 text-right font-bold ${Number(r.outstanding_balance || 0) > 0 ? "text-red-400" : "text-emerald-400"}`}>
                                PKR {Number(r.outstanding_balance || 0).toLocaleString()}
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => setSelectedResidentId(r.id)}
                                  className="bg-blue-600/80 text-white text-[9px] font-bold px-2 py-1 rounded hover:bg-blue-500 transition"
                                >
                                  View Ledger
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">Apartment & Parking Directory</h3>
                      <span className="text-[10px] text-slate-500">{residents.filter(r => r.apartment_no).length} Apartments Occupied</span>
                    </div>
                    <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/20">
                      <table className="w-full text-[10px] text-left border-collapse whitespace-nowrap">
                        <thead>
                          <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase text-[9px] tracking-wider font-bold">
                            <th className="p-3">Apartment No</th>
                            <th className="p-3">Tenant Name</th>
                            <th className="p-3">Type</th>
                            <th className="p-3 text-right">Monthly Rent</th>
                            <th className="p-3 text-right">Parking Rent</th>
                            <th className="p-3 text-right">Security Deposit</th>
                            <th className="p-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {residents.filter(r => r.apartment_no).length === 0 ? (
                            <tr><td colSpan={7} className="p-4 text-center text-slate-500">No occupied apartments found.</td></tr>
                          ) : residents.filter(r => r.apartment_no).map(r => (
                            <tr key={r.id} className="border-b border-slate-900 hover:bg-slate-900/30 transition">
                              <td className="p-3 font-bold text-white text-xs">{r.apartment_no}</td>
                              <td className="p-3 text-slate-300 font-semibold">{r.full_name}</td>
                              <td className="p-3 text-slate-400 capitalize">{r.apartment_type || "Standard"}</td>
                              <td className="p-3 text-right font-bold text-slate-300">PKR {Number(r.rent_amount || 0).toLocaleString()}</td>
                              <td className="p-3 text-right font-bold text-blue-400">PKR {Number(r.parking_rent || 0).toLocaleString()}</td>
                              <td className="p-3 text-right font-bold text-amber-400">PKR {Number(r.security_deposit || 0).toLocaleString()}</td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => setSelectedResidentId(r.id)}
                                  className="bg-blue-600/80 text-white text-[9px] font-bold px-2 py-1 rounded hover:bg-blue-500 transition"
                                >
                                  View Ledger
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
              <div className="space-y-2">
                {ledgerSubTab === "staff" ? (
                  <>
                    <Label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Select Staff Member</Label>
                    <select
                      value={selectedResidentId}
                      onChange={(e) => setSelectedResidentId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">-- All Staff Members --</option>
                      {(staff || []).map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} {s.designation ? `— ${s.designation}` : ''} {s.department ? `(${s.department})` : ''}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <Label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Select Resident Profile</Label>
                    <select
                      value={selectedResidentId}
                      onChange={(e) => setSelectedResidentId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">-- All Residents / Units --</option>
                      {residents.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.full_name} {r.apartment_no ? `(Apt: ${r.apartment_no})` : ''} - ID: {r.client_id}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Search / Filter Ledger</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Type description, ref number or details..."
                    value={ledgerSearchQuery}
                    onChange={(e) => setLedgerSearchQuery(e.target.value)}
                    className="bg-slate-950 border-slate-800 pl-10 text-xs text-white"
                  />
                </div>
              </div>

              {/* ERP Accounting Filters */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                <div className="space-y-2">
                  <Label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Voucher Type</Label>
                  <Select 
                    value={
                      ledgerSubTab === "rv" ? "RV" :
                      ledgerSubTab === "pv" ? "PV" :
                      ledgerSubTab === "ri" ? "INV" :
                      ledgerSubTab === "rf" ? "RF" :
                      ledgerVoucherFilter
                    } 
                    onValueChange={setLedgerVoucherFilter}
                    disabled={["rv", "pv", "ri", "rf"].includes(ledgerSubTab)}
                  >
                    <SelectTrigger className="w-full bg-slate-900 border-slate-700 text-xs h-[38px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Types</SelectItem>
                      <SelectItem value="RV">Receipt (RV)</SelectItem>
                      <SelectItem value="PV">Payment (PV)</SelectItem>
                      <SelectItem value="JV">Journal (JV)</SelectItem>
                      <SelectItem value="INV">Invoice (INV)</SelectItem>
                      <SelectItem value="RF">Refund (RF)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Posting Status</Label>
                  <Select value={ledgerStatusFilter} onValueChange={setLedgerStatusFilter}>
                    <SelectTrigger className="w-full bg-slate-900 border-slate-700 text-xs h-[38px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Statuses</SelectItem>
                      <SelectItem value="Posted">Posted</SelectItem>
                      <SelectItem value="Draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Date From</Label>
                  <Input type="date" value={ledgerDateFrom} onChange={(e) => setLedgerDateFrom(e.target.value)} className="w-full bg-slate-900 border-slate-700 text-xs h-[38px] text-white" style={{colorScheme: 'dark'}} />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Date To</Label>
                  <Input type="date" value={ledgerDateTo} onChange={(e) => setLedgerDateTo(e.target.value)} className="w-full bg-slate-900 border-slate-700 text-xs h-[38px] text-white" style={{colorScheme: 'dark'}} />
                </div>
              </div>

              <div className="col-span-1 md:col-span-2 flex justify-between items-center border-t border-slate-900 pt-2 mt-1">
                <span className="text-[10px] text-slate-400 font-semibold">
                  Showing <strong className="text-slate-200">{filteredLedgerEntries.length}</strong> transactions in matching ledger records.
                </span>
                <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                  isSingleSelection ? 'bg-amber-900/40 text-amber-400 border border-amber-800/40' : 'bg-blue-900/40 text-blue-400 border border-blue-800/40'
                }`}>
                  {isSingleSelection ? '🎯 Single Selection Mode' : '📊 Total Summary Batch Mode'}
                </span>
              </div>
            </div>

            {/* Ledger Matrix Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/20 mt-4">
              <table className="w-full text-[10px] text-center font-mono border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase text-[9px] tracking-wider font-bold">
                    <th className="p-3 text-left">Posting Date</th>
                    <th className="p-3 text-left">Account</th>
                    <th className="p-3 text-left">Voucher Ref</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left font-sans">Entity / Unit</th>
                    <th className="p-3 text-left font-sans">Description</th>
                    <th className="p-3 text-right">Debit (Dr)</th>
                    <th className="p-3 text-right">Credit (Cr)</th>
                    <th className="p-3 text-right">Running Balance (PKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredLedgerEntries || []).map((e) => {
                    // Helper to get entity name
                    let entityName = "General / Other";
                    if (ledgerSubTab === "staff") {
                      const desc = (e.description || "").toLowerCase();
                      const matched = (staff || []).find(s => desc.includes(s.full_name.toLowerCase()));
                      entityName = matched ? matched.full_name : "Staff Member";
                    } else if (ledgerSubTab === "inventory") {
                      entityName = "Company Asset";
                    } else {
                      const res = (residents || []).find(r => r.id === e.tenant_id);
                      if (res) {
                        entityName = `${res.full_name} ${res.apartment_no ? `(Apt ${res.apartment_no})` : ""}`;
                      } else if (e.tenant_id === "system") {
                        const desc = e.description || "";
                        const matchRv = desc.match(/Received from\s+(.*?)(?:\s+-|\s+\.|\s+Method:|\s+on account of|$)/i);
                        const matchPv = desc.match(/Paid to\s+(.*?)(?:\s+\.|\s+Method:|$)/i);
                        if (matchRv) {
                          entityName = matchRv[1].trim();
                        } else if (matchPv) {
                          entityName = matchPv[1].trim();
                        } else {
                          entityName = "System Account";
                        }
                      }
                    }

                    return (
                      <tr key={e.id} className="border-b border-slate-900 hover:bg-slate-900/30 transition-colors">
                        <td className="p-3 text-left text-slate-300">{e.posting_date ? format(new Date(e.posting_date), "dd MMM yyyy") : (e.entry_date || "—")}</td>
                        <td className="p-3 text-left">
                          {e.account_name || "N/A"}
                        </td>
                        <td className="p-3 text-left text-blue-400 font-bold cursor-pointer hover:underline" onClick={() => {
                          if (e.journal_id) {
                            setJvModalId(e.journal_id);
                            setJvModalOpen(true);
                          }
                        }}>
                          {e.reference_no || (e.id ? `REF-${String(e.id || "").substring(0, 6).toUpperCase()}` : "—")}
                        </td>
                        <td className="p-3 text-left">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                            (e.posting_status === "posted") ? "bg-emerald-900/30 text-emerald-400" :
                            "bg-slate-800 text-slate-400"
                          }`}>
                            {e.posting_status || "posted"}
                          </span>
                        </td>
                        <td className="p-3 text-left font-sans text-slate-300 font-semibold">{entityName}</td>
                        <td className="p-3 text-left font-sans text-slate-200">{e.description}</td>
                        <td className="p-3 text-right text-rose-500 font-bold font-mono">
                          {e.debit > 0 ? `PKR ${Number(e.debit).toLocaleString()}` : "—"}
                        </td>
                        <td className="p-3 text-right text-emerald-400 font-bold font-mono">
                          {e.credit > 0 ? `PKR ${Number(e.credit).toLocaleString()}` : "—"}
                        </td>
                        <td className="p-3 text-right text-amber-500 font-bold font-mono">
                          {Number(e.running_balance) < 0 
                            ? `PKR ${Math.abs(Number(e.running_balance)).toLocaleString()} (Credit Balance)` 
                            : `PKR ${Number(e.running_balance).toLocaleString()}`}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Grand Total Summary Row for Batch Mode */}
                  {!isSingleSelection && filteredLedgerEntries.length > 0 && (
                    <tr className="bg-slate-900/80 text-[11px] text-white border-t-2 border-slate-700">
                      <td colSpan={5} className="p-3 text-left align-middle">
                        <div className="text-lg font-black tracking-widest text-slate-300">GRAND TOTAL</div>
                        <div className="font-sans text-slate-400 text-[10px]">Summary of all filtered records</div>
                      </td>
                      <td className="p-3 text-right align-middle">
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Total Debit</div>
                        <div className="text-rose-400 font-mono font-bold text-sm">
                          PKR {filteredLedgerEntries.reduce((s, e) => s + (Number(e.debit) || 0), 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="p-3 text-right align-middle">
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Total Credit</div>
                        <div className="text-emerald-400 font-mono font-bold text-sm">
                          PKR {filteredLedgerEntries.reduce((s, e) => s + (Number(e.credit) || 0), 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="p-3 text-right align-middle">
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Net Balance</div>
                        <div className="text-amber-400 font-mono font-bold text-sm">
                          PKR {(
                            filteredLedgerEntries.reduce((s, e) => s + (Number(e.debit) || 0), 0) -
                            filteredLedgerEntries.reduce((s, e) => s + (Number(e.credit) || 0), 0)
                          ).toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  )}

                  {filteredLedgerEntries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 font-sans">
                        No ledger transactions found matching search query or category filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Print/PDF exports actions ribbon */}
            <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
              <Button onClick={() => handlePrintLedger("print")} className="bg-slate-800 border border-slate-700 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 cursor-pointer">
                <Printer className="h-4 w-4 text-amber-500" /> Print Statement
              </Button>
              <Button onClick={() => handlePrintLedger("pdf")} className="bg-slate-800 border border-slate-700 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 cursor-pointer">
                <Download className="h-4 w-4 text-blue-500" /> Save PDF Copy
              </Button>
            </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ====================================================
            TAB 2: INVOICES REGISTRY
            ==================================================== */}
        <TabsContent value="invoices" className="mt-4 space-y-6">
          <div className="w-full space-y-6">
            <div className="bg-card p-4 rounded-xl border border-border/60 flex flex-wrap gap-4 items-end justify-between shadow-sm">
              <div className="flex flex-wrap gap-3 items-center">
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase font-black block mb-1">From Date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 h-9 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase font-black block mb-1">To Date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 h-9 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase font-black block mb-1">Category</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-36 h-9 text-xs bg-background border-border/60">
                      <SelectValue placeholder="Select Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Categories</SelectItem>
                      <SelectItem value="Commercial">Commercial</SelectItem>
                      <SelectItem value="Residential">Residential</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase font-black block mb-1">Search Unit / Client / RV</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="text" placeholder="e.g. A-101" value={searchUnit} onChange={(e) => setSearchUnit(e.target.value)} className="pl-9 pr-3 h-9 w-48 text-xs bg-background" />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase font-black block mb-1">Floor Filter</Label>
                  <Select value={searchFloor} onValueChange={setSearchFloor}>
                    <SelectTrigger className="w-32 h-9 text-xs bg-background border-border/60">
                      <SelectValue placeholder="All Floors" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Floors</SelectItem>
                      <SelectItem value="Ground">Ground Floor</SelectItem>
                      <SelectItem value="1">1st Floor</SelectItem>
                      <SelectItem value="2">2nd Floor</SelectItem>
                      <SelectItem value="3">3rd Floor</SelectItem>
                      <SelectItem value="4">4th Floor</SelectItem>
                      <SelectItem value="5">5th Floor</SelectItem>
                      <SelectItem value="6">6th Floor</SelectItem>
                      <SelectItem value="7">7th Floor</SelectItem>
                      <SelectItem value="8">8th Floor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setAdjModalOpen(true)} className="border-orange-600/50 hover:bg-orange-950/20 text-orange-400 h-9 text-xs font-black">
                  📝 {isUrdu ? "ایڈجسٹمنٹ" : "Adjustment"}
                </Button>
                <Button variant="outline" onClick={handleExportCSV} className="h-9 text-xs">
                  <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
                <Button onClick={handlePrintLedgerSheet} className="bg-amber-500 hover:bg-amber-600 text-black h-9 text-xs font-black uppercase">
                  <Printer className="mr-2 h-4 w-4" /> Print PDF Report
                </Button>
              </div>
            </div>

            <div ref={printAreaRef} className="overflow-x-auto border border-border/60 rounded-xl bg-card shadow-sm">
              <table className="w-full text-[10px] text-center font-mono border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-900/90 text-white border-b-2 border-slate-800 uppercase text-[9px] font-bold">
                    <th className="p-2 border-r border-slate-800">S.No</th>
                    <th className="p-2 border-r border-slate-800">Unit</th>
                    <th className="p-2 border-r border-slate-800">Category</th>
                    <th className="p-2 border-r border-slate-800">Client Name</th>
                    <th className="p-2 border-r border-slate-800">Unit Type</th>
                    <th className="p-2 border-r border-slate-800">Remarks</th>
                    <th className="p-2 border-r border-slate-800">Rented On</th>
                    <th className="p-2 border-r border-slate-800 text-emerald-400">Rent</th>
                    <th className="p-2 border-r border-slate-800 text-yellow-400">Security</th>
                    <th className="p-2 border-r border-slate-800 text-amber-400">Electricity</th>
                    <th className="p-2 border-r border-slate-800 text-orange-400">Gas</th>
                    <th className="p-2 border-r border-slate-800 text-red-400">Arrears</th>
                    <th className="p-2 border-r border-slate-800 font-black">Total</th>
                    <th className="p-2 border-r border-slate-800 text-teal-400">Received</th>
                    <th className="p-2 border-r border-slate-800">Payment Mode</th>
                    <th className="p-2 border-r border-slate-800">RV Number</th>
                    <th className="p-2 border-r border-slate-800">RV Date</th>
                    <th className="p-2 border-r border-slate-800 text-cyan-400">Balance</th>
                    <th className="p-2 text-amber-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.sno} className="border-b border-slate-800 bg-slate-950/60 hover:bg-slate-900/60 transition-colors">
                      <td className="p-2 border-r border-slate-800 text-slate-300 font-bold">{row.sno}</td>
                      <td className="p-2 border-r border-slate-800 font-black text-amber-400">{row.unit}</td>
                      <td className="p-2 border-r border-slate-800 text-xs font-sans text-slate-200 font-bold">{row.type1}</td>
                      <td className="p-2 border-r border-slate-800 text-left font-sans font-bold text-slate-100">{row.name}</td>
                      <td className="p-2 border-r border-slate-800 text-xs font-sans text-slate-200">{row.type2}</td>
                      <td className="p-2 border-r border-slate-800 text-left font-sans max-w-xs truncate text-slate-300">{row.remarks}</td>
                      <td className="p-2 border-r border-slate-800 text-slate-200 font-bold">{row.rentedOn}</td>
                      <td className="p-2 border-r border-slate-800 text-emerald-400 font-black text-[11px]">{row.rent.toLocaleString()}</td>
                      <td className="p-2 border-r border-slate-800 text-yellow-400 font-bold">{row.security.toLocaleString()}</td>
                      <td className="p-2 border-r border-slate-800 text-amber-400 font-bold">{row.electricity.toLocaleString()}</td>
                      <td className="p-2 border-r border-slate-800 text-orange-400 font-bold">{row.gas.toLocaleString()}</td>
                      <td className="p-2 border-r border-slate-800 text-red-400 font-bold">{row.pending.toLocaleString()}</td>
                      <td className="p-2 border-r border-slate-800 font-black bg-slate-900/40 text-slate-100 text-[11px]">{row.total.toLocaleString()}</td>
                      <td className="p-2 border-r border-slate-800 text-teal-400 font-black text-[11px]">{row.received.toLocaleString()}</td>
                      <td className="p-2 border-r border-slate-800 text-xs font-sans text-slate-300 font-semibold">{row.mode}</td>
                      <td className="p-2 border-r border-slate-800 font-bold text-slate-200">{row.rvNo}</td>
                      <td className="p-2 border-r border-slate-800 text-slate-300">{row.rvDate}</td>
                      <td className="p-2 border-r border-slate-800 text-cyan-400 font-black text-[11px]">{row.balance.toLocaleString()}</td>
                      <td className="p-2 text-center whitespace-nowrap flex items-center justify-center gap-1">
                        <button
                          onClick={() => {
                            setEditingInvoice({
                              id: row.id || "",
                              name: row.name,
                              unit: row.unit,
                              flat_rent: row.rent,
                              maintenance_charges: row.security,
                              electricity_amount: row.electricity,
                              gas_charges: row.gas,
                              previous_arrears: row.pending,
                              amount_received: row.received
                            });
                            setEditInvoiceOpen(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded text-[8px] font-bold uppercase transition flex items-center gap-0.5 cursor-pointer"
                        >
                          <Pencil className="h-2.5 w-2.5" /> Edit
                        </button>
                        <button
                          onClick={() => handlePrintInvoiceFromRegistry(row)}
                          className="bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white px-2 py-0.5 rounded text-[8px] font-bold uppercase transition flex items-center gap-0.5 cursor-pointer"
                        >
                          <Printer className="h-2.5 w-2.5" /> Print
                        </button>
                        <button
                          onClick={() => handleWhatsAppInvoiceFromRegistry(row)}
                          className="bg-[#25D366] hover:bg-[#20ba5a] text-white px-2 py-0.5 rounded text-[8px] font-bold uppercase transition flex items-center gap-0.5 cursor-pointer"
                        >
                          <MessageSquare className="h-2.5 w-2.5" /> WhatsApp
                        </button>
                        <button
                          onClick={() => handleRefundFromRegistry(row, "RI")}
                          className="bg-rose-700 hover:bg-rose-600 text-white px-2 py-0.5 rounded text-[8px] font-bold uppercase transition flex items-center gap-0.5 cursor-pointer"
                          title="Issue Refund / Reverse Entry"
                        >
                          ↩ Refund
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredRows.length > 0 && (
                    <tr className="bg-muted/60 text-foreground border-b border-border font-bold">
                      <td className="p-2 border-r border-border/60 text-slate-500" colSpan={7}>TOTAL SUMS</td>
                      <td className="p-2 border-r border-border/60 text-emerald-500">{columnTotals.rent.toLocaleString()}</td>
                      <td className="p-2 border-r border-border/60 text-yellow-500">{columnTotals.security.toLocaleString()}</td>
                      <td className="p-2 border-r border-border/60 text-amber-500">{columnTotals.electricity.toLocaleString()}</td>
                      <td className="p-2 border-r border-border/60 text-orange-500">{columnTotals.gas.toLocaleString()}</td>
                      <td className="p-2 border-r border-border/60 text-red-500">{columnTotals.pending.toLocaleString()}</td>
                      <td className="p-2 border-r border-border/60 text-foreground bg-muted/80">{columnTotals.total.toLocaleString()}</td>
                      <td className="p-2 border-r border-border/60 text-teal-500">{columnTotals.received.toLocaleString()}</td>
                      <td className="p-2 border-r border-border/60" colSpan={3}></td>
                      <td className="p-2 text-cyan-500">{columnTotals.balance.toLocaleString()}</td>
                      <td className="p-2"></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ====================================================
            TAB 3: DAILY CASH BOOK
            ==================================================== */}
        <TabsContent value="cashbook" className="mt-4 space-y-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <StatCard icon={TrendingUp} label={isUrdu ? "کل نقد آمدن" : "Total Cash In"} value={"PKR " + cashbookTotals.inc.toLocaleString()} accent="success" />
            <StatCard icon={TrendingDown} label={isUrdu ? "کل نقد اخراجات" : "Total Cash Out"} value={"PKR " + cashbookTotals.exp.toLocaleString()} accent="destructive" />
            <StatCard icon={Wallet} label={isUrdu ? "باقی نقد رقم" : "Net Cash In Hand"} value={"PKR " + cashbookTotals.bal.toLocaleString()} accent="primary" />
          </div>

          <div className="bg-card border border-border/60 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap border-b border-border/40 pb-4">
              <div className="flex items-center gap-4 flex-wrap">
                <h3 className="font-display text-base font-bold text-foreground">Daily Transactions Log Book</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Select Date:</span>
                  <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-40 h-9 text-xs" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={exportCashbookPdf} className="h-9 text-xs">
                  <Printer className="h-4 w-4 mr-1.5" /> Export PDF Log
                </Button>
              </div>
            </div>

            {loadingCashbook ? (
              <div className="text-center py-12 text-muted-foreground text-xs">Loading daily cash entries...</div>
            ) : dailyCashbookRows.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border/60 rounded-lg">
                <Wallet className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2 animate-pulse" />
                <h4 className="font-bold text-sm text-foreground">No cash transactions logged on {selectedDate}.</h4>
                <p className="text-xs text-muted-foreground mt-0.5 font-sans font-semibold text-amber-500">All transactions must be entered via Central Entry Console.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Cash In (Income) */}
                <div className="space-y-2 p-4 bg-secondary/15 rounded-xl border border-success/15">
                  <h4 className="font-display font-bold text-sm text-success flex items-center gap-1.5 border-b border-success/20 pb-2">
                    <TrendingUp className="h-4 w-4" /> Income / Receipts (Cash In)
                  </h4>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground bg-secondary/20 font-bold uppercase text-[9px]">
                        <th className="p-2 text-left w-6">#</th>
                        <th className="p-2 text-left">Description</th>
                        <th className="p-2 text-left">Category</th>
                        <th className="p-2 text-right">Amount</th>
                        <th className="p-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyCashbookRows.filter(r => r.type === "credit").map((r, idx) => (
                        <tr key={r.id} className="border-t border-border/30 hover:bg-success/5">
                          <td className="p-2">{idx + 1}</td>
                          <td className="p-2 font-medium">{r.description}</td>
                          <td className="p-2 text-muted-foreground font-sans uppercase text-[10px]">{r.category ?? "-"}</td>
                          <td className="p-2 text-right text-success font-bold">PKR {Number(r.amount).toLocaleString()}</td>
                          <td className="p-2 text-right">
                            <Button size="sm" variant="ghost" onClick={() => handlePrintCashbookInvoice(r)}>
                              <Printer className="h-3.5 w-3.5 text-primary" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Cash Out (Expenses) */}
                <div className="space-y-2 p-4 bg-secondary/15 rounded-xl border border-destructive/15">
                  <h4 className="font-display font-bold text-sm text-destructive flex items-center gap-1.5 border-b border-destructive/20 pb-2">
                    <TrendingDown className="h-4 w-4" /> Expenses / Payments (Cash Out)
                  </h4>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground bg-secondary/20 font-bold uppercase text-[9px]">
                        <th className="p-2 text-left w-6">#</th>
                        <th className="p-2 text-left">Description</th>
                        <th className="p-2 text-left">Category</th>
                        <th className="p-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyCashbookRows.filter(r => r.type === "debit").map((r, idx) => (
                        <tr key={r.id} className="border-t border-border/30 hover:bg-destructive/5">
                          <td className="p-2">{idx + 1}</td>
                          <td className="p-2 font-medium">{r.description}</td>
                          <td className="p-2 text-muted-foreground font-sans uppercase text-[10px]">{r.category ?? "-"}</td>
                          <td className="p-2 text-right text-destructive font-bold">PKR {Number(r.amount).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            )}
          </div>
        </TabsContent>

        {/* ====================================================
            TAB 4: BOOKKEEPING REPORTS
            ==================================================== */}
        <TabsContent value="financial_reports" className="mt-4 space-y-6">
          <div className="bg-card border border-border/60 rounded-xl p-4 flex flex-wrap items-end justify-between gap-3 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">From Date</Label>
                <Input type="date" value={repFrom} onChange={e => setRepFrom(e.target.value)} className="w-40 h-9" />
              </div>
              <div>
                <Label className="text-xs">To Date</Label>
                <Input type="date" value={repTo} onChange={e => setRepTo(e.target.value)} className="w-40 h-9" />
              </div>
              <div>
                <Label className="text-xs">Balance Sheet As Of</Label>
                <Input type="date" value={repAsOf} onChange={e => setRepAsOf(e.target.value)} className="w-40 h-9" />
              </div>
              <div className="flex gap-1.5 h-9 items-center">
                <Button variant="outline" size="sm" onClick={() => quickRange("mtd")} className="text-xs h-9">MTD</Button>
                <Button variant="outline" size="sm" onClick={() => quickRange("lastMonth")} className="text-xs h-9">Last Month</Button>
                <Button variant="outline" size="sm" onClick={() => quickRange("ytd")} className="text-xs h-9">YTD</Button>
              </div>
            </div>
            <Button onClick={loadReports} disabled={loadingReports} className="h-9 text-xs">
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loadingReports ? 'animate-spin' : ''}`} /> Refresh Reports
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Profit & Loss Block */}
            <div className="bg-card p-5 border border-border/60 rounded-xl shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-border pb-3">
                <h4 className="font-bold text-sm text-foreground uppercase tracking-wider">Profit & Loss Statement</h4>
                <Button size="sm" variant="ghost" onClick={() => downloadProfitLossPDF({ from: repFrom, to: repTo, rows: pl })}><Download className="h-4 w-4 text-primary" /></Button>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b pb-1">
                  <span>Gross Billed Income:</span>
                  <span className="text-success font-semibold">PKR {reportTotals.inc.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Operating Expenses:</span>
                  <span className="text-destructive font-semibold">PKR {reportTotals.exp.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-black text-sm pt-2">
                  <span>Net Net Income:</span>
                  <span className={reportTotals.net >= 0 ? "text-success" : "text-destructive"}>
                    PKR {reportTotals.net.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Balance Sheet Block */}
            <div className="bg-card p-5 border border-border/60 rounded-xl shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-border pb-3">
                <h4 className="font-bold text-sm text-foreground uppercase tracking-wider">Balance Sheet Summary</h4>
                <Button size="sm" variant="ghost" onClick={() => downloadBalanceSheetPDF({ asOf: repAsOf, rows: bs })}><Download className="h-4 w-4 text-primary" /></Button>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b pb-1">
                  <span>Total Capital Assets:</span>
                  <span className="font-semibold text-blue-500">PKR {reportTotals.ast.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Liability (Deposits Held):</span>
                  <span className="font-semibold text-rose-500">PKR {reportTotals.lia.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Owner Capital Equity:</span>
                  <span className="font-semibold text-purple-500">PKR {reportTotals.eq.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-black text-sm pt-2">
                  <span>Liability & Equity Balance:</span>
                  <span className="font-bold">PKR {(reportTotals.lia + reportTotals.eq).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Trial Balance Audit Status */}
            <div className="bg-card p-5 border border-border/60 rounded-xl shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-border pb-3">
                <h4 className="font-bold text-sm text-foreground uppercase tracking-wider">Trial Balance Audit</h4>
                <Button size="sm" variant="ghost" onClick={() => downloadTrialBalancePDF({ from: repFrom, to: repTo, rows: tb })}><Download className="h-4 w-4 text-primary" /></Button>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b pb-1">
                  <span>Accumulated Debits:</span>
                  <span>PKR {reportTotals.dr.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Accumulated Credits:</span>
                  <span>PKR {reportTotals.cr.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-black text-sm pt-2">
                  <span>Audit Balance Check:</span>
                  <span className="text-teal-500">
                    {Math.abs(reportTotals.dr - reportTotals.cr) === 0 ? "✓ Balanced & Audited" : "❌ Trial Balance Mismatch"}
                  </span>
                </div>
              </div>
            </div>

            {/* Rent Collection & Arrears Recovery Analytics */}
            <div className="bg-card p-5 border border-border/60 rounded-xl shadow-sm space-y-4 col-span-1 lg:col-span-3">
              <div className="flex justify-between items-center border-b border-border pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <h4 className="font-bold text-sm text-foreground uppercase tracking-wider">Executive Analytics Reports</h4>
                  <div className="flex gap-1">
                    <Button 
                      variant={analyticsType === "collection" ? "default" : "outline"} 
                      onClick={() => setAnalyticsType("collection")}
                      className="h-7 text-xs px-2.5"
                    >
                      Rent Collection
                    </Button>
                    <Button 
                      variant={analyticsType === "arrears" ? "default" : "outline"} 
                      onClick={() => setAnalyticsType("arrears")}
                      className="h-7 text-xs px-2.5"
                    >
                      Arrears Aging
                    </Button>
                  </div>
                </div>
                <Button onClick={triggerAnalyticsExport} size="sm" variant="outline" className="h-8 text-xs">
                  <Printer className="mr-1.5 h-3.5 w-3.5" /> Download Analytics PDF
                </Button>
              </div>

              <div className="overflow-x-auto border border-border/40 rounded-lg">
                {analyticsType === "collection" ? (
                  <table className="w-full text-xs text-center border-collapse">
                    <thead>
                      <tr className="bg-muted text-muted-foreground uppercase text-[9px] font-bold border-b">
                        <th className="p-2.5 text-left">Month Period</th>
                        <th className="p-2.5 text-right">Rent Billed</th>
                        <th className="p-2.5 text-right">Rent Collected</th>
                        <th className="p-2.5 text-right text-rose-500">Outstanding</th>
                        <th className="p-2.5 text-right text-teal-500">Recovery Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.map((item, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/30">
                          <td className="p-2.5 text-left font-mono font-bold">{item.month}</td>
                          <td className="p-2.5 text-right font-mono">PKR {item.billed.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono">PKR {item.collected.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono text-rose-600">PKR {item.outstanding.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-teal-600">{item.percentage.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-xs text-center border-collapse">
                    <thead>
                      <tr className="bg-muted text-muted-foreground uppercase text-[9px] font-bold border-b">
                        <th className="p-2.5 text-left">Resident / Unit</th>
                        <th className="p-2.5 text-right">1-30 Days</th>
                        <th className="p-2.5 text-right">31-60 Days</th>
                        <th className="p-2.5 text-right">61-90 Days</th>
                        <th className="p-2.5 text-right">91-120 Days</th>
                        <th className="p-2.5 text-right">120+ Days</th>
                        <th className="p-2.5 text-right text-rose-500">Total Arrears</th>
                        <th className="p-2.5 text-right text-teal-500">Recovery Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.map((item, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/30">
                          <td className="p-2.5 text-left">
                            <div className="font-bold text-amber-500 font-mono">{item.unit}</div>
                            <div className="text-muted-foreground font-sans text-[10px]">{item.name}</div>
                          </td>
                          <td className="p-2.5 text-right font-mono">PKR {item.age_30.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono">PKR {item.age_60.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono">PKR {item.age_90.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono">PKR {item.age_120.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono">PKR {item.age_plus.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono font-black text-rose-600">PKR {item.total.toLocaleString()}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-teal-600">{item.recoveryRate.toFixed(0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>
        </TabsContent>

      </Tabs>

      {/* Daily Cashbook dialog */}
      <Dialog open={cashbookDialogOpen} onOpenChange={setCashbookDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Daily Cash Book Entry</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label className="text-xs font-semibold mb-1 block">Transaction Type</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => handleCashbookTypeChange("credit")}
                  className={`py-2 px-3 rounded-md text-xs font-medium transition-all ${
                    cashbookForm.type === "credit"
                      ? "bg-success text-success-foreground shadow"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  Income (Cash In)
                </button>
                <button
                  type="button"
                  onClick={() => handleCashbookTypeChange("debit")}
                  className={`py-2 px-3 rounded-md text-xs font-medium transition-all ${
                    cashbookForm.type === "debit"
                      ? "bg-destructive text-destructive-foreground shadow"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  Expense (Cash Out)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date</Label>
                <Input type="date" value={cashbookForm.entry_date} onChange={(e) => setCashbookForm({ ...cashbookForm, entry_date: e.target.value })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Payment Channel</Label>
                <Select value={cashbookForm.payment_channel} onValueChange={(v) => setCashbookForm({ ...cashbookForm, payment_channel: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>`r`n                    <SelectItem value="Cheque">Cheque</SelectItem>
                    
                    
                    <SelectItem value="BankTransfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Description / Title</Label>
              <Input value={cashbookForm.description} onChange={(e) => setCashbookForm({ ...cashbookForm, description: e.target.value })} placeholder="e.g. Pump repair" className="h-8 text-xs" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={cashbookForm.category} onValueChange={(v) => setCashbookForm({ ...cashbookForm, category: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Category" /></SelectTrigger>
                  <SelectContent>
                    {filteredCashbookCategories.map(g => (
                      <SelectGroup key={g.group}>
                        <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-0.5 bg-muted/40 rounded mt-1">{g.group}</SelectLabel>
                        {g.options.map(o => (
                          <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Amount (PKR)</Label>
                <Input type="number" value={cashbookForm.amount} onChange={(e) => setCashbookForm({ ...cashbookForm, amount: e.target.value })} placeholder="0.00" className="h-8 text-xs" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Resident Link (Optional)</Label>
              <Select value={cashbookForm.resident_id || "none"} onValueChange={(v) => setCashbookForm({ ...cashbookForm, resident_id: v === "none" ? "" : v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (general ledger)</SelectItem>
                  {residents.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.apartment_no ? `[${r.apartment_no}] ` : ""}{r.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCashbookDialogOpen(false)} className="h-8 text-xs">Cancel</Button>
            <Button onClick={submitCashbookEntry} disabled={savingCashbookEntry} className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-black">
              {savingCashbookEntry ? "Posting..." : "Post Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp mock verification pop-up payload dialog */}
      <Dialog open={whatsappModalOpen} onOpenChange={setWhatsappModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-base font-bold">
              <MessageSquare className="h-5 w-5 text-emerald-500" />
              WhatsApp Message Dispatcher
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
              <div className="font-bold text-muted-foreground mb-1 uppercase text-[10px]">Recipient Phone Number:</div>
              <div className="font-mono text-sm text-foreground font-semibold">{whatsappPayload.phone}</div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase font-black block mb-1">Message Content Payload:</Label>
              <textarea 
                value={whatsappPayload.message}
                onChange={(e) => setWhatsappPayload({ ...whatsappPayload, message: e.target.value })}
                className="w-full h-32 p-3 font-sans rounded-md border border-border/80 bg-background text-xs resize-none" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhatsappModalOpen(false)} className="h-8 text-xs">Cancel</Button>
            <Button onClick={handleTriggerMockWhatsApp} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              Dispatch to Resident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Invoice Dialog Modal */}
      <Dialog open={editInvoiceOpen} onOpenChange={setEditInvoiceOpen}>
        <DialogContent className="max-w-md bg-card text-foreground border border-border/80 rounded-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-base font-bold">
              <Pencil className="h-5 w-5 text-blue-500" />
              Edit Invoice / Rent Record
            </DialogTitle>
          </DialogHeader>
          {editingInvoice && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-lg border border-border/40 font-semibold">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Client Name:</div>
                  <div className="text-sm font-sans mt-0.5 text-foreground">{editingInvoice.name}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Unit:</div>
                  <div className="text-sm font-mono mt-0.5 text-foreground">{editingInvoice.unit}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Rent Amount (PKR)</Label>
                  <Input 
                    type="number" 
                    value={editingInvoice.flat_rent} 
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, flat_rent: Number(e.target.value) })}
                    className="h-9 text-xs bg-background border-border/60 font-bold mt-1 text-emerald-500"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Maintenance Fee (PKR)</Label>
                  <Input 
                    type="number" 
                    value={editingInvoice.maintenance_charges} 
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, maintenance_charges: Number(e.target.value) })}
                    className="h-9 text-xs bg-background border-border/60 font-bold mt-1 text-yellow-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Electricity Charges (PKR)</Label>
                  <Input 
                    type="number" 
                    value={editingInvoice.electricity_amount} 
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, electricity_amount: Number(e.target.value) })}
                    className="h-9 text-xs bg-background border-border/60 font-bold mt-1 text-amber-500"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Gas Charges (PKR)</Label>
                  <Input 
                    type="number" 
                    value={editingInvoice.gas_charges} 
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, gas_charges: Number(e.target.value) })}
                    className="h-9 text-xs bg-background border-border/60 font-bold mt-1 text-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 col-span-2">
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Arrears / Pending (PKR)</Label>
                  <Input 
                    type="number" 
                    value={editingInvoice.previous_arrears} 
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, previous_arrears: Number(e.target.value) })}
                    className="h-9 text-xs bg-background border-border/60 font-bold mt-1 text-red-500"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Amount Paid / Received (PKR)</Label>
                  <Input 
                    type="number" 
                    value={editingInvoice.amount_received} 
                    onChange={(e) => setEditingInvoice({ ...editingInvoice, amount_received: Number(e.target.value) })}
                    className="h-9 text-xs bg-background border-border/60 font-bold mt-1 text-teal-500"
                  />
                </div>
              </div>

              <div className="bg-muted/40 p-3 rounded-lg border border-border/60 grid grid-cols-2 gap-2 text-center">
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase font-semibold">Calculated Total:</div>
                  <div className="text-sm font-black mt-0.5">
                    PKR {(
                      editingInvoice.flat_rent + 
                      editingInvoice.maintenance_charges + 
                      editingInvoice.electricity_amount + 
                      editingInvoice.gas_charges + 
                      editingInvoice.previous_arrears
                    ).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase font-semibold">Calculated Balance:</div>
                  <div className="text-sm font-black text-cyan-400 mt-0.5">
                    PKR {(
                      (editingInvoice.flat_rent + 
                      editingInvoice.maintenance_charges + 
                      editingInvoice.electricity_amount + 
                      editingInvoice.gas_charges + 
                      editingInvoice.previous_arrears) - 
                      editingInvoice.amount_received
                    ).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditInvoiceOpen(false)} className="h-8 text-xs">Cancel</Button>
            <Button onClick={handleUpdateInvoice} disabled={savingInvoice} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold">
              {savingInvoice ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={jvModalOpen} onOpenChange={setJvModalOpen}>
        <DialogContent className="sm:max-w-[700px] bg-slate-950 border-slate-800 p-0 text-slate-200">
          <DialogHeader className="p-4 border-b border-slate-800 bg-slate-900/50">
            <DialogTitle className="text-sm font-black uppercase text-amber-500 tracking-wider flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Journal Entry Drill-Down
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            {jvModalLoading ? (
              <div className="text-center py-8 text-slate-500 text-xs font-mono animate-pulse">Loading double-entry splits...</div>
            ) : jvModalData?.header ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-slate-900 rounded-lg border border-slate-800/80">
                  <div><div className="text-[9px] text-slate-500 uppercase font-bold">Voucher No</div><div className="text-xs font-bold text-white">{jvModalData.header.voucher_no}</div></div>
                  <div><div className="text-[9px] text-slate-500 uppercase font-bold">Date</div><div className="text-xs font-bold text-slate-300">{format(new Date(jvModalData.header.date), "dd MMM yyyy")}</div></div>
                  <div><div className="text-[9px] text-slate-500 uppercase font-bold">Type</div><div className="text-xs font-bold text-blue-400">{jvModalData.header.voucher_type}</div></div>
                  <div><div className="text-[9px] text-slate-500 uppercase font-bold">Status</div><div className="text-xs font-bold text-emerald-400 uppercase">{jvModalData.header.status}</div></div>
                </div>
                <div className="text-xs text-slate-400 p-2 border-l-2 border-amber-500/50 bg-amber-950/20">{jvModalData.header.description}</div>
                
                <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950">
                  <table className="w-full text-[10px] text-left font-mono border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase text-[9px] font-bold">
                        <th className="p-2">Account</th>
                        <th className="p-2">Name</th>
                        <th className="p-2">Entity ID</th>
                        <th className="p-2 text-right">Debit (Dr)</th>
                        <th className="p-2 text-right">Credit (Cr)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(jvModalData.lines || []).map((l: any) => (
                        <tr key={l.id} className="border-b border-slate-900/50 hover:bg-slate-900/30">
                          <td className="p-2 text-slate-400 font-bold">{l.account_code}</td>
                          <td className="p-2 text-slate-300 font-sans">{l.account_name}</td>
                          <td className="p-2 text-slate-500">{l.entity_id || "—"}</td>
                          <td className="p-2 text-right text-rose-500 font-bold">{l.debit > 0 ? l.debit.toLocaleString() : ""}</td>
                          <td className="p-2 text-right text-emerald-500 font-bold">{l.credit > 0 ? l.credit.toLocaleString() : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-900/80 border-t border-slate-700">
                      <tr>
                        <td colSpan={3} className="p-2 text-right text-slate-400 uppercase text-[9px] font-bold">Total Entry Balance</td>
                        <td className="p-2 text-right text-rose-500 font-bold border-x border-slate-800">{jvModalData.lines?.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0).toLocaleString()}</td>
                        <td className="p-2 text-right text-emerald-500 font-bold border-x border-slate-800">{jvModalData.lines?.reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0).toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-rose-500 text-xs">Failed to load Journal Entry details.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      </div>
  );
}
