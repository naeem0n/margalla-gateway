import { toast } from "sonner";

export interface LedgerData {
  invoiceNo: string;
  billingPeriod: string;
  issueDate: string;
  tenantName: string;
  apartmentNo: string;
  rent: number;
  maintenance: number;
  elecPrev: number;
  elecCurr: number;
  elecUnits: number;
  elecRate: number;
  gasPrev: number;
  gasCurr: number;
  gasUnits: number;
  gasRate: number;
  gas: number;
  openingBalance: number;
  totalBill: number;
  arrears: number;
  grossPayable: number;
  cashReceived: number;
  netArrears: number;
  stallRent?: number;
}

const fmtPKR = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;

function iframePrint(html: string) {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch (_) {}
        }, 1500);
      }
    }, 350);
  } else {
    toast.error("Failed to generate print document.");
  }
}

/** Build one A5-sized invoice copy block as an HTML string */
function buildInvoiceCopy(d: LedgerData, copyLabel: string, elecUnits: number, gasUnits: number, openBal: number): string {
  const currentBill = d.rent + d.maintenance + (elecUnits * d.elecRate) + (gasUnits * d.gasRate) + (d.stallRent || 0);
  return `
  <div class="invoice-copy">
    <div class="copy-label">${copyLabel}</div>
    <!-- Header -->
    <div class="inv-header">
      <div>
        <div class="company-name">MARGALLA GATEWAY</div>
        <div class="company-sub">Luxury Residences · E-11/4, Street 26-A, Islamabad</div>
      </div>
      <div class="title-badge">Monthly Invoice</div>
    </div>

    <!-- Meta grid -->
    <div class="meta-grid">
      <div class="meta-block">
        <div class="meta-label">Invoice #</div>
        <div class="meta-val">${d.invoiceNo}</div>
      </div>
      <div class="meta-block">
        <div class="meta-label">Period</div>
        <div class="meta-val">${d.billingPeriod}</div>
      </div>
      <div class="meta-block">
        <div class="meta-label">Date Issued</div>
        <div class="meta-val">${d.issueDate}</div>
      </div>
      <div class="meta-block">
        <div class="meta-label">Apartment</div>
        <div class="meta-val"><strong>${d.apartmentNo}</strong></div>
      </div>
    </div>

    <div class="tenant-bar">
      <span class="tenant-icon">👤</span>
      <span><strong>${d.tenantName}</strong></span>
    </div>

    <!-- Line items table -->
    <table class="bill-table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Details</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="item-name">🏢 Flat Rent</span></td>
          <td class="dim">Monthly Contract Rent</td>
          <td class="right">${fmtPKR(d.rent)}</td>
        </tr>
        <tr>
          <td><span class="item-name">🛡️ Maintenance</span></td>
          <td class="dim">Water, Security, Building Ops</td>
          <td class="right">${fmtPKR(d.maintenance)}</td>
        </tr>
        <tr>
          <td><span class="item-name">⚡ Electricity</span></td>
          <td class="dim">${elecUnits} units (${d.elecPrev}→${d.elecCurr}) @ PKR ${d.elecRate}</td>
          <td class="right">${fmtPKR(elecUnits * d.elecRate)}</td>
        </tr>
        <tr>
          <td><span class="item-name">🔥 Gas</span></td>
          <td class="dim">${gasUnits > 0 ? `${gasUnits} units (${d.gasPrev}→${d.gasCurr}) @ PKR ${d.gasRate}` : 'Fixed Monthly Gas Charge'}</td>
          <td class="right">${fmtPKR(d.gas)}</td>
        </tr>
        ${d.stallRent && d.stallRent > 0 ? `
        <tr>
          <td><span class="item-name">🏪 Stall Rent</span></td>
          <td class="dim">Commercial Stall Monthly Charge</td>
          <td class="right">${fmtPKR(d.stallRent)}</td>
        </tr>` : ''}
        ${openBal > 0 ? `
        <tr class="arrears-row">
          <td><span class="item-name">📋 Previous Arrears</span></td>
          <td class="dim">Balance B/F from last month</td>
          <td class="right arrears-amt">${fmtPKR(openBal)}</td>
        </tr>` : ''}
      </tbody>
    </table>

    <!-- Summary ledger -->
    <div class="summary-section">
      <table class="summary-table">
        <tr class="sum-row">
          <td>Current Month Bill</td>
          <td class="right">${fmtPKR(currentBill)}</td>
        </tr>
        <tr class="sum-row">
          <td>Previous Arrears</td>
          <td class="right">${fmtPKR(openBal)}</td>
        </tr>
        <tr class="sum-row gross-row">
          <td><strong>Gross Payable</strong></td>
          <td class="right"><strong>${fmtPKR(d.grossPayable)}</strong></td>
        </tr>
        <tr class="sum-row paid-row">
          <td>✔ Cash Received</td>
          <td class="right">${fmtPKR(d.cashReceived)}</td>
        </tr>
        <tr class="sum-row net-row">
          <td><strong>Net Balance Due</strong></td>
          <td class="right net-amt"><strong>${fmtPKR(d.netArrears)}</strong></td>
        </tr>
      </table>
    </div>

    <!-- Signature row -->
    <div class="sig-row">
      <div class="sig-box">Prepared By<br><span class="sig-line"></span></div>
      <div class="sig-box">Received By<br><span class="sig-line"></span></div>
      <div class="sig-box">Audit Stamp<br><span class="sig-line"></span></div>
    </div>

    <div class="footer-note">
      This is a computer-generated invoice. Please retain for your records. · Margalla Gateway ERP v1.5.0
    </div>
  </div>`;
}

export function printLedgerStatement(d: LedgerData) {
  const elecUnits = d.elecUnits ?? Math.max(0, (d.elecCurr ?? 0) - (d.elecPrev ?? 0));
  const gasUnits  = d.gasUnits  ?? Math.max(0, (d.gasCurr  ?? 0) - (d.gasPrev  ?? 0));
  const openBal   = d.openingBalance ?? d.arrears ?? 0;

  const clientCopy = buildInvoiceCopy(d, "CLIENT COPY", elecUnits, gasUnits, openBal);
  const officeCopy = buildInvoiceCopy(d, "OFFICE RECORD", elecUnits, gasUnits, openBal);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Apt ${d.apartmentNo || "N-A"} - Invoice ${d.invoiceNo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Plus Jakarta Sans', Arial, sans-serif;
      background: #f0f4f8;
      color: #1a202c;
      font-size: 9.5pt;
      line-height: 1.4;
    }

    /* ── SCREEN: Stacked Layout ── */
    .page-wrapper {
      display: flex;
      flex-direction: column;
      gap: 15px;
      padding: 16px;
      justify-content: flex-start;
      align-items: center;
      max-width: 210mm;
      margin: 0 auto;
    }

    .invoice-copy {
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-top: 6px solid #D4AF37;
      padding: 15px 20px;
      border-radius: 8px;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    .copy-label {
      position: absolute;
      top: 8px;
      right: 10px;
      font-size: 7pt;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #a0aec0;
      background: #f7fafc;
      padding: 2px 8px;
      border-radius: 20px;
      border: 1px solid #e2e8f0;
    }

    .inv-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 12px;
      margin-bottom: 10px;
      border-bottom: 2px solid #D4AF37;
    }

    .company-name {
      font-size: 16pt;
      font-weight: 800;
      color: #0f2346;
      letter-spacing: 0.5px;
    }

    .company-sub {
      font-size: 7pt;
      color: #718096;
      margin-top: 2px;
    }

    .title-badge {
      font-size: 8pt;
      font-weight: 700;
      background: #0f2346;
      color: #fff;
      padding: 4px 10px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #edf2f7;
      border-radius: 4px;
      padding: 8px 10px;
      margin-bottom: 10px;
    }

    .meta-label {
      font-size: 7pt;
      text-transform: uppercase;
      color: #D4AF37;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 1px;
    }

    .meta-val {
      font-size: 9pt;
      color: #1a202c;
      font-weight: 600;
    }

    .tenant-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #0f2346;
      color: #fff;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 9.5pt;
      margin-bottom: 10px;
    }

    .tenant-icon { font-size: 11pt; }

    .bill-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 8.5pt;
    }

    .bill-table th {
      background: #0f2346;
      color: #fff;
      padding: 6px 8px;
      font-weight: 800;
      text-align: left;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .bill-table th.right { text-align: right; }

    .bill-table td {
      padding: 5px 8px;
      border-bottom: 1px solid #edf2f7;
      vertical-align: top;
    }

    .bill-table td.right { text-align: right; font-weight: 600; }

    .bill-table tr:nth-child(even) td { background: #f8fafc; }

    .item-name { font-weight: 600; color: #1a202c; }
    .dim { color: #718096; font-size: 7.5pt; }

    .arrears-row td { background: #fffbeb !important; color: #744210; }
    .arrears-amt { color: #c05621 !important; font-weight: 700; }

    .summary-section {
      border-top: 2px solid #0f2346;
      padding-top: 8px;
      display: flex;
      justify-content: flex-end;
      margin-bottom: 14px;
    }

    .summary-table {
      width: 55%;
      font-size: 8.5pt;
      border-collapse: collapse;
    }

    .sum-row td {
      padding: 4px 8px;
      border-bottom: 1px solid #edf2f7;
    }

    .sum-row td.right { text-align: right; }

    .gross-row td {
      background: #ebf4ff;
      font-size: 9pt;
      border-top: 1px solid #bee3f8;
    }

    .paid-row td { color: #276749; background: #f0fff4; font-weight: 600; }

    .net-row td {
      background: #fff5f5;
      border: 1px solid #fed7d7;
      border-radius: 3px;
      font-size: 9pt;
    }

    .net-amt { color: #c53030 !important; }

    .sig-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 16px;
      padding-top: 10px;
      border-top: 1px dashed #e2e8f0;
    }

    .sig-box {
      flex: 1;
      text-align: center;
      font-size: 7.5pt;
      color: #a0aec0;
    }

    .sig-line {
      display: block;
      border-top: 1px solid #cbd5e0;
      margin-top: 18px;
    }

    .footer-note {
      text-align: center;
      font-size: 8pt;
      color: #a0aec0;
      margin-top: auto;
      font-weight: 600;
    }

    /* Dashed divider between copies on screen */
    .copy-divider {
      display: none;
    }

    /* ── PRINT STYLES ── */
    @media print {
      @page {
        size: A5 portrait;
        margin: 5mm;
      }

      body {
        background: #fff;
      }

      .page-wrapper {
        padding: 0;
        gap: 0;
      }

      .invoice-copy {
        width: 100%;
        border: 1px solid #ccc;
        border-top: 4px solid #0f2346;
        box-shadow: none;
        border-radius: 0;
        margin-bottom: 0;
      }
      .copy-divider {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="page-wrapper">
    ${clientCopy}
  </div>
</body>
</html>`;

  iframePrint(html);
}
