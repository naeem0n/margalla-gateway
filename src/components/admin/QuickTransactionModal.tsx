import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Printer, Check, ReceiptText, FileText, Sparkles, Zap, Flame, Wrench, Scale, DollarSign, ChevronRight, Droplets } from 'lucide-react';
import { format } from "date-fns";
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";

interface QuickTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultTab?: "payment" | "request";
  defaultApartmentNo?: string;
  defaultReqType?: string;
  defaultAction?: "Collect" | "Return";
  defaultNote?: string;
  defaultTxType?: string;
  theme?: "dark" | "light" | "default";
}

export function QuickTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  defaultTab = "payment",
  defaultApartmentNo = "",
  defaultReqType = "Rent",
  defaultAction = "Collect",
  defaultNote = "",
  defaultTxType = "Rent Received",
  theme = "default"
}: QuickTransactionModalProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [residents, setResidents] = useState<any[]>([]);
  const [loadingResidents, setLoadingResidents] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Success states
  const [txSuccess, setTxSuccess] = useState(false);
  const [lastRecordedTx, setLastRecordedTx] = useState<any>(null);

  // Form states - Record Payment/Charge
  const [paymentForm, setPaymentForm] = useState({
    entry_date: format(new Date(), 'yyyy-MM-dd'),
    apartment_no: '',
    resident_id: '',
    resident_name: '',
    tx_type: 'Rent Received',
    amount: '',
    payment_mode: 'Cash',
    rv_number: '',
    remarks: '',
    manual_side: 'credit', 
    adj_side: 'debit'
  });

  // Balance Adjustment states inside Step 1 (fallback option)
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [adjSide, setAdjSide] = useState<"debit" | "credit">("debit");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjRemarks, setAdjRemarks] = useState("");
  const [applyingAdj, setApplyingAdj] = useState(false);

  // Monthly Bill editable fields
  const [rentInput, setRentInput] = useState<string>('');
  const [maintInput, setMaintInput] = useState<string>('');

  // Electricity meter calculation states
  const [elecPrev, setElecPrev] = useState<number>(0);
  const [elecRate, setElecRate] = useState<number>(100);
  const [elecAmount, setElecAmount] = useState<number>(0);
  const [elecUnits, setElecUnits] = useState<number>(0);
  const [elecUnitsInput, setElecUnitsInput] = useState<string>('0');

  // Gas meter calculation states
  const [gasMode, setGasMode] = useState<"fixed" | "units">("fixed");
  const [gasPrev, setGasPrev] = useState<number>(0);
  const [gasRate, setGasRate] = useState<number>(120);
  const [gasAmount, setGasAmount] = useState<string>('1000'); 
  const [gasUnits, setGasUnits] = useState<number>(0);
  const [gasUnitsInput, setGasUnitsInput] = useState<string>('0');
  const [gasTotalCharge, setGasTotalCharge] = useState<number>(1000);

  // Water meter calculation states
  const [waterPrev, setWaterPrev] = useState<number>(0);
  const [waterRate, setWaterRate] = useState<number>(80);
  const [waterAmount, setWaterAmount] = useState<number>(0);
  const [waterUnits, setWaterUnits] = useState<number>(0);
  const [waterUnitsInput, setWaterUnitsInput] = useState<string>('0');

  // Opening Balance editable state
  const [openingBalanceInput, setOpeningBalanceInput] = useState<string>('0');

  // General Entry Received/Paid states
  const [genReceived, setGenReceived] = useState<string>('');
  const [genPaid, setGenPaid] = useState<string>('');

  // Pending invoice state for Rent Received
  const [pendingInvoice, setPendingInvoice] = useState<any>(null);
  const [applyToInvoice, setApplyToInvoice] = useState(true);

  // Form states - Create Payment Request
  const [requestForm, setRequestForm] = useState({
    apartment_no: '',
    resident_id: '',
    resident_name: '',
    req_type: 'Rent',
    action: 'Collect',
    amount: '',
    due_date: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    note: ''
  });

  // Load residents from database
  const loadResidents = async () => {
    setLoadingResidents(true);
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
        setResidents(res.data);
      }
    } catch (e) {
      console.error("Failed to fetch residents for modal:", e);
    } finally {
      setLoadingResidents(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadResidents();
      setTxSuccess(false);
      setLastRecordedTx(null);
      setPendingInvoice(null);
      setShowAdjustment(false);
      setAdjAmount("");
      setAdjRemarks("");
      
      const autoRv = `RV-${format(new Date(), 'yyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
      setPaymentForm({
        entry_date: format(new Date(), 'yyyy-MM-dd'),
        apartment_no: defaultApartmentNo,
        resident_id: '',
        resident_name: '',
        tx_type: defaultTxType,
        amount: '',
        payment_mode: 'Cash',
        rv_number: autoRv,
        remarks: '',
        manual_side: 'credit',
        adj_side: 'debit'
      });
      
      setRequestForm({
        apartment_no: defaultApartmentNo,
        resident_id: '',
        resident_name: '',
        req_type: defaultReqType,
        action: defaultAction,
        amount: '',
        due_date: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        note: defaultNote
      });
      
      // Reset utilities
      setElecPrev(0);
      setElecRate(100);
      setElecAmount(0);
      setElecUnits(0);
      setElecUnitsInput('0');
      
      setGasMode("fixed");
      setGasPrev(0);
      setGasRate(120);
      setGasAmount('1000');
      setGasUnits(0);
      setGasUnitsInput('0');
      setGasTotalCharge(1000);
      
      setWaterPrev(0);
      setWaterRate(80);
      setWaterAmount(0);
      setWaterUnits(0);
      setWaterUnitsInput('0');

      setRentInput('');
      setMaintInput('');
      setOpeningBalanceInput('0');
      setGenReceived('');
      setGenPaid('');
      
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab, defaultApartmentNo, defaultReqType, defaultAction, defaultNote, defaultTxType]);

  // Handle default apartment pre-selection once residents load
  useEffect(() => {
    if (isOpen && residents.length > 0 && defaultApartmentNo) {
      handleApartmentChange(defaultApartmentNo, activeTab === "payment" ? "payment" : "request");
    }
  }, [residents, defaultApartmentNo, isOpen]);

  // Handle resident change when apartment is selected
  const handleApartmentChange = async (aptNo: string, mode: "payment" | "request") => {
    const res = residents.find(r => r.apartment_no === aptNo);
    const autoRv = `RV-${format(new Date(), 'yyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;

    if (mode === "payment") {
      setPaymentForm(prev => ({
        ...prev,
        apartment_no: aptNo,
        resident_id: res ? res.id : "",
        resident_name: res ? res.full_name : "",
        rv_number: prev.rv_number || autoRv
      }));

      if (res) {
        // Load meter readings & defaults
        setElecPrev(Number(res.elec_curr || res.elec_prev || 0));
        setElecRate(Number(res.elec_rate || 100));
        
        setGasPrev(Number(res.gas_curr || res.gas_prev || 0));
        setGasRate(Number(res.gas_rate || 120));
        setGasAmount(res.gas_fixed_payment ? String(res.gas_fixed_payment) : '1000');
        
        setWaterPrev(Number(res.water_curr || res.water_prev || 0));
        setWaterRate(Number(res.water_rate || 80));

        setRentInput(res.rent_amount ? String(res.rent_amount) : '');
        setMaintInput(res.fixed_maintenance ? String(res.fixed_maintenance) : '3000');
        setOpeningBalanceInput(res.outstanding_balance ? String(res.outstanding_balance) : '0');
        
        setElecUnitsInput('0');
        setGasUnitsInput('0');
        setWaterUnitsInput('0');
        setGenReceived('');
        setGenPaid('');
        
        // Fetch pending invoice
        setPendingInvoice(null);
        try {
          const fetchRes = await apiFetch<{ data: any[] }>("/query-bridge", {
            method: "POST",
            body: JSON.stringify({
              table: "invoices",
              action: "select",
              filters: [
                { column: "tenant_id", value: res.id },
                { column: "current_balance", type: "gt", value: 0 }
              ],
              order: { column: "date", ascending: false },
              limit: 1
            })
          });
          if (fetchRes && fetchRes.data && fetchRes.data.length > 0) {
            const inv = fetchRes.data[0];
            setPendingInvoice(inv);
            
            // Prefill with pending invoice amount if renting
            if (paymentForm.tx_type === "Rent Received") {
              setPaymentForm(prev => ({
                ...prev,
                amount: String(inv.current_balance || 0),
                remarks: `Settle Invoice #${inv.invoice_no}`
              }));
            }
          }
        } catch (err) {
          console.error("Failed to fetch pending invoice:", err);
        }
      }
    } else {
      setRequestForm(prev => ({
        ...prev,
        apartment_no: aptNo,
        resident_id: res ? res.id : "",
        resident_name: res ? res.full_name : ""
      }));
      
      if (res && requestForm.req_type === "Rent" && res.rent_amount) {
        setRequestForm(prev => ({
          ...prev,
          amount: String(res.rent_amount),
          note: `${format(new Date(), 'MMMM yyyy')} Rent`
        }));
      }
    }
  };

  // Sync calculations for unified Utility Bill, Monthly Bill, and General Entry
  useEffect(() => {
    const eUnits = Number(elecUnitsInput) || 0;
    const eAmt = eUnits * elecRate;
    setElecUnits(eUnits);
    setElecAmount(eAmt);

    let gAmt = 0;
    let gUnits = 0;
    if (gasMode === "fixed") {
      gAmt = Number(gasAmount) || 0;
    } else {
      gUnits = Number(gasUnitsInput) || 0;
      gAmt = gUnits * gasRate;
    }
    setGasUnits(gUnits);
    setGasTotalCharge(gAmt);

    const wUnits = Number(waterUnitsInput) || 0;
    const wAmt = wUnits * waterRate;
    setWaterUnits(wUnits);
    setWaterAmount(wAmt);

    if (paymentForm.tx_type === "Utility Bill") {
      const totalBill = eAmt + gAmt + wAmt;
      setPaymentForm(prev => ({
        ...prev,
        amount: totalBill > 0 ? String(totalBill) : ''
      }));
    } else if (paymentForm.tx_type === "Monthly Bill") {
      const rent = Number(rentInput) || 0;
      const maint = Number(maintInput) || 0;
      const gas = Number(gasAmount) || 0;
      const openBal = Number(openingBalanceInput) || 0;
      const totalBill = rent + maint + gas + eAmt + openBal;
      setPaymentForm(prev => ({
        ...prev,
        amount: totalBill > 0 ? String(totalBill) : '0'
      }));
    } else if (paymentForm.tx_type === "General Entry") {
      const recVal = Number(genReceived) || 0;
      const paidVal = Number(genPaid) || 0;
      const netChange = paidVal - recVal;
      setPaymentForm(prev => ({
        ...prev,
        amount: String(Math.abs(netChange))
      }));
    }
  }, [elecUnitsInput, elecRate, gasMode, gasUnitsInput, gasRate, gasAmount, waterUnitsInput, waterRate, rentInput, maintInput, openingBalanceInput, genReceived, genPaid, paymentForm.tx_type]);

  // Handle prefill defaults based on selected resident & transaction type
  useEffect(() => {
    const res = residents.find(r => r.apartment_no === paymentForm.apartment_no);
    if (!res) return;

    if (paymentForm.tx_type === "Monthly Rent") {
      setPaymentForm(prev => ({
        ...prev,
        amount: res.rent_amount ? String(res.rent_amount) : "",
        remarks: `Monthly Rent for ${format(new Date(), 'MMMM yyyy')}`
      }));
    } else if (paymentForm.tx_type === "Rent Received") {
      setPaymentForm(prev => ({
        ...prev,
        amount: pendingInvoice ? String(pendingInvoice.current_balance) : (res.rent_amount ? String(res.rent_amount) : ""),
        remarks: pendingInvoice ? `Settle Invoice #${pendingInvoice.invoice_no}` : `Rent Payment for ${format(new Date(), 'MMMM yyyy')}`
      }));
    } else if (paymentForm.tx_type === "Advance Payment") {
      setPaymentForm(prev => ({
        ...prev,
        amount: "",
        remarks: `Advance Rent Payment`
      }));
    } else if (paymentForm.tx_type === "Maintenance Charges") {
      setPaymentForm(prev => ({
        ...prev,
        amount: res.fixed_maintenance ? String(res.fixed_maintenance) : "3000",
        remarks: `Maintenance Charges for ${format(new Date(), 'MMMM yyyy')}`
      }));
    } else if (paymentForm.tx_type === "Utility Bill") {
      setPaymentForm(prev => ({
        ...prev,
        amount: "",
        remarks: `Consolidated Utilities for ${format(new Date(), 'MMMM yyyy')}`
      }));
    } else if (paymentForm.tx_type === "Monthly Bill") {
      setPaymentForm(prev => ({
        ...prev,
        amount: "",
        remarks: `Monthly Bill Statement for ${format(new Date(), 'MMMM yyyy')}`
      }));
    } else if (paymentForm.tx_type === "General Entry") {
      setPaymentForm(prev => ({
        ...prev,
        amount: "",
        remarks: `General Transaction Update`
      }));
    }
  }, [paymentForm.tx_type, paymentForm.apartment_no, pendingInvoice, residents]);

  // Adjust Opening Balance (Step 1 adjustment action)
  const handleApplyAdjustment = async () => {
    if (!paymentForm.resident_id || !adjAmount) return;
    const amt = Number(adjAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid adjustment amount.");
      return;
    }

    setApplyingAdj(true);
    try {
      let debit = adjSide === "debit" ? amt : 0;
      let credit = adjSide === "credit" ? amt : 0;
      
      const ledgerPayload = {
        user_id: paymentForm.resident_id,
        entry_date: paymentForm.entry_date,
        entry_type: "other" as const,
        description: `[Opening Balance Adjustment - ${adjSide === "debit" ? "Increase" : "Decrease"}] ⚖️ ${adjRemarks || "Manual Adjustment"}`.trim(),
        debit,
        credit
      };

      // Post adjustment to ledger
      const res = await apiFetch<any>("/ledger", {
        method: "POST",
        body: JSON.stringify(ledgerPayload)
      });

      if (res && !res.error) {
        toast.success("Balance adjustment applied successfully!");
        setAdjAmount("");
        setAdjRemarks("");
        setShowAdjustment(false);
        // Reload resident info to reflect new outstanding balance
        if (paymentForm.apartment_no) {
          await loadResidents();
          await handleApartmentChange(paymentForm.apartment_no, "payment");
        }
      } else {
        toast.error(res?.error || "Adjustment failed");
      }
    } catch (e: any) {
      toast.error(e.message || "Could not apply adjustment");
    } finally {
      setApplyingAdj(false);
    }
  };

  // Switch request type auto-fill
  const handleReqTypeChange = (val: string) => {
    const res = residents.find(r => r.apartment_no === requestForm.apartment_no);
    let amt = requestForm.amount;
    let note = requestForm.note;
    
    if (val === 'Rent' && res?.rent_amount) {
      amt = String(res.rent_amount);
      note = `${format(new Date(), 'MMMM yyyy')} Rent`;
    } else if (val === 'Security') {
      note = 'Refundable Security Deposit';
    }
    
    setRequestForm(prev => ({
      ...prev,
      req_type: val,
      amount: amt,
      note: note
    }));
  };

  // Submit payment handler (Quick Transaction Entry + Receipt Voucher)
  const handlePostPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.resident_id || !paymentForm.amount) {
      toast.error("Please select an Apartment and fill in the Amount.");
      return;
    }

    const amt = Number(paymentForm.amount);
    if (isNaN(amt) || amt < 0) {
      toast.error("Please enter a valid non-negative numeric Amount.");
      return;
    }

    const selectedRes = residents.find(r => r.id === paymentForm.resident_id);
    if (!selectedRes) {
      toast.error("Selected resident not found.");
      return;
    }

    setSaving(true);
    try {
      // 0. Auto-apply opening balance adjustment if edited in Monthly Bill
      const originalBalance = Number(selectedRes.outstanding_balance || 0);
      const editedBalance = Number(openingBalanceInput);
      const balanceDiff = editedBalance - originalBalance;
      
      if (paymentForm.tx_type === "Monthly Bill" && Math.abs(balanceDiff) > 0.01) {
        let adjDebit = balanceDiff > 0 ? balanceDiff : 0;
        let adjCredit = balanceDiff < 0 ? Math.abs(balanceDiff) : 0;
        
        await apiFetch<any>("/ledger", {
          method: "POST",
          body: JSON.stringify({
            user_id: paymentForm.resident_id,
            entry_date: paymentForm.entry_date,
            entry_type: "other",
            description: `[Opening Balance Adjustment] ⚖️ Auto-adjustment on billing`.trim(),
            debit: adjDebit,
            credit: adjCredit
          })
        });
      }

      // Determine Debit/Credit based on Transaction Type
      let debit = 0;
      let credit = 0;
      let entryTypeDb: "rent" | "security" | "maintenance" | "other" = "other";
      let side: 'Payment' | 'Charge' | 'General' = 'Payment';

      let description = "";

      switch (paymentForm.tx_type) {
        case "Monthly Bill":
          entryTypeDb = "rent";
          side = "Charge";
          description = `[Monthly Bill] 🏢 Rent: PKR ${rentInput} | 🛠️ Maint: PKR ${maintInput} | ⚡ Elec: ${elecUnits} units @ PKR ${elecRate} = PKR ${elecAmount} | 🔥 Gas: Fixed PKR ${gasTotalCharge}. ${paymentForm.remarks}`.trim();
          debit = (Number(rentInput) || 0) + (Number(maintInput) || 0) + (Number(gasTotalCharge) || 0) + elecAmount;
          credit = 0;
          break;
        case "Monthly Rent":
          entryTypeDb = "rent";
          side = "Charge";
          description = `[Monthly Rent] 🏢 Dues for ${format(new Date(paymentForm.entry_date), 'MMMM yyyy')} ${paymentForm.remarks}`.trim();
          break;
        case "Rent Received":
          entryTypeDb = "rent";
          side = "Payment";
          description = `[Rent Received via ${paymentForm.payment_mode}] ${paymentForm.remarks}`.trim();
          break;
        case "Advance Payment":
          entryTypeDb = "rent";
          side = "Payment";
          description = `[Advance Payment via ${paymentForm.payment_mode}] ${paymentForm.remarks}`.trim();
          break;
        case "Maintenance Charges":
          entryTypeDb = "maintenance";
          side = "Charge";
          description = `[Maintenance Charges] 🛠️ Dues for ${format(new Date(paymentForm.entry_date), 'MMMM yyyy')} - ${paymentForm.remarks}`.trim();
          break;
        case "Utility Bill":
          entryTypeDb = "other";
          side = "Charge";
          const gasDesc = gasMode === "fixed" 
            ? `Gas: Fixed PKR ${gasTotalCharge}` 
            : `Gas: ${gasUnits} units @ PKR ${gasRate} = PKR ${gasTotalCharge}`;
          description = `[Utility Bill] ⚡ Elec: ${elecUnits} units @ PKR ${elecRate} = PKR ${elecAmount} | 🔥 ${gasDesc} | 💧 Water: ${waterUnits} units @ PKR ${waterRate} = PKR ${waterAmount}. ${paymentForm.remarks}`.trim();
          break;
        case "General Entry":
          entryTypeDb = "other";
          side = "General";
          debit = Number(genPaid) || 0;
          credit = Number(genReceived) || 0;
          description = `[General Entry] 📥 Received: PKR ${credit.toLocaleString()} | 📤 Paid/Charged: PKR ${debit.toLocaleString()}. ${paymentForm.remarks}`.trim();
          break;
        case "Manual Entry":
          entryTypeDb = "other";
          side = paymentForm.manual_side === "debit" ? "Charge" : "Payment";
          description = `[Manual Entry] ${paymentForm.remarks}`.trim();
          break;
        default:
          entryTypeDb = "other";
          side = "Payment";
          description = `[${paymentForm.tx_type}] ${paymentForm.remarks}`.trim();
      }

      if (paymentForm.tx_type === "General Entry" || paymentForm.tx_type === "Monthly Bill") {
        // debit and credit are already set
      } else if (side === "Charge") {
        debit = amt;
        credit = 0;
      } else { // Payment / Credit
        debit = 0;
        credit = amt;
      }

      const rvLabel = paymentForm.rv_number ? ` (RV: ${paymentForm.rv_number})` : "";
      const finalDescription = `${description}${rvLabel}`;

      const payload = {
        user_id: paymentForm.resident_id,
        entry_date: paymentForm.entry_date,
        entry_type: entryTypeDb,
        description: finalDescription,
        debit,
        credit,
        voucher_no: paymentForm.rv_number || undefined
      };

      // 1. Post to ledger
      const ledgerRes = await apiFetch<any>("/ledger", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (ledgerRes && !ledgerRes.error) {
        const isCharge = side === "Charge";
        
        // 2. Automate Monthly Billing (Invoices Table Sync)
        if (isCharge) {
          const invoiceNo = `INV-${paymentForm.tx_type === "Utility Bill" ? "UTIL" : paymentForm.tx_type === "Monthly Bill" ? "MBL" : paymentForm.tx_type === "Maintenance Charges" ? "MNT" : "RNT"}-${paymentForm.apartment_no}-${Date.now().toString().slice(-6)}`;
          const prevArrears = Number(paymentForm.tx_type === "Monthly Bill" ? openingBalanceInput : selectedRes.outstanding_balance || 0);
          const grandTotal = paymentForm.tx_type === "Monthly Bill" ? amt : amt + prevArrears;
          const currentDues = paymentForm.tx_type === "Monthly Bill" ? amt - prevArrears : amt;

          let invoiceData: any = {
            invoice_no: invoiceNo,
            date: paymentForm.entry_date,
            tenant_id: paymentForm.resident_id,
            apartment_no: paymentForm.apartment_no,
            prev_reading: 0,
            curr_reading: 0,
            units_consumed: 0,
            electricity_amount: 0,
            gas_charges: 0,
            water_charges: 0,
            flat_rent: 0,
            maintenance_charges: 0,
            previous_arrears: prevArrears,
            total_bill_amount: currentDues,
            amount_received: 0,
            current_balance: currentDues,
            grand_total: grandTotal,
            water_units: 0,
            gas_units: 0,
            parking_charges: 0,
            stall_charges: 0,
            security_charges: 0,
            other_charges: 0
          };

          if (paymentForm.tx_type === "Utility Bill") {
            invoiceData.prev_reading = elecPrev;
            invoiceData.curr_reading = elecPrev + elecUnits;
            invoiceData.units_consumed = elecUnits;
            invoiceData.electricity_amount = elecAmount;
            invoiceData.gas_charges = gasTotalCharge;
            invoiceData.gas_units = gasUnits;
            invoiceData.water_charges = waterAmount;
            invoiceData.water_units = waterUnits;
          } else if (paymentForm.tx_type === "Monthly Bill") {
            invoiceData.flat_rent = Number(rentInput);
            invoiceData.maintenance_charges = Number(maintInput);
            invoiceData.gas_charges = gasTotalCharge;
            invoiceData.prev_reading = elecPrev;
            invoiceData.curr_reading = elecPrev + elecUnits;
            invoiceData.units_consumed = elecUnits;
            invoiceData.electricity_amount = elecAmount;
          } else if (paymentForm.tx_type === "Maintenance Charges") {
            invoiceData.maintenance_charges = amt;
          } else if (paymentForm.tx_type === "Monthly Rent") {
            invoiceData.flat_rent = amt;
          } else {
            invoiceData.other_charges = amt;
          }

          // Insert invoice record
          await apiFetch("/query-bridge", {
            method: "POST",
            body: JSON.stringify({
              table: "invoices",
              action: "insert",
              data: invoiceData
            })
          });

          // 3. Update resident readings in DB if utility or monthly bill
          if (paymentForm.tx_type === "Utility Bill" || paymentForm.tx_type === "Monthly Bill") {
            let userUpdateData: any = {
              elec_prev: elecPrev + elecUnits,
              elec_curr: elecPrev + elecUnits,
            };
            if (paymentForm.tx_type === "Utility Bill") {
              userUpdateData.water_prev = waterPrev + waterUnits;
              userUpdateData.water_curr = waterPrev + waterUnits;
              if (gasMode === "units") {
                userUpdateData.gas_prev = gasPrev + gasUnits;
                userUpdateData.gas_curr = gasPrev + gasUnits;
              }
            }
            await apiFetch("/query-bridge", {
              method: "POST",
              body: JSON.stringify({
                table: "users",
                action: "update",
                filters: [{ column: "id", value: paymentForm.resident_id }],
                data: userUpdateData
              })
            });
          }

        } else if (side === "Payment") {
          // If it is a payment (credit), update open invoices if exists
          if (pendingInvoice && applyToInvoice) {
            const newAmtReceived = Number(pendingInvoice.amount_received || 0) + amt;
            const newCurrentBalance = Math.max(0, Number(pendingInvoice.current_balance || 0) - amt);
            
            await apiFetch("/query-bridge", {
              method: "POST",
              body: JSON.stringify({
                table: "invoices",
                action: "update",
                filters: [{ column: "invoice_no", value: pendingInvoice.invoice_no }],
                data: {
                  amount_received: newAmtReceived,
                  current_balance: newCurrentBalance,
                  date: paymentForm.entry_date
                }
              })
            });
          }
        }

        toast.success("Transaction recorded successfully!");

        // Set success states to show the success print view
        const finalTxData = {
          date: paymentForm.entry_date,
          apartment_no: paymentForm.apartment_no,
          resident_name: paymentForm.resident_name,
          type: paymentForm.tx_type,
          amount: paymentForm.tx_type === "General Entry" ? Math.abs(debit - credit) : amt,
          payment_mode: paymentForm.tx_type === "General Entry" ? "Journal Adjustment" : (isChargeType ? "Invoice Debit" : paymentForm.payment_mode),
          rv_number: paymentForm.rv_number || ledgerRes.entry?.voucher_no || "N/A",
          remarks: paymentForm.remarks
        };
        
        setLastRecordedTx(finalTxData);
        setTxSuccess(true);

        // Auto-download PDF Receipt for all transactions
        setTimeout(() => {
          printReceiptPDF(finalTxData);
        }, 300);

        await loadResidents();
        if (onSuccess) onSuccess();
      } else {
        toast.error(ledgerRes?.error || "Failed to record transaction.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save transaction.");
    } finally {
      setSaving(false);
    }
  };

  // Submit payment request handler
  const handlePostRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestForm.resident_id || !requestForm.amount) {
      toast.error("Please select an Apartment and fill in the Amount.");
      return;
    }

    const amt = Number(requestForm.amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid positive numeric Amount.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('payment_requests').insert({
        resident_id: requestForm.resident_id,
        apartment_no: requestForm.apartment_no,
        bill_type: requestForm.req_type.toLowerCase(),
        category: requestForm.req_type,
        type: requestForm.action,
        amount: amt,
        due_date: requestForm.due_date || null,
        method: 'bank_transfer',
        note: requestForm.note || null,
        status: 'pending'
      });

      if (error) throw error;
      
      toast.success(`Payment request sent to ${requestForm.resident_name}`);
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Failed to create payment request:", err);
      toast.error("Could not create payment request");
    } finally {
      setSaving(false);
    }
  };

  // Generate Receipt PDF
  const printReceiptPDF = (txData = lastRecordedTx) => {
    if (!txData) return;
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const goldColor = [197, 160, 89]; 
      const navyColor = [15, 23, 42]; 
      const grayColor = [100, 116, 139]; 

      const drawReceipt = (offset: number, copyType: "Client Copy" | "Office Record") => {
        doc.setFillColor(navyColor[0], navyColor[1], navyColor[2]);
        doc.rect(0, offset + 10, 210, 20, "F");

        doc.setFillColor(goldColor[0], goldColor[1], goldColor[2]);
        doc.rect(0, offset + 30, 210, 1, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(13);
        doc.text("MARGALLA GATEWAY", 15, offset + 22);
        
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text("E-11/4, Street No 26-A, Islamabad - Cash / Bank Receipt", 15, offset + 27);

        const rvText = txData.rv_number || "N/A";
        doc.setFillColor(goldColor[0], goldColor[1], goldColor[2]);
        doc.rect(155, offset + 16, 40, 8, "F");
        doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text(`VOUCHER: ${rvText}`, 158, offset + 21.5);

        let titleLabel = "PAYMENT RECEIPT";
        if (txData.type === "Rent Received") titleLabel = "RENT PAYMENT RECEIPT";
        else if (txData.type === "Monthly Rent") titleLabel = "MONTHLY RENT INVOICE";
        else if (txData.type === "Monthly Bill") titleLabel = "MONTHLY BILL INVOICE";
        else if (txData.type === "Maintenance Charges") titleLabel = "MAINTENANCE CHARGES DEBIT";
        else if (txData.type === "Utility Bill") titleLabel = "CONSOLIDATED UTILITIES BILL DEBIT";
        else if (txData.type === "Opening Balance Adjustment") titleLabel = "BALANCE ADJUSTMENT VOUCHER";
        else if (txData.type === "Manual Entry") titleLabel = "JOURNAL ENTRY VOUCHER";
        else if (txData.type === "General Entry") titleLabel = "GENERAL ENTRY RECEIPT";

        doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
        doc.setFontSize(10.5);
        doc.setFont("Helvetica", "bold");
        doc.text(`${titleLabel} - ${copyType.toUpperCase()}`, 15, offset + 38);

        let leftDetails = [
          { label: "Date / تاریخ:", value: txData.date },
          { label: "Resident / مقیم کا نام:", value: txData.resident_name },
          { label: "Payment Mode / ذریعہ:", value: txData.payment_mode || "—" }
        ];

        let rightDetails = [
          { label: "Apartment / فلیٹ نمبر:", value: txData.apartment_no },
          { label: "Voucher Type / قسم:", value: txData.type },
          { label: "Remarks / تفصیل:", value: txData.remarks || "—" }
        ];

        if (txData.type === "General Entry") {
          leftDetails = [
            { label: "Date / تاریخ:", value: txData.date },
            { label: "Resident / مقیم کا نام:", value: txData.resident_name },
            { label: "Received / وصول شدہ:", value: `PKR ${Number(genReceived || 0).toLocaleString()}` }
          ];
          rightDetails = [
            { label: "Apartment / فلیٹ نمبر:", value: txData.apartment_no },
            { label: "Paid/Charged / ادا شدہ:", value: `PKR ${Number(genPaid || 0).toLocaleString()}` },
            { label: "Remarks / تفصیل:", value: txData.remarks || "—" }
          ];
        }

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8.5);

        let y = offset + 48;
        for (const item of leftDetails) {
          doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
          doc.text(item.label, 15, y);
          doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
          doc.setFont("Helvetica", "bold");
          doc.text(String(item.value), 45, y);
          doc.setFont("Helvetica", "normal");

          doc.setDrawColor(240, 240, 240);
          doc.line(15, y + 2, 100, y + 2);
          y += 8;
        }

        y = offset + 48;
        for (const item of rightDetails) {
          doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
          doc.text(item.label, 110, y);
          doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
          doc.setFont("Helvetica", "bold");
          
          let valText = String(item.value);
          if (item.label.includes("Remarks") && valText.length > 35) {
            valText = valText.substring(0, 32) + "...";
          }
          doc.text(valText, 142, y);
          doc.setFont("Helvetica", "normal");

          doc.setDrawColor(240, 240, 240);
          doc.line(110, y + 2, 195, y + 2);
          y += 8;
        }

        doc.setFillColor(248, 250, 252); 
        doc.rect(15, offset + 78, 180, 14, "F");
        doc.setDrawColor(goldColor[0], goldColor[1], goldColor[2]);
        doc.rect(15, offset + 78, 180, 14, "D");

        doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9.5);

        let totalLabel = "TOTAL AMOUNT / کل رقم:";
        let amtFormatted = `PKR ${Number(txData.amount).toLocaleString()}/-`;
        if (txData.type === "General Entry") {
          const net = (Number(genPaid) || 0) - (Number(genReceived) || 0);
          totalLabel = "NET BALANCE CHANGE / نیٹ تبدیلی:";
          amtFormatted = `PKR ${net.toLocaleString()}/- (${net > 0 ? "Debit" : "Credit"})`;
        }

        doc.text(totalLabel, 22, offset + 87);

        doc.setFontSize(11);
        doc.setTextColor(16, 185, 129); 
        doc.text(amtFormatted, 130, offset + 87);

        doc.setDrawColor(navyColor[0], navyColor[1], navyColor[2]);
        doc.line(15, offset + 115, 65, offset + 115);
        doc.line(145, offset + 115, 195, offset + 115);

        doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
        doc.setFontSize(7.5);
        doc.text("Authorized Signature / مجاز دستخط", 20, offset + 119);
        doc.text("Resident Signature / مقیم کے دستخط", 150, offset + 119);

        doc.setFontSize(6.5);
        doc.text("This is a computer generated transaction receipt. Powered by Margalla Gateway Management System ERP.", 40, offset + 130);
      };

      drawReceipt(0, "Client Copy");

      doc.setDrawColor(150, 150, 150);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(0, 148.5, 210, 148.5);
      doc.setLineDashPattern([], 0); 

      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("----------------------- CUT HERE / یہاں سے کاٹیں -----------------------", 60, 148);

      drawReceipt(148.5, "Office Record");

      doc.save(`MG_Receipt_${txData.apartment_no}_${txData.date}.pdf`);
      toast.success("Receipt PDF downloaded successfully!");
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to generate PDF Receipt");
    }
  };

  const printReceiptDirect = () => {
    if (!lastRecordedTx) return;
    
    let amountSection = `<div class="total-box">TOTAL AMOUNT: PKR ${Number(lastRecordedTx.amount).toLocaleString()}/-</div>`;
    if (lastRecordedTx.type === "General Entry") {
      const net = (Number(genPaid) || 0) - (Number(genReceived) || 0);
      amountSection = `
        <div class="row"><span>Amount Received:</span> <span>PKR ${Number(genReceived || 0).toLocaleString()}</span></div>
        <div class="row"><span>Amount Paid/Charged:</span> <span>PKR ${Number(genPaid || 0).toLocaleString()}</span></div>
        <div class="total-box">NET BALANCE CHANGE: PKR ${net.toLocaleString()}/- (${net > 0 ? "Debit" : "Credit"})</div>
      `;
    }

    const generateVoucherCard = (copyType: string) => `
      <div class="invoice-card">
        <div class="copy-label">${copyType}</div>
        <div class="header">
          <div class="logo-area">
            <h1>MARGALLA GATEWAY</h1>
            <p>E-11/4, Street No 26-A, Islamabad, Pakistan</p>
          </div>
          <div class="invoice-title-area">
            <h2>${lastRecordedTx.type.toUpperCase()} VOUCHER</h2>
            <p>RV NO: <strong>${lastRecordedTx.rv_number || "—"}</strong></p>
          </div>
        </div>
        
        <div class="row"><span>Date:</span> <span>${lastRecordedTx.date}</span></div>
        <div class="row"><span>Apartment No:</span> <span>${lastRecordedTx.apartment_no}</span></div>
        <div class="row"><span>Resident Name:</span> <span>${lastRecordedTx.resident_name}</span></div>
        <div class="row"><span>Payment Method:</span> <span>${lastRecordedTx.payment_mode}</span></div>
        <div class="row"><span>Remarks:</span> <span>${lastRecordedTx.remarks || "—"}</span></div>
        
        ${amountSection}
        
        <div class="signatures">
          <div class="sig-line">Officer Signature</div>
          <div class="sig-line">Resident Signature</div>
        </div>
        
        <div class="footer">
          This is an electronically generated receipt. Powered by Margalla Gateway ERP.
        </div>
      </div>
    `;

    const html = `<!DOCTYPE html>
      <html>
        <head>
          <title>Receipt Voucher - ${lastRecordedTx.rv_number || "RV"}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
            body { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; padding: 20px; color: #0f2346; line-height: 1.5; margin: 0; background: #fff; }
            .page-wrapper { max-width: 210mm; margin: 0 auto; display: flex; flex-direction: column; }
            .invoice-card { background-color: #ffffff; border: 1px solid #e2e8f0; border-top: 4px solid #0f2346; padding: 20px; box-sizing: border-box; position: relative; height: 135mm; display: flex; flex-direction: column; }
            .copy-label { position: absolute; top: 10px; right: 20px; background: #eee; padding: 4px 10px; font-size: 10px; font-weight: bold; border-radius: 4px; border: 1px solid #ccc; text-transform: uppercase; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 15px; }
            .logo-area h1 { margin: 0; font-size: 16pt; font-weight: 800; }
            .logo-area p { margin: 2px 0 0; font-size: 9pt; color: #4a5568; }
            .invoice-title-area { text-align: right; }
            .invoice-title-area h2 { margin: 0; font-size: 14pt; color: #0f2346; font-weight: 800; }
            .invoice-title-area p { margin: 4px 0 0; font-size: 10pt; font-family: monospace; font-weight: bold; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px dashed #ddd; padding-bottom: 4px; font-size: 11pt; }
            .row span:first-child { color: #4a5568; font-weight: 600; }
            .row span:last-child { font-weight: 800; color: #0f2346; }
            .total-box { background: #f8fafc; border: 2px solid #0f2346; padding: 12px; text-align: center; margin-top: 15px; font-size: 13pt; font-weight: 800; color: #0f2346; }
            .signatures { display: flex; justify-content: space-between; margin-top: auto; font-size: 10pt; padding-top: 30px; }
            .sig-line { border-top: 1px solid #0f2346; width: 150px; text-align: center; padding-top: 5px; font-weight: 600; }
            .footer { margin-top: 15px; text-align: center; font-size: 8pt; color: #718096; border-top: 1px dashed #e2e8f0; padding-top: 8px; }
            .cut-line { text-align: center; color: #cbd5e0; font-size: 8pt; letter-spacing: 4px; padding: 5px 0; font-weight: 800; border-bottom: 1px dashed #ccc; margin: 4mm 0; line-height: 0.1em; }
            .cut-line span { background: #fff; padding: 0 10px; }
            @media print {
              @page { size: A4 portrait; margin: 5mm; }
              body { padding: 0; background: #fff; }
              .page-wrapper { gap: 0; }
              .cut-line { display: block; }
            }
          </style>
        </head>
        <body>
          <div class="page-wrapper">
            ${generateVoucherCard("Office Copy")}
            <div class="cut-line"><span>✂ CUT HERE ✂</span></div>
            ${generateVoucherCard("Customer Copy")}
          </div>
        </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => { try { document.body.removeChild(iframe); } catch (_) {} }, 2000);
      }, 500);
    }
  };

  const shareWhatsApp = () => {
    if (!lastRecordedTx) return;
    const phone = selectedResident?.phone || "";
    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "92" + cleanPhone.slice(1);
    } else if (cleanPhone.length === 10) {
      cleanPhone = "92" + cleanPhone;
    }
    
    let msg = `*MARGALLA GATEWAY - TRANSACTION RECEIPT*\n\n`;
    msg += `*Voucher/Ref:* ${lastRecordedTx.rv_number}\n`;
    msg += `*Date:* ${lastRecordedTx.date}\n`;
    msg += `*Unit / Apartment:* ${lastRecordedTx.apartment_no}\n`;
    msg += `*Resident:* ${lastRecordedTx.resident_name}\n`;
    msg += `*Transaction:* ${lastRecordedTx.type}\n`;
    
    if (lastRecordedTx.type === "General Entry") {
      msg += `*Received (Credit):* PKR ${Number(genReceived || 0).toLocaleString()}/-\n`;
      msg += `*Paid (Debit):* PKR ${Number(genPaid || 0).toLocaleString()}/-\n`;
      const net = (Number(genPaid) || 0) - (Number(genReceived) || 0);
      msg += `*Net Balance Change:* PKR ${net.toLocaleString()}/- (${net > 0 ? "Debit Dues" : "Credit Balance"})\n`;
    } else if (lastRecordedTx.type === "Monthly Bill") {
      msg += `*Rent:* PKR ${Number(rentInput || 0).toLocaleString()}/-\n`;
      msg += `*Maintenance:* PKR ${Number(maintInput || 0).toLocaleString()}/-\n`;
      msg += `*Gas (Fixed):* PKR ${Number(gasAmount || 0).toLocaleString()}/-\n`;
      msg += `*Electricity:* ${elecUnitsInput} units = PKR ${elecAmount.toLocaleString()}/-\n`;
      msg += `*Opening Balance:* PKR ${Number(openingBalanceInput || 0).toLocaleString()}/-\n`;
      msg += `*Total Current Bill:* PKR ${Number(lastRecordedTx.amount).toLocaleString()}/-\n`;
      const net = Number(lastRecordedTx.amount) + (Number(openingBalanceInput) || 0);
      msg += `*Net Total Due:* PKR ${net.toLocaleString()}/-\n`;
    } else {
      msg += `*Amount:* PKR ${Number(lastRecordedTx.amount).toLocaleString()}/-\n`;
    }
    
    if (lastRecordedTx.payment_mode && lastRecordedTx.type !== "Monthly Bill") {
      msg += `*Payment Mode:* ${lastRecordedTx.payment_mode}\n`;
    }
    
    if (lastRecordedTx.remarks) {
      msg += `*Remarks:* ${lastRecordedTx.remarks}\n`;
    }
    
    const freshRes = residents.find(r => r.id === paymentForm.resident_id);
    const newBal = freshRes ? Number(freshRes.outstanding_balance) : null;
    if (newBal !== null) {
      msg += `*Outstanding Balance:* PKR ${newBal.toLocaleString()}/-\n`;
    }
    
    msg += `\nThank you. Powered by Margalla Gateway ERP.`;

    const encodedMsg = encodeURIComponent(msg);
    const url = `https://wa.me/${cleanPhone ? cleanPhone : ""}?text=${encodedMsg}`;
    window.open(url, "_blank");
  };

  const isDarkIndex = theme === "dark" || (theme === "default" && window.location.pathname === "/admin");
  const selectedResident = residents.find(r => r.id === paymentForm.resident_id);

  // Check if current tx type is a debit charge
  const isChargeType = ["Utility Bill", "Monthly Bill", "Maintenance Charges", "Monthly Rent"].includes(paymentForm.tx_type) || 
    (paymentForm.tx_type === "Manual Entry" && paymentForm.manual_side === "debit") ||
    (paymentForm.tx_type === "Opening Balance Adjustment" && paymentForm.adj_side === "debit");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={`max-w-xl border overflow-y-auto max-h-[92vh] rounded-2xl shadow-elegant ${
        isDarkIndex 
          ? "bg-[#0d1527] border-amber-500/20 text-white" 
          : "bg-card border-border/80 text-foreground"
      }`}>
        
        {txSuccess ? (
          /* SUCCESS PRINT SCREEN */
          <div className="py-6 space-y-6 text-center">
            <DialogHeader>
              <DialogTitle className="text-center font-bold text-lg text-emerald-400 flex items-center justify-center gap-2">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center animate-bounce">
                  <Check className="h-6 w-6 text-emerald-400" />
                </div>
                Transaction Processed
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">The transaction has been successfully synced with the ledger & monthly billing.</p>
              
              {lastRecordedTx && (
                <div className={`p-5 rounded-2xl border text-left font-mono text-xs space-y-2.5 ${
                  isDarkIndex ? "bg-black/35 border-white/5" : "bg-muted/40 border-border/40"
                }`}>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-muted-foreground text-[10px] uppercase font-bold">Type:</span>
                    <span className="font-bold text-[#d4af37]">{lastRecordedTx.type}</span>
                  </div>
                  {lastRecordedTx.type === "General Entry" ? (
                    <>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-muted-foreground text-[10px] uppercase font-bold">Amount Received:</span>
                        <span className="font-bold text-emerald-400">PKR {Number(genReceived || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-muted-foreground text-[10px] uppercase font-bold">Amount Paid/Charged:</span>
                        <span className="font-bold text-rose-400">PKR {Number(genPaid || 0).toLocaleString()}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-muted-foreground text-[10px] uppercase font-bold">Total Amount:</span>
                      <span className="font-bold text-emerald-400 font-mono text-sm">PKR {Number(lastRecordedTx.amount).toLocaleString()}/-</span>
                    </div>
                  )}
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-muted-foreground text-[10px] uppercase font-bold">Unit / Apartment:</span>
                    <span className="font-bold">{lastRecordedTx.apartment_no}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-[10px] uppercase font-bold">Voucher RV:</span>
                    <span className="font-bold text-amber-500 font-mono">{lastRecordedTx.rv_number || "None"}</span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-col gap-2.5 mt-4 sm:flex-row w-full">
              <Button 
                onClick={printReceiptDirect} 
                className="flex-1 bg-gradient-to-r from-amber-500 to-[#d4af37] text-black font-black uppercase text-xs h-10 flex items-center justify-center gap-1.5 hover:opacity-90 animate-fade-in"
              >
                <Printer className="h-4 w-4" />
                Print Receipt
              </Button>
              <Button 
                onClick={() => printReceiptPDF()} 
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs h-10 flex items-center justify-center gap-1.5"
              >
                <FileText className="h-4 w-4" />
                Download PDF
              </Button>
              <Button 
                onClick={shareWhatsApp} 
                className="flex-1 bg-[#25D366] hover:bg-[#20ba5a] text-white font-black uppercase text-xs h-10 flex items-center justify-center gap-1.5"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.437.002 9.861-4.416 9.863-9.848.001-2.63-1.019-5.101-2.874-6.958C16.402 1.94 13.933.922 11.317.92 5.88.918 1.458 5.332 1.456 10.765c-.001 1.562.415 3.09 1.202 4.47l-.985 3.598 3.69-.968.684.405zm12.355-6.31c-.328-.163-1.94-.957-2.24-1.066-.3-.11-.518-.163-.737.163-.219.328-.847 1.066-1.038 1.284-.19.219-.382.245-.71.082-.328-.163-1.386-.51-2.638-1.628-.975-.87-1.633-1.946-1.825-2.274-.19-.328-.02-.505.143-.668.148-.146.328-.382.492-.573.163-.19.219-.328.328-.546.11-.219.055-.41-.027-.573-.082-.163-.737-1.777-1.01-2.434-.266-.643-.538-.553-.737-.563-.19-.01-.41-.01-.628-.01-.219 0-.573.082-.875.41-.302.328-1.148 1.12-1.148 2.73 0 1.61 1.175 3.168 1.339 3.387.163.219 2.31 3.528 5.597 4.945.781.337 1.39.539 1.86.688.783.249 1.497.214 2.06.13.629-.094 1.94-.794 2.215-1.529.275-.735.275-1.365.19-1.497-.082-.13-.302-.219-.628-.382z"/>
                </svg>
              </Button>
              <Button 
                variant="outline" 
                onClick={onClose} 
                className={`flex-1 h-10 text-xs ${isDarkIndex ? "border-white/10 hover:bg-white/5 text-white bg-transparent" : ""}`}
              >
                Close Window
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <DialogHeader className="border-b border-white/5 pb-3">
              <DialogTitle className={`flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] ${
                isDarkIndex ? "text-[#d4af37]" : "text-amber-500"
              }`}>
                <ReceiptText className="h-5 w-5 text-[#d4af37]" />
                Executive Transaction Panel
              </DialogTitle>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className={`grid w-full grid-cols-2 p-1 rounded-xl ${
                isDarkIndex ? "bg-black/45 border border-white/5" : "bg-muted"
              }`}>
                <TabsTrigger 
                  value="payment" 
                  className={`text-xs py-2 rounded-lg font-bold transition-all cursor-pointer ${
                    activeTab === "payment"
                      ? isDarkIndex
                        ? "bg-gradient-to-r from-amber-500 to-[#d4af37] text-black font-black"
                        : "bg-[#fff] text-black font-bold shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Record Entry
                </TabsTrigger>
                <TabsTrigger 
                  value="request" 
                  className={`text-xs py-2 rounded-lg font-bold transition-all cursor-pointer ${
                    activeTab === "request"
                      ? isDarkIndex
                        ? "bg-gradient-to-r from-amber-500 to-[#d4af37] text-black font-black"
                        : "bg-[#fff] text-black font-bold shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Create Bill Request
                </TabsTrigger>
              </TabsList>

              {/* ================= RECORD PAYMENT / LEDGER ENTRY TAB ================= */}
              <TabsContent value="payment" className="mt-4 focus-visible:outline-none space-y-4">
                <form onSubmit={handlePostPayment} className="space-y-4 font-sans">
                  
                  {/* STEP 1: RESIDENT & OPENING BALANCE */}
                  <div className={`p-4 rounded-2xl border space-y-4 ${
                    isDarkIndex ? "bg-black/20 border-white/5" : "bg-muted/40 border-border/40"
                  }`}>
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <span className="h-5 w-5 rounded-full bg-[#d4af37]/10 text-[#d4af37] flex items-center justify-center font-bold text-xs border border-[#d4af37]/35">1</span>
                      <h4 className="text-xs font-black uppercase tracking-wider text-[#d4af37]">Resident & Opening Balance</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Unit / Apartment</Label>
                        <Select 
                          value={paymentForm.apartment_no || "none"} 
                          onValueChange={(val) => handleApartmentChange(val, "payment")}
                        >
                          <SelectTrigger className={`h-9 text-xs focus-visible:ring-[#d4af37] ${isDarkIndex ? "bg-black/30 border-white/10 text-white" : ""}`}>
                            <SelectValue placeholder="Select Unit" />
                          </SelectTrigger>
                          <SelectContent className={isDarkIndex ? "bg-[#0d1527] text-white border-white/10" : ""}>
                            <SelectItem value="none">Choose Unit...</SelectItem>
                            {residents.filter(r => r.apartment_no).map((r) => (
                              <SelectItem key={r.id} value={r.apartment_no}>
                                Unit {r.apartment_no} - {r.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Resident Name</Label>
                        <Input 
                          value={paymentForm.resident_name || "—"} 
                          readOnly 
                          className={`h-9 text-xs bg-white/5 border-white/10 text-slate-400 font-semibold cursor-not-allowed`}
                        />
                      </div>
                    </div>

                    {selectedResident && (
                      <div className="space-y-3 pt-2 border-t border-white/5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground font-semibold">Current Outstanding Balance:</span>
                          <span className={`font-mono font-bold text-sm ${
                            Number(selectedResident.outstanding_balance || 0) > 0 ? "text-rose-400" : "text-emerald-400"
                          }`}>
                            PKR {Number(selectedResident.outstanding_balance || 0).toLocaleString()}/-
                          </span>
                        </div>

                        {/* Adjustment option */}
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 font-bold cursor-pointer text-[10px] uppercase tracking-wider text-[#d4af37] hover:text-white">
                            <input 
                              type="checkbox" 
                              checked={showAdjustment} 
                              onChange={(e) => setShowAdjustment(e.target.checked)}
                              className="rounded accent-[#d4af37]" 
                            />
                            ⚙️ Adjust Balance
                          </label>

                          {showAdjustment && (
                            <div className="p-3 bg-black/30 border border-white/5 rounded-xl space-y-3 mt-2">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setAdjSide("debit")}
                                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 border transition cursor-pointer ${
                                    adjSide === "debit"
                                      ? "bg-rose-500/10 border-rose-500/40 text-rose-400"
                                      : "bg-black/20 border-white/5 text-gray-400"
                                  }`}
                                >
                                  Increase Balance (Debit)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAdjSide("credit")}
                                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 border transition cursor-pointer ${
                                    adjSide === "credit"
                                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                                      : "bg-black/20 border-white/5 text-gray-400"
                                  }`}
                                >
                                  Decrease Balance (Credit)
                                </button>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <Label className="text-[9px] text-muted-foreground uppercase font-bold block mb-1">Adj Amount (PKR)</Label>
                                  <Input 
                                    type="number" 
                                    placeholder="0"
                                    value={adjAmount}
                                    onChange={e => setAdjAmount(e.target.value)}
                                    className="h-7 text-[10px] font-mono focus-visible:ring-[#d4af37]"
                                  />
                                </div>
                                <div className="flex items-end">
                                  <Button
                                    type="button"
                                    onClick={handleApplyAdjustment}
                                    disabled={applyingAdj || !adjAmount || Number(adjAmount) <= 0}
                                    className="h-7 text-[9px] font-black uppercase tracking-wider w-full bg-amber-500 hover:bg-amber-600 text-black border-0"
                                  >
                                    {applyingAdj ? "Applying..." : "Apply Adjustment"}
                                  </Button>
                                </div>
                              </div>

                              <div>
                                <Label className="text-[9px] text-muted-foreground uppercase font-bold block mb-1">Adj Remarks</Label>
                                <Input 
                                  placeholder="Reason for adjustment"
                                  value={adjRemarks}
                                  onChange={e => setAdjRemarks(e.target.value)}
                                  className="h-7 text-[10px] focus-visible:ring-[#d4af37]"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* STEP 2: TRANSACTION DETAILS */}
                  <div className={`p-4 rounded-2xl border space-y-4 ${
                    isDarkIndex ? "bg-black/20 border-white/5" : "bg-muted/40 border-border/40"
                  }`}>
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <span className="h-5 w-5 rounded-full bg-[#d4af37]/10 text-[#d4af37] flex items-center justify-center font-bold text-xs border border-[#d4af37]/35">2</span>
                      <h4 className="text-xs font-black uppercase tracking-wider text-[#d4af37]">Transaction & Billing Type</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block mb-1">Transaction Type</Label>
                        <Select 
                          value={paymentForm.tx_type} 
                          onValueChange={val => {
                            setPaymentForm({ ...paymentForm, tx_type: val });
                            const isPaymentType = ["Rent Received", "Advance Payment", "Utility Bill", "Monthly Bill", "Maintenance Charges", "General Entry"].includes(val);
                            setApplyToInvoice(isPaymentType);
                          }}
                        >
                          <SelectTrigger className={`h-9 text-xs focus-visible:ring-[#d4af37] ${isDarkIndex ? "bg-black/30 border-white/10 text-white" : ""}`}>
                            <SelectValue placeholder="Select Type" />
                          </SelectTrigger>
                          <SelectContent className={isDarkIndex ? "bg-[#0d1527] text-white border-white/10" : ""}>
                            <SelectItem value="Monthly Bill">Monthly Bill (Consolidated Charge)</SelectItem>
                            <SelectItem value="Monthly Rent">Monthly Rent (Charge)</SelectItem>
                            <SelectItem value="Rent Received">Rent Received (Payment)</SelectItem>
                            <SelectItem value="Utility Bill">Utility Bill (Charge)</SelectItem>
                            <SelectItem value="Maintenance Charges">Maintenance Charges (Charge)</SelectItem>
                            <SelectItem value="Advance Payment">Advance Payment (Credit)</SelectItem>
                            <SelectItem value="General Entry">General Entry (Received/Paid)</SelectItem>
                            <SelectItem value="Manual Entry">Manual Ledger Entry</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* PENDING INVOICE BANNER */}
                      {pendingInvoice && ["Rent Received", "Advance Payment", "Utility Bill", "Monthly Bill", "Maintenance Charges"].includes(paymentForm.tx_type) && (
                        <div className={`p-2.5 rounded-xl border flex flex-col gap-1 text-[11px] ${
                          isDarkIndex 
                            ? "bg-amber-500/5 border-yellow-500/20 text-amber-200" 
                            : "bg-amber-50 border-amber-200 text-amber-800"
                        }`}>
                          <div className="flex justify-between items-center font-bold">
                            <span className="text-[9px] uppercase tracking-wider">Unpaid Invoice</span>
                            <span className="font-mono text-[9px] text-[#d4af37]">#{pendingInvoice.invoice_no}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>Pending Dues:</span>
                            <span className="font-bold font-mono">PKR {Number(pendingInvoice?.current_balance || 0).toLocaleString()}</span>
                          </div>
                          <label className="flex items-center gap-1.5 mt-1 font-semibold cursor-pointer text-[9px] text-muted-foreground hover:text-white">
                            <input 
                              type="checkbox" 
                              checked={applyToInvoice} 
                              onChange={(e) => setApplyToInvoice(e.target.checked)}
                              className="rounded accent-[#d4af37]" 
                            />
                            Link & Settle
                          </label>
                        </div>
                      )}
                    </div>

                    {/* ================= DYNAMIC CONSOLIDATED MONTHLY BILL FORM ================= */}
                    {paymentForm.tx_type === "Monthly Bill" && (
                      <div className={`p-4 rounded-2xl border space-y-4 ${
                        isDarkIndex ? "bg-black/35 border-[#d4af37]/25" : "bg-slate-50 border-slate-200"
                      }`}>
                        <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
                          <FileText className="h-4 w-4 text-[#d4af37]" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-[#d4af37]">Monthly Bill Details</h4>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <Label className="text-[9px] text-muted-foreground uppercase font-bold block mb-1">Lease Rent (PKR)</Label>
                            <Input 
                              type="number" 
                              value={rentInput} 
                              onChange={e => setRentInput(e.target.value)} 
                              className="h-8 text-xs font-mono focus-visible:ring-[#d4af37]"
                            />
                          </div>
                          <div>
                            <Label className="text-[9px] text-muted-foreground uppercase font-bold block mb-1">Maintenance (PKR)</Label>
                            <Input 
                              type="number" 
                              value={maintInput} 
                              onChange={e => setMaintInput(e.target.value)} 
                              className="h-8 text-xs font-mono focus-visible:ring-[#d4af37]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs border-t border-white/5 pt-3">
                          <div>
                            <Label className="text-[9px] text-muted-foreground uppercase font-bold block mb-1">Fixed Sui Gas (PKR)</Label>
                            <Input 
                              type="number" 
                              value={gasAmount} 
                              onChange={e => setGasAmount(e.target.value)} 
                              className="h-8 text-xs font-mono focus-visible:ring-[#d4af37]"
                            />
                          </div>
                          <div>
                            <Label className="text-[9px] text-muted-foreground uppercase font-bold block mb-1">Electricity Units Used</Label>
                            <Input 
                              type="number" 
                              placeholder="0"
                              value={elecUnitsInput} 
                              onChange={e => setElecUnitsInput(e.target.value)} 
                              className="h-8 text-xs font-mono focus-visible:ring-[#d4af37]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs border-t border-white/5 pt-3">
                          <div>
                            <Label className="text-[9px] text-muted-foreground uppercase font-bold block mb-1">Electricity Rate (PKR/Unit)</Label>
                            <Input 
                              type="number" 
                              value={elecRate} 
                              onChange={e => setElecRate(Number(e.target.value))} 
                              className="h-8 text-xs font-mono focus-visible:ring-[#d4af37]"
                            />
                          </div>
                          <div>
                            <Label className="text-[9px] text-muted-foreground uppercase font-bold block mb-1">Opening Balance / Arrears (PKR)</Label>
                            <Input 
                              type="number" 
                              value={openingBalanceInput} 
                              onChange={e => setOpeningBalanceInput(e.target.value)} 
                              className="h-8 text-xs font-mono focus-visible:ring-[#d4af37]"
                            />
                          </div>
                        </div>

                        {/* Breakdown and Profit/Loss Summary */}
                        {selectedResident && (() => {
                          const rent = Number(rentInput) || 0;
                          const maint = Number(maintInput) || 0;
                          const gas = Number(gasAmount) || 0;
                          const elec = (Number(elecUnitsInput) || 0) * elecRate;
                          const openBal = Number(openingBalanceInput) || 0;
                          const totalBill = rent + maint + gas + elec;
                          const netTotalDue = totalBill + openBal;
                          
                          return (
                            <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-xs font-mono space-y-1.5 mt-2">
                              <div className="flex justify-between text-slate-400">
                                <span>Monthly Dues (Total Bill):</span>
                                <span className="font-bold text-white">
                                  PKR {totalBill.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between text-[10px] text-slate-400 pl-3">
                                <span>↳ Rent + Maint:</span>
                                <span>PKR {(rent + maint).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-[10px] text-slate-400 pl-3">
                                <span>↳ Gas + Elec ({Number(elecUnitsInput) || 0} u):</span>
                                <span>PKR {(gas + elec).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-slate-400">
                                <span>Opening Balance:</span>
                                <span className={`font-bold ${openBal > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>PKR {openBal.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-slate-200 border-t border-white/5 pt-1.5 font-bold">
                                <span>Net Total Due:</span>
                                <span className="text-[#d4af37] text-sm">
                                  PKR {netTotalDue.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between text-[10px] text-amber-400/90 border-t border-white/5 pt-1 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10 mt-1 font-bold">
                                <span>Owner Profit Contribution:</span>
                                <span>PKR {(rent + maint).toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* ================= DYNAMIC CONSOLIDATED UTILITY FORM ================= */}
                    {paymentForm.tx_type === "Utility Bill" && (
                      <div className={`p-4 rounded-2xl border space-y-4 ${
                        isDarkIndex ? "bg-black/35 border-[#d4af37]/25" : "bg-slate-50 border-slate-200"
                      }`}>
                        <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
                          <Sparkles className="h-3.5 w-3.5 text-[#d4af37]" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-[#d4af37]">Consolidated Utility Billing</h4>
                        </div>

                        {/* ⚡ ELECTRICITY */}
                        <div className="space-y-1.5 border-b border-white/5 pb-3">
                          <div className="flex justify-between items-center text-[11px] text-yellow-400 font-bold">
                            <span className="flex items-center gap-1">
                              <Zap className="h-3.5 w-3.5" /> <span>Electricity Billing</span>
                            </span>
                            <span className="text-[9px] text-muted-foreground font-mono">Prev: {elecPrev}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <Label className="text-[9px] text-muted-foreground block mb-0.5">Units Used</Label>
                              <Input type="number" placeholder="0" value={elecUnitsInput} onChange={e => setElecUnitsInput(e.target.value)} className="h-8 text-xs font-mono focus-visible:ring-[#d4af37]" />
                            </div>
                            <div>
                              <Label className="text-[9px] text-muted-foreground block mb-0.5">Rate (PKR/Unit)</Label>
                              <Input type="number" value={elecRate} onChange={e => setElecRate(Number(e.target.value))} className="h-8 text-xs font-mono focus-visible:ring-[#d4af37]" />
                            </div>
                          </div>
                          {Number(elecUnitsInput) > 0 && (
                            <p className="text-[9px] text-yellow-400 font-mono italic">
                              Elec Charges: {elecUnitsInput} units x PKR {elecRate} = PKR {((Number(elecUnitsInput)||0) * elecRate).toLocaleString()}
                            </p>
                          )}
                        </div>

                        {/* 🔥 SUI GAS */}
                        <div className="space-y-1.5 border-b border-white/5 pb-3">
                          <div className="flex justify-between items-center text-[11px] text-orange-400 font-bold">
                            <span className="flex items-center gap-1">
                              <Flame className="h-3.5 w-3.5" /> <span>Sui Gas Billing</span>
                            </span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => setGasMode("fixed")}
                                className={`text-[8px] px-1.5 py-0.5 rounded border transition font-bold ${
                                  gasMode === "fixed" 
                                    ? "bg-orange-500/10 border-orange-500/35 text-orange-400" 
                                    : "bg-black/35 border-transparent text-slate-400"
                                }`}
                              >
                                Fixed
                              </button>
                              <button
                                type="button"
                                onClick={() => setGasMode("units")}
                                className={`text-[8px] px-1.5 py-0.5 rounded border transition font-bold ${
                                  gasMode === "units" 
                                    ? "bg-orange-500/10 border-orange-500/35 text-orange-400" 
                                    : "bg-black/35 border-transparent text-slate-400"
                                }`}
                              >
                                Units
                              </button>
                            </div>
                          </div>

                          {gasMode === "fixed" ? (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <Label className="text-[9px] text-muted-foreground block mb-0.5">Fixed Sui Gas (PKR)</Label>
                                <Input type="number" value={gasAmount} onChange={e => setGasAmount(e.target.value)} className="h-8 text-xs font-mono focus-visible:ring-[#d4af37]" />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center text-[10px] text-orange-400 font-semibold">
                                <span className="text-[9px] text-muted-foreground font-mono">Prev Gas: {gasPrev}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <Label className="text-[9px] text-muted-foreground block mb-0.5">Gas Units Used</Label>
                                  <Input type="number" placeholder="0" value={gasUnitsInput} onChange={e => setGasUnitsInput(e.target.value)} className="h-8 text-xs font-mono focus-visible:ring-[#d4af37]" />
                                </div>
                                <div>
                                  <Label className="text-[9px] text-muted-foreground block mb-0.5">Rate (PKR/Unit)</Label>
                                  <Input type="number" value={gasRate} onChange={e => setGasRate(Number(e.target.value))} className="h-8 text-xs font-mono focus-visible:ring-[#d4af37]" />
                                </div>
                              </div>
                            </div>
                          )}
                          {gasMode === "units" && Number(gasUnitsInput) > 0 && (
                            <p className="text-[9px] text-orange-400 font-mono italic">
                              Gas Charges: {gasUnitsInput} units x PKR {gasRate} = PKR {((Number(gasUnitsInput)||0) * gasRate).toLocaleString()}
                            </p>
                          )}
                        </div>

                        {/* 💧 WATER */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[11px] text-cyan-400 font-bold">
                            <span className="flex items-center gap-1">
                              <Droplets className="h-3.5 w-3.5" /> <span>Water Billing</span>
                            </span>
                            <span className="text-[9px] text-muted-foreground font-mono">Prev Water: {waterPrev}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <Label className="text-[9px] text-muted-foreground block mb-0.5">Water Units Used</Label>
                              <Input type="number" placeholder="0" value={waterUnitsInput} onChange={e => setWaterUnitsInput(e.target.value)} className="h-8 text-xs font-mono focus-visible:ring-[#d4af37]" />
                            </div>
                            <div>
                              <Label className="text-[9px] text-muted-foreground block mb-0.5">Rate (PKR/Unit)</Label>
                              <Input type="number" value={waterRate} onChange={e => setWaterRate(Number(e.target.value))} className="h-8 text-xs font-mono focus-visible:ring-[#d4af37]" />
                            </div>
                          </div>
                          {Number(waterUnitsInput) > 0 && (
                            <p className="text-[9px] text-cyan-400 font-mono italic">
                              Water Charges: {waterUnitsInput} units x PKR {waterRate} = PKR {((Number(waterUnitsInput)||0) * waterRate).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ================= DYNAMIC GENERAL ENTRY FORM ================= */}
                    {paymentForm.tx_type === "General Entry" && (
                      <div className={`p-4 rounded-2xl border space-y-4 ${
                        isDarkIndex ? "bg-black/35 border-[#d4af37]/25" : "bg-slate-50 border-slate-200"
                      }`}>
                        <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
                          <Scale className="h-4 w-4 text-[#d4af37]" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-[#d4af37]">General Entry Details</h4>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <Label className="text-[9px] text-muted-foreground uppercase font-bold block mb-1">Amount Received (Credit)</Label>
                            <Input 
                              type="number" 
                              placeholder="0.00"
                              value={genReceived} 
                              onChange={e => setGenReceived(e.target.value)} 
                              className="h-8 text-xs font-mono focus-visible:ring-[#d4af37] text-emerald-400 font-bold"
                            />
                          </div>
                          <div>
                            <Label className="text-[9px] text-muted-foreground uppercase font-bold block mb-1">Amount Paid/Charged (Debit)</Label>
                            <Input 
                              type="number" 
                              placeholder="0.00"
                              value={genPaid} 
                              onChange={e => setGenPaid(e.target.value)} 
                              className="h-8 text-xs font-mono focus-visible:ring-[#d4af37] text-rose-400 font-bold"
                            />
                          </div>
                        </div>

                        {selectedResident && (() => {
                          const openBal = Number(selectedResident.outstanding_balance || 0);
                          const recVal = Number(genReceived) || 0;
                          const paidVal = Number(genPaid) || 0;
                          const netChange = paidVal - recVal;
                          const newBal = openBal + netChange;

                          return (
                            <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-xs font-mono space-y-1.5 mt-2">
                              <div className="flex justify-between text-slate-400">
                                <span>Opening Balance:</span>
                                <span className="font-bold text-white">PKR {openBal.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-slate-400">
                                <span>Net Balance Change:</span>
                                <span className={`font-bold ${netChange > 0 ? "text-rose-400" : netChange < 0 ? "text-emerald-400" : "text-slate-400"}`}>
                                  {netChange > 0 ? "+" : ""}{netChange.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between text-slate-200 border-t border-white/5 pt-1.5 font-bold">
                                <span>New Outstanding Balance:</span>
                                <span className="text-emerald-400 text-sm">PKR {newBal.toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Manual Entry Direction Select */}
                    {paymentForm.tx_type === "Manual Entry" && (
                      <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-2">
                        <Label className="text-[10px] text-muted-foreground uppercase font-black block">Transaction Direction (Manual Entry)</Label>
                        <Select 
                          value={paymentForm.manual_side} 
                          onValueChange={val => setPaymentForm({ ...paymentForm, manual_side: val })}
                        >
                          <SelectTrigger className={`h-9 text-xs focus-visible:ring-[#d4af37] ${isDarkIndex ? "bg-black/30 border-white/10 text-white" : ""}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className={isDarkIndex ? "bg-[#0d1527] text-white border-white/10" : ""}>
                            <SelectItem value="credit">Credit (Inward Payment / Settle Balance)</SelectItem>
                            <SelectItem value="debit">Debit (Outward Charge / Create Dues)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* STEP 3: PAYMENT & REFERENCE */}
                  <div className={`p-4 rounded-2xl border space-y-4 ${
                    isDarkIndex ? "bg-black/20 border-white/5" : "bg-muted/40 border-border/40"
                  }`}>
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                      <span className="h-5 w-5 rounded-full bg-[#d4af37]/10 text-[#d4af37] flex items-center justify-center font-bold text-xs border border-[#d4af37]/35">3</span>
                      <h4 className="text-xs font-black uppercase tracking-wider text-[#d4af37]">Payment & Reference Details</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      {/* Amount */}
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block mb-1">
                          Amount (PKR) {["Utility Bill", "Monthly Bill", "General Entry"].includes(paymentForm.tx_type) && "(Auto-calculated)"}
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground font-black text-[10px]">PKR</span>
                          <Input 
                            type="number" 
                            step="0.01"
                            placeholder="0.00" 
                            value={paymentForm.amount} 
                            onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} 
                            className={`h-9 pl-11 text-xs font-mono font-bold focus-visible:ring-[#d4af37] ${
                              isDarkIndex 
                                ? "bg-black/30 border-white/10 text-[#d4af37]" 
                                : "text-amber-500"
                            }`}
                            readOnly={["Utility Bill", "Monthly Bill", "General Entry"].includes(paymentForm.tx_type)}
                            required
                          />
                        </div>
                      </div>

                      {/* Payment Mode */}
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block mb-1">Payment Mode / Source</Label>
                        <Select 
                          value={paymentForm.payment_mode} 
                          onValueChange={val => setPaymentForm({ ...paymentForm, payment_mode: val })}
                          disabled={isChargeType}
                        >
                          <SelectTrigger className={`h-9 text-xs focus-visible:ring-[#d4af37] ${isDarkIndex ? "bg-black/30 border-white/10 text-white" : ""}`}>
                            <SelectValue placeholder="Select Mode" />
                          </SelectTrigger>
                          <SelectContent className={isDarkIndex ? "bg-[#0d1527] text-white border-white/10" : ""}>
                            <SelectItem value="Cash">Cash on Hand</SelectItem>
                            <SelectItem value="EasyPaisa">EasyPaisa Mobile</SelectItem>
                            <SelectItem value="JazzCash">JazzCash Wallet</SelectItem>
                            <SelectItem value="Bank Transfer">Bank Transfer / IBFT</SelectItem>
                            <SelectItem value="Online">Online Credit Card</SelectItem>
                            <SelectItem value="Cheque">Bank Cheque</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      {/* RV Number */}
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block mb-1">RV Number (Auto/Manual)</Label>
                        <Input 
                          type="text" 
                          placeholder="Auto-generated" 
                          value={paymentForm.rv_number} 
                          onChange={e => setPaymentForm({ ...paymentForm, rv_number: e.target.value })} 
                          className={`h-9 text-xs font-mono font-bold focus-visible:ring-[#d4af37] ${
                            isDarkIndex 
                              ? "bg-black/30 border-white/10 text-[#d4af37]" 
                              : "text-amber-500"
                          }`} 
                        />
                      </div>

                      {/* Remarks */}
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block mb-1">Remarks / Narrative Description</Label>
                        <Textarea 
                          value={paymentForm.remarks}
                          onChange={e => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                          placeholder="Reference particulars..."
                          className={`h-9 text-xs resize-none focus-visible:ring-[#d4af37] ${isDarkIndex ? "bg-black/30 border-white/10 text-white" : ""}`}
                        />
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="pt-2 gap-2.5 flex flex-col sm:flex-row">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={onClose} 
                      className={`h-10 text-xs flex-1 ${isDarkIndex ? "border-white/10 hover:bg-white/5 text-white bg-transparent" : ""}`}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className={`h-10 text-xs font-black uppercase tracking-wider flex-1 ${
                        isDarkIndex 
                          ? "bg-gradient-to-r from-amber-500 to-[#d4af37] text-black hover:opacity-90 shadow-md" 
                          : "bg-emerald-600 hover:bg-emerald-700 text-white"
                      }`}
                      disabled={saving}
                    >
                      {saving ? "Processing..." : isChargeType ? "Post Dues & Create Invoice" : "Process Entry & Print"}
                    </Button>
                  </DialogFooter>
                </form>
              </TabsContent>

              {/* ================= CREATE PAYMENT REQUEST TAB ================= */}
              <TabsContent value="request" className="mt-4 focus-visible:outline-none">
                <form onSubmit={handlePostRequest} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3.5">
                    {/* Unit Select */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase font-black block mb-1">Unit / Apartment</Label>
                      <Select 
                        value={requestForm.apartment_no || "none"} 
                        onValueChange={(val) => handleApartmentChange(val, "request")}
                      >
                        <SelectTrigger className={`h-9 text-xs focus-visible:ring-[#d4af37] ${isDarkIndex ? "bg-black/30 border-white/10 text-white" : "bg-background"}`}>
                          <SelectValue placeholder="Select Unit" />
                        </SelectTrigger>
                        <SelectContent className={isDarkIndex ? "bg-[#0d1527] text-white border-white/10" : ""}>
                          <SelectItem value="none">Choose Unit...</SelectItem>
                          {residents.filter(r => r.apartment_no).map((r) => (
                            <SelectItem key={r.id} value={r.apartment_no}>
                              Unit {r.apartment_no} - {r.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Resident Name (Auto) */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase font-black block mb-1">Resident Name</Label>
                      <Input 
                        type="text" 
                        value={requestForm.resident_name || (loadingResidents ? "Loading..." : "No resident associated")} 
                        className={`h-9 text-xs font-semibold cursor-not-allowed ${
                          isDarkIndex ? "bg-white/5 border-white/10 text-gray-400" : "bg-muted/30"
                        }`} 
                        readOnly
                        disabled
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    {/* Request Type */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase font-black block mb-1">Request Type</Label>
                      <Select 
                        value={requestForm.req_type} 
                        onValueChange={handleReqTypeChange}
                      >
                        <SelectTrigger className={`h-9 text-xs focus-visible:ring-[#d4af37] ${isDarkIndex ? "bg-black/30 border-white/10 text-white" : "bg-background"}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={isDarkIndex ? "bg-[#0d1527] text-white border-white/10" : ""}>
                          <SelectItem value="Rent">Rent Dues</SelectItem>
                          <SelectItem value="Security">Escrow Security</SelectItem>
                          <SelectItem value="Stall">Stall Rent</SelectItem>
                          <SelectItem value="Utility">Utility Billing</SelectItem>
                          <SelectItem value="Item">Item Recovery</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Action */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase font-black block mb-1">Action Direction</Label>
                      <Select 
                        value={requestForm.action} 
                        onValueChange={val => setRequestForm({ ...requestForm, action: val })}
                      >
                        <SelectTrigger className={`h-9 text-xs focus-visible:ring-[#d4af37] ${isDarkIndex ? "bg-black/30 border-white/10 text-white" : "bg-background"}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={isDarkIndex ? "bg-[#0d1527] text-white border-white/10" : ""}>
                          <SelectItem value="Collect">Collect (Bill Charge)</SelectItem>
                          <SelectItem value="Return">Return (Refund / Payout)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    {/* Amount */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase font-black block mb-1">Amount (PKR) *</Label>
                      <Input 
                        type="number" 
                        placeholder="Enter amount" 
                        value={requestForm.amount} 
                        onChange={e => setRequestForm({ ...requestForm, amount: e.target.value })} 
                        className={`h-9 text-xs font-mono font-bold focus-visible:ring-[#d4af37] ${
                          isDarkIndex 
                            ? "bg-black/30 border-white/10 text-[#d4af37]" 
                            : "text-amber-500"
                        }`} 
                        required
                      />
                    </div>

                    {/* Due Date */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase font-black block mb-1">Due Date</Label>
                      <Input 
                        type="date" 
                        value={requestForm.due_date} 
                        onChange={e => setRequestForm({ ...requestForm, due_date: e.target.value })} 
                        className={`h-9 text-xs focus-visible:ring-[#d4af37] ${isDarkIndex ? "bg-black/30 border-white/10 text-white" : ""}`} 
                      />
                    </div>
                  </div>

                  {/* Note */}
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase font-black block mb-1">Notice / Note Description</Label>
                    <Textarea 
                      rows={2} 
                      value={requestForm.note} 
                      onChange={e => setRequestForm({ ...requestForm, note: e.target.value })} 
                      placeholder="e.g. Utility adjustments or specific monthly dues..."
                      className={`text-xs resize-none focus-visible:ring-[#d4af37] ${isDarkIndex ? "bg-black/30 border-white/10 text-white" : ""}`}
                    />
                  </div>

                  <DialogFooter className="pt-2 gap-2.5 flex flex-col sm:flex-row">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={onClose} 
                      className={`h-9 text-xs flex-1 ${isDarkIndex ? "border-white/10 hover:bg-white/5 text-white bg-transparent" : ""}`}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className={`h-9 text-xs font-black uppercase flex-1 ${
                        isDarkIndex 
                          ? "bg-gradient-to-r from-amber-500 to-[#d4af37] text-black hover:opacity-90" 
                          : "bg-amber-500 hover:bg-amber-600 text-black"
                      }`}
                      disabled={saving}
                    >
                      {saving ? "Sending..." : "Dispatch Bill Request"}
                    </Button>
                  </DialogFooter>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
