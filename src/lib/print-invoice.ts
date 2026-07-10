import { toast } from "sonner";

interface PrintInvoiceParams {
  residentName: string;
  residentId: string;
  apartmentNo: string;
  date: string;
  refNo: string;
  description: string;
  amount: string;
  meterReadings?: string;
  status?: string;
  paymentMethod?: string;
  tax?: string;
  grandTotal?: string;
  docType?: "Token" | "Invoice" | "Receipt";
}

export function resolveInvoiceDisplayValues(params: Partial<PrintInvoiceParams>) {
  const normalizeAmount = (value: unknown) => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (/^undefined$/i.test(trimmed) || /^null$/i.test(trimmed)) return null;
      const parsed = Number(trimmed.replace(/[^0-9.-]/g, ""));
      return Number.isFinite(parsed) ? String(parsed) : null;
    }
    return null;
  };

  const resolvedAmount = normalizeAmount(params.amount) ?? normalizeAmount(params.grandTotal) ?? "0";
  const resolvedTax = normalizeAmount(params.tax) ?? "0";
  const resolvedGrandTotal = normalizeAmount(params.grandTotal) ?? resolvedAmount;

  return {
    amount: resolvedAmount,
    tax: resolvedTax,
    grandTotal: resolvedGrandTotal,
  };
}

export function extractMeterReadings(description: string): string {
  // Regex to extract readings like "Reading: 1200 - 1500" or "Meter: 450"
  const match = description.match(/(?:reading|rdg|meter|units|kw|m³|kwh)[:\s]+([\d\s.\-to]+)/i);
  return match ? match[1].trim() : "Standard billing";
}

export function printInvoiceReceipt(params: PrintInvoiceParams) {
  const {
    residentName = "Valued Resident",
    residentId = "N/A",
    apartmentNo = "N/A",
    date = new Date().toISOString().split("T")[0],
    refNo = "N/A",
    description = "Monthly charges",
    amount = "0",
    status = "Paid",
    paymentMethod = "Online Portal",
    tax = "0.00",
    grandTotal = amount,
    docType = "Invoice",
  } = params;

  const { amount: resolvedAmount, tax: resolvedTax, grandTotal: resolvedGrandTotal } = resolveInvoiceDisplayValues({
    amount,
    tax,
    grandTotal,
  });

  const meterReadings = params.meterReadings || extractMeterReadings(description);

  const generateInvoiceCard = (copyType: string) => `
    <div class="invoice-card">
      <div class="copy-label">${copyType}</div>
      <div class="header">
        <div class="logo-area">
          <h1>MARGALLA GATEWAY</h1>
          <p>Luxury Residences</p>
          <div class="address">E-11/4, Street No 26-A, Islamabad, Pakistan · Contact: +92 (51) 111-222-333</div>
        </div>
        <div class="invoice-title-area">
          <h2>${docType.toUpperCase()}</h2>
          <p>REF: <strong>${refNo.toUpperCase()}</strong></p>
        </div>
      </div>

      <div class="details-grid">
        <div class="details-block">
          <h3>Billed To</h3>
          <p>Resident Name: <span>${residentName}</span></p>
          <p>Apartment Unit: <span>${apartmentNo}</span></p>
        </div>
        <div class="details-block">
          <h3>${docType} Details</h3>
          <p>Billing Date: <span>${date}</span></p>
          <p>Payment Status: <span>${status}</span></p>
          <p>Payment Method: <span>${paymentMethod}</span></p>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Meter Readings</th>
              <th class="amount-col">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>${description}</strong></td>
              <td>${meterReadings}</td>
              <td class="amount-col"><strong>PKR ${resolvedAmount}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="summary-area">
        <div class="summary-box">
          <div class="summary-row">
            <span>Subtotal</span>
            <span>PKR ${resolvedAmount}</span>
          </div>
          <div class="summary-row">
            <span>Surcharge / Tax</span>
            <span>PKR ${resolvedTax}</span>
          </div>
          <div class="summary-row total">
            <span>Grand Total</span>
            <span>PKR ${resolvedGrandTotal}</span>
          </div>
        </div>
      </div>

      <div class="footer-note">
        Thank you for your prompt payment. Margalla Gateway Utility & Rental Engine.
        <br>© 2026 Margalla Gateway. All rights reserved.
      </div>
    </div>
  `;

  // HTML Template String with 2 copies
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${docType} Receipt - Margalla Gateway</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
    
    * { box-sizing: border-box; }
    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      color: #0f2346; /* darker, premium blue/black */
      margin: 0;
      padding: 20px;
      font-size: 11pt;
      line-height: 1.4;
      background-color: #f8fafc;
    }
    
    .page-wrapper {
      max-width: 210mm; /* A4 width */
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 15px; /* space between copies */
    }

    .invoice-card {
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-top: 6px solid #D4AF37; /* Premium gold accent */
      padding: 20px 25px;
      border-radius: 8px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.05);
      position: relative;
      height: 135mm; /* Approx half of A4 minus margins to fit 2 perfectly */
      display: flex;
      flex-direction: column;
    }

    .copy-label {
      position: absolute;
      top: -15px;
      right: 20px;
      background: #D4AF37;
      color: #fff;
      padding: 4px 12px;
      font-size: 8pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 12px;
      margin-bottom: 15px;
    }
    .logo-area h1 {
      margin: 0;
      font-size: 16pt;
      color: #0f2346;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .logo-area p {
      margin: 2px 0 0 0;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 2.5px;
      color: #D4AF37;
      font-weight: 700;
    }
    .logo-area .address {
      margin: 4px 0 0 0;
      font-size: 7.5pt;
      color: #4a5568;
      font-weight: 600;
    }
    .invoice-title-area {
      text-align: right;
    }
    .invoice-title-area h2 {
      margin: 0;
      font-size: 14pt;
      color: #0f2346;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 800;
    }
    .invoice-title-area p {
      margin: 4px 0 0 0;
      font-family: monospace;
      font-size: 9pt;
      color: #2d3748;
      font-weight: 700;
    }
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 15px;
    }
    .details-block h3 {
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #718096;
      margin: 0 0 4px 0;
      border-bottom: 2px solid #edf2f7;
      padding-bottom: 3px;
      font-weight: 800;
    }
    .details-block p {
      margin: 3px 0;
      font-size: 9.5pt;
      color: #4a5568;
    }
    .details-block span {
      font-weight: 800;
      color: #0f2346;
    }
    .table-container {
      flex: 1;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    th {
      background: #0f2346;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #ffffff;
      padding: 8px 10px;
      font-weight: 700;
    }
    td {
      padding: 10px;
      border-bottom: 1px solid #edf2f7;
      color: #2d3748;
      font-size: 10pt;
    }
    .amount-col {
      text-align: right;
    }
    .summary-area {
      display: flex;
      justify-content: flex-end;
      margin-top: 10px;
    }
    .summary-box {
      width: 250px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 9.5pt;
      color: #4a5568;
      font-weight: 600;
    }
    .summary-row.total {
      border-top: 2px solid #0f2346;
      font-weight: 800;
      font-size: 12pt;
      color: #0f2346;
      padding-top: 6px;
      margin-top: 4px;
    }
    .footer-note {
      text-align: center;
      font-size: 7.5pt;
      color: #a0aec0;
      margin-top: auto;
      border-top: 1px dashed #e2e8f0;
      padding-top: 8px;
      line-height: 1.4;
      font-weight: 600;
    }
    
    .cut-line {
      text-align: center;
      color: #cbd5e0;
      font-size: 8pt;
      letter-spacing: 4px;
      padding: 5px 0;
      font-weight: 800;
    }

    @media print {
      @page {
        size: A4 portrait;
        margin: 5mm;
      }
      body {
        padding: 0;
        background: #fff;
      }
      .page-wrapper {
        gap: 0;
      }
      .invoice-card {
        border: 1px solid #ccc;
        border-top: 4px solid #0f2346;
        box-shadow: none;
        page-break-inside: avoid;
        height: 135mm; /* fits 2 in 297mm */
        border-radius: 0;
        margin-bottom: 0;
      }
      .cut-line {
        border-bottom: 1px dashed #ccc;
        margin: 4mm 0;
        line-height: 0.1em;
      }
      .cut-line span {
        background: #fff;
        padding: 0 10px;
      }
    }
  </style>
</head>
<body>
  <div class="page-wrapper">
    ${generateInvoiceCard("Office Copy")}
    <div class="cut-line"><span>✂ CUT HERE ✂</span></div>
    ${generateInvoiceCard("Customer Copy")}
  </div>
</body>
</html>
  `;

  // Create a hidden iframe
  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.width = "0px";
  iframe.style.height = "0px";
  iframe.style.border = "none";
  iframe.name = "invoice_print_frame";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Trigger printing once loaded
    setTimeout(() => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        // Remove the iframe after printing
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }
    }, 250);
  } else {
    toast.error("Failed to compile printing context.");
  }
}

export interface InvoiceInput {
  invoiceNo: string;
  date: string;
  apartmentNo: string;
  tenantName: string;
  prevReading: number;
  currReading: number;
  unitRate: number;
  gasCharges: number;
  flatRent: number;
  maintenance: number;
  arrears: number;
}

export const calculateMargallaInvoice = (input: InvoiceInput) => {
  const unitsConsumed = input.currReading - input.prevReading;
  const electricityAmount = unitsConsumed * input.unitRate;
  const grandTotal = electricityAmount + input.gasCharges + input.flatRent + input.maintenance + input.arrears;

  return {
    unitsConsumed,
    electricityAmount,
    grandTotal,
  };
};

export interface MergedInvoiceInput {
  invoiceNo: string;
  prevReading: number;
  currReading: number;
  unitRate: number;
  gasCharges: number;
  flatRent: number;
  maintenance: number;
  previousArrears: number;
  amountReceived: number;
}

export const processMargallaBilling = (input: MergedInvoiceInput) => {
  const unitsConsumed = input.currReading - input.prevReading;
  const electricityAmount = unitsConsumed * input.unitRate;
  const totalBillAmount =
    electricityAmount +
    input.gasCharges +
    input.flatRent +
    input.maintenance +
    input.previousArrears;
  const currentBalance = totalBillAmount - input.amountReceived;

  return {
    unitsConsumed,
    electricityAmount,
    totalBillAmount,
    amountReceived: input.amountReceived,
    currentBalance,
  };
};

/** Print any hidden DOM element — works in Electron (no window.open popup block). */
export function printElementById(elementId: string, title = "Margalla Gateway Invoice") {
  const printContent = document.getElementById(elementId);
  if (!printContent) {
    toast.error("Invoice template not ready. Please try again.");
    return false;
  }

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; padding: 10px; color: #000; background: #fff; margin: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #000; padding: 6px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>${printContent.innerHTML}</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    toast.error("Failed to open print context.");
    return false;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (iframe.parentNode) document.body.removeChild(iframe);
    }, 1000);
  }, 300);

  return true;
}

export interface PremiumUtilityInvoiceInput {
  invoiceNo: string;
  date: string;
  tenantName: string;
  apartmentNo: string;
  elecPrev: number;
  elecCurr: number;
  elecRate: number;
  elecArrears: number;
  elecCost: number;
  fixedGasCost: number;
  baseRent: number;
  consolidatedMaintenance: number;
  grandTotal: number;
  cashReceived: number;
  remainingBalance: number;
}

export const printUtilityInvoice = async (opts: PremiumUtilityInvoiceInput) => {
  const { downloadRentalBillPDF } = await import("./pdf");
  downloadRentalBillPDF({
    invoiceNo: opts.invoiceNo,
    date: opts.date,
    billTo: { name: opts.tenantName, apartment: opts.apartmentNo },
    electricityDetails: {
      prev: opts.elecPrev,
      curr: opts.elecCurr,
      rate: opts.elecRate,
      arrears: opts.elecArrears,
      cost: opts.elecCost
    },
    fixedGasCost: opts.fixedGasCost,
    baseRent: opts.baseRent,
    consolidatedMaintenance: opts.consolidatedMaintenance,
    grandTotalNetBill: opts.grandTotal,
    cashReceived: opts.cashReceived
  });
};
