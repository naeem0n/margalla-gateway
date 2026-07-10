# REFUND TAB - Central Entry Console

## Jo kaha tha wo ab practical implement ho raha hai:

### REFUND BUTTON FEATURES:

1. ✅ **Central Entry Console mein REFUND tab**
2. ✅ **Original voucher select karo** (RV/PV/RI)
3. ✅ **Amount aur reason enter karo**
4. ✅ **Automatic reversal entry** ledger mein
5. ✅ **Print refund slip**

---

## IMPLEMENTATION STEPS:

### Step 1: Tab Definition ✅ DONE
```typescript
type TabType = "RV" | "PV" | "RI" | "REFUND";
```

### Step 2: Refund State Variables (Adding now)
```typescript
const [refundOriginalType, setRefundOriginalType] = useState<"RV" | "PV" | "RI">("RV");
const [refundOriginalVoucherNo, setRefundOriginalVoucherNo] = useState("");
const [refundNo, setRefundNo] = useState("RF-001");
const [refundDate, setRefundDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
const [refundAmount, setRefundAmount] = useState("");
const [refundReason, setRefundReason] = useState("");
const [refundTenantId, setRefundTenantId] = useState("");
```

### Step 3: Refund Handler
```typescript
// POST to /api/accounting/refund
await apiFetch("/accounting/refund", {
  method: "POST",
  body: JSON.stringify({
    refund_no: refundNo,
    date: refundDate,
    original_type: refundOriginalType,
    original_voucher_no: refundOriginalVoucherNo,
    tenant_id: refundTenantId,
    amount: Number(refundAmount),
    reason: refundReason
  })
});
```

### Step 4: UI Tab Button
```tsx
<button
  onClick={() => setActiveTab("REFUND")}
  className={activeTab === "REFUND" ? "bg-rose-600" : "bg-slate-800"}
>
  ↩️ Refund Entry
</button>
```

### Step 5: Refund Form UI
```tsx
{activeTab === "REFUND" && (
  <div className="space-y-4">
    <Label>Original Transaction Type</Label>
    <select value={refundOriginalType}>
      <option value="RV">Receipt Voucher (RV)</option>
      <option value="PV">Payment Voucher (PV)</option>
      <option value="RI">Rental Invoice (RI)</option>
    </select>
    
    <Label>Original Voucher Number</Label>
    <Input value={refundOriginalVoucherNo} />
    
    <Label>Refund Amount</Label>
    <Input type="number" value={refundAmount} />
    
    <Label>Reason for Refund</Label>
    <Textarea value={refundReason} />
  </div>
)}
```

---

## ACCOUNTING ENTRY (Double Entry):

```
Original RV Posted:
  Debit:  Cash (1000)      PKR 50,000
  Credit: Revenue (4000)   PKR 50,000

Refund Entry (Reversal):
  Debit:  Revenue (4000)   PKR 50,000
  Credit: Cash (1000)      PKR 50,000
```

**Result:** Original transaction completely reversed ✅

---

## FILES TO UPDATE:

1. ✅ `CentralEntryPanel.tsx` - Add REFUND tab
2. ✅ `accounting.ts` - Already has /refund endpoint
3. ✅ Database - refund_vouchers table exists

---

**STATUS:** Implementation in progress...
**NEXT:** Adding complete Refund tab to CentralEntryPanel.tsx
