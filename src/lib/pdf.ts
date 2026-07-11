export type LedgerRow = {
  entry_date: string;
  description: string;
  debit: number;
  credit: number;
};

interface PrintReportOptions {
  title: string;
  titleUrdu?: string;
  subtitle?: string;
  subtitleUrdu?: string;
  fileName: string;
  metaFields?: Array<{ label: string; labelUrdu?: string; value: string }>;
  tableHeaders: string[] | Array<{ text: string; textUrdu?: string }>;
  tableRows: any[][];
  footerRows?: any[][];
  notes?: string;
  notesUrdu?: string;
  layout?: "portrait" | "landscape";
}

export function printHTMLReport(opts: PrintReportOptions | string) {
  if (typeof opts === "string") {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(opts);
      doc.close();

      setTimeout(() => {
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          setTimeout(() => {
            if (iframe.parentNode) document.body.removeChild(iframe);
          }, 1000);
        }
      }, 500);
    }
    return;
  }

  const isUrdu = typeof localStorage !== 'undefined' && localStorage.getItem('lang') === 'ur';
  const title = isUrdu && opts.titleUrdu ? opts.titleUrdu : opts.title;
  const subtitle = isUrdu && opts.subtitleUrdu ? opts.subtitleUrdu : (opts.subtitle || "");
  const notes = isUrdu && opts.notesUrdu ? opts.notesUrdu : (opts.notes || "");
  
  // Build meta fields html
  let metaHtml = "";
  if (opts.metaFields && opts.metaFields.length > 0) {
    metaHtml = `<div class="meta-grid">`;
    opts.metaFields.forEach(f => {
      const label = isUrdu && f.labelUrdu ? f.labelUrdu : f.label;
      metaHtml += `
        <div class="meta-block">
          <h3>${label}</h3>
          <p>${f.value}</p>
        </div>
      `;
    });
    metaHtml += `</div>`;
  }

  // Build headers html
  const headers = opts.tableHeaders.map(h => {
    if (typeof h === 'string') return h;
    return isUrdu && h.textUrdu ? h.textUrdu : h.text;
  });
  
  let headersHtml = "<tr>";
  headers.forEach(h => {
    headersHtml += `<th>${h}</th>`;
  });
  headersHtml += "</tr>";

  // Build rows html
  let rowsHtml = "";
  opts.tableRows.forEach(row => {
    rowsHtml += "<tr>";
    row.forEach(cell => {
      rowsHtml += `<td>${cell || "—"}</td>`;
    });
    rowsHtml += "</tr>";
  });

  // Build footer rows html
  let footerHtml = "";
  if (opts.footerRows && opts.footerRows.length > 0) {
    opts.footerRows.forEach(row => {
      footerHtml += `<tr class="footer-row">`;
      row.forEach(cell => {
        footerHtml += `<td>${cell || ""}</td>`;
      });
      footerHtml += "</tr>";
    });
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="${isUrdu ? 'ur' : 'en'}" dir="${isUrdu ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <title>${opts.fileName.replace(/\.pdf$/i, "")}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: ${isUrdu ? '"Noto Nastaliq Urdu", serif' : '"Plus Jakarta Sans", sans-serif'};
      color: #0f172a;
      padding: 30px;
      font-size: ${isUrdu ? '14px' : '12px'};
      line-height: ${isUrdu ? '2.2' : '1.5'};
      background-color: #ffffff;
    }

    .report-card {
      max-width: ${opts.layout === 'landscape' ? '100%' : '800px'};
      margin: 0 auto;
      border: 1px solid #e2e8f0;
      padding: 35px;
      border-radius: 12px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.03);
      border-top: 8px solid #D4AF37; /* Luxury Gold */
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #D4AF37;
      padding-bottom: 20px;
      margin-bottom: 25px;
      flex-direction: ${isUrdu ? 'row-reverse' : 'row'};
    }

    .logo-area h1 {
      margin: 0;
      font-size: 24px;
      color: #0f2346; /* Luxury Navy */
      font-weight: 800;
      letter-spacing: 0.5px;
    }

    .logo-area p {
      margin: 3px 0 0 0;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 3px;
      color: #D4AF37;
      font-weight: 700;
    }

    .logo-area .address {
      margin: 6px 0 0 0;
      font-size: 9px;
      color: #64748b;
    }

    .title-area {
      text-align: ${isUrdu ? 'left' : 'right'};
    }

    .title-area h2 {
      margin: 0;
      font-size: 16px;
      color: #0f2346;
      font-weight: 900;
      background: #f1f5f9;
      padding: 8px 16px;
      border-radius: 8px;
      display: inline-block;
      border: 1.5px solid #cbd5e1;
    }

    .title-area p {
      margin: 6px 0 0 0;
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 15px;
      margin-bottom: 25px;
      background: #f8fafc;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #f1f5f9;
    }

    .meta-block h3 {
      font-size: 9px;
      text-transform: uppercase;
      color: #D4AF37;
      margin-bottom: 4px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .meta-block p {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
      text-align: ${isUrdu ? 'right' : 'left'};
    }

    th {
      background-color: #0f2346;
      color: #ffffff;
      font-weight: 800;
      font-size: 11.5px;
      text-transform: uppercase;
      padding: 11px 12px;
      border: 1.5px solid #1e293b;
      letter-spacing: 0.5px;
    }

    td {
      padding: 10px 12px;
      border-bottom: 1px solid #cbd5e1;
      color: #0f172a;
      font-weight: 700;
      font-size: 11.5px;
    }

    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    .footer-row td {
      font-weight: 900;
      font-size: 12px;
      background-color: #f1f5f9 !important;
      color: #0f2346;
      border-top: 2.5px solid #0f2346;
      border-bottom: 3.5px double #0f2346;
    }

    .notes-area {
      margin-top: 30px;
      padding: 15px;
      border-left: ${isUrdu ? 'none' : '4px solid #D4AF37'};
      border-right: ${isUrdu ? '4px solid #D4AF37' : 'none'};
      background-color: #fffdf5;
      font-size: 9px;
      color: #475569;
      border-radius: 4px;
    }

    .footer-note {
      text-align: center;
      font-size: 8px;
      color: #94a3b8;
      margin-top: 40px;
      border-top: 1px dashed #e2e8f0;
      padding-top: 15px;
    }

    @media print {
      body {
        padding: 0;
        background: #fff;
      }
      .report-card {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
      @page {
        size: A4 ${opts.layout === 'landscape' ? 'landscape' : 'portrait'};
        margin: 1cm;
      }
    }
  </style>
</head>
<body>
  <div class="report-card">
    <div class="header">
      <div class="logo-area">
        <h1>MARGALLA GATEWAY</h1>
        <p>Luxury Residences</p>
        <div class="address">E-11/4, Street No 26-A, Islamabad, Pakistan · Contact: +92 (51) 111-222-333</div>
      </div>
      <div class="title-area">
        <h2>${title}</h2>
        <p>${subtitle}</p>
      </div>
    </div>

    ${metaHtml}

    <table>
      <thead>
        ${headersHtml}
      </thead>
      <tbody>
        ${rowsHtml}
        ${footerHtml}
      </tbody>
    </table>

    ${notes ? `
    <div class="notes-area">
      <strong>${isUrdu ? 'ہدایات / نوٹ:' : 'Instructions / Notes:'}</strong>
      <p>${notes}</p>
    </div>` : ""}

    <div class="footer-note">
      Generated ${new Date().toLocaleString()} · Margalla Gateway Management Suite · Confidential Document
    </div>
  </div>
</body>
</html>
  `;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
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
        setTimeout(() => {
          if (iframe.parentNode) document.body.removeChild(iframe);
        }, 1500);
      }
    }, 500);
  }
}

export function downloadLedgerPDF(opts: {
  accountLabel: string;
  accountType: string;
  rows: LedgerRow[];
  fileName?: string;
  previousBalance?: number;
  fromDate?: string;
  toDate?: string;
}) {
  const isUrdu = typeof localStorage !== 'undefined' && localStorage.getItem('lang') === 'ur';
  let running = opts.previousBalance || 0;
  
  const body = [[
    opts.fromDate || "",
    isUrdu ? "افتتاحی بقایا" : "Opening / Previous Balance B/F",
    "—", "—",
    `PKR ${running.toLocaleString()}`
  ]];

  opts.rows.forEach(r => {
    running += Number(r.debit || 0) - Number(r.credit || 0);
    body.push([
      r.entry_date,
      r.description,
      r.debit ? `PKR ${Number(r.debit).toLocaleString()}` : "—",
      r.credit ? `PKR ${Number(r.credit).toLocaleString()}` : "—",
      `PKR ${running.toLocaleString()}`
    ]);
  });

  const totalDr = opts.rows.reduce((s, r) => s + Number(r.debit || 0), 0);
  const totalCr = opts.rows.reduce((s, r) => s + Number(r.credit || 0), 0);

  printHTMLReport({
    title: "Account Ledger Statement",
    titleUrdu: "کھاتہ لیجر اسٹیٹمنٹ",
    fileName: opts.fileName || `Ledger_${opts.accountLabel.replace(/\s+/g, "_")}.pdf`,
    metaFields: [
      { label: "Account Label", labelUrdu: "کھاتہ کا نام", value: opts.accountLabel },
      { label: "Account Type", labelUrdu: "کھاتہ کی قسم", value: opts.accountType },
      { label: "Period", labelUrdu: "مدت", value: `${opts.fromDate || "Start"} to ${opts.toDate || "Today"}` }
    ],
    tableHeaders: [
      { text: "Date", textUrdu: "تاریخ" },
      { text: "Description", textUrdu: "تفصیل" },
      { text: "Debit (PKR)", textUrdu: "نام (ڈیبٹ)" },
      { text: "Credit (PKR)", textUrdu: "جمع (کریڈٹ)" },
      { text: "Balance", textUrdu: "بقایا" }
    ],
    tableRows: body,
    footerRows: [[
      "",
      isUrdu ? "کل میزان" : "Total Summary",
      `PKR ${totalDr.toLocaleString()}`,
      `PKR ${totalCr.toLocaleString()}`,
      `PKR ${(running).toLocaleString()}`
    ]]
  });
}

export function downloadInvoicePDF(opts: {
  invoiceNo: string;
  date: string;
  billTo: { name: string; apartment?: string | null; phone?: string | null };
  lineItem: { label: string; amount: number; meterReadings?: string | null };
  dueDate?: string | null;
  bankDetails?: string;
}) {
  const isUrdu = typeof localStorage !== 'undefined' && localStorage.getItem('lang') === 'ur';
  const name = opts.invoiceNo.replace(/[^a-zA-Z0-9-]/g, "_");
  
  const headers = opts.lineItem.meterReadings 
    ? [
        { text: "Description", textUrdu: "تفصیل" },
        { text: "Meter Readings", textUrdu: "میٹر ریڈنگ" },
        { text: "Amount (PKR)", textUrdu: "رقم" }
      ]
    : [
        { text: "Description", textUrdu: "تفصیل" },
        { text: "Amount (PKR)", textUrdu: "رقم" }
      ];

  const body = opts.lineItem.meterReadings
    ? [[opts.lineItem.label, opts.lineItem.meterReadings, `PKR ${opts.lineItem.amount.toLocaleString()}`]]
    : [[opts.lineItem.label, `PKR ${opts.lineItem.amount.toLocaleString()}`]];

  printHTMLReport({
    title: "Invoice / Bill",
    titleUrdu: "انوائس / بل",
    fileName: `Invoice_${opts.billTo.apartment || "Res"}_${name}.pdf`,
    metaFields: [
      { label: "Invoice No", labelUrdu: "انوائس نمبر", value: opts.invoiceNo },
      { label: "Billing Date", labelUrdu: "تاریخ", value: opts.date },
      { label: "Due Date", labelUrdu: "آخری تاریخ", value: opts.dueDate || "Immediate" },
      { label: "Bill To", labelUrdu: "بنام رہائشی", value: `${opts.billTo.name} (Unit: ${opts.billTo.apartment || "—"})` }
    ],
    tableHeaders: headers,
    tableRows: body,
    footerRows: opts.lineItem.meterReadings
      ? [[isUrdu ? "کل واجب الادا رقم" : "TOTAL DUE", "", `PKR ${opts.lineItem.amount.toLocaleString()}`]]
      : [[isUrdu ? "کل واجب الادا رقم" : "TOTAL DUE", `PKR ${opts.lineItem.amount.toLocaleString()}`]],
    notes: opts.bankDetails || "Please transfer dues to the society office bank account.",
    notesUrdu: opts.bankDetails || "براہ کرم سوسائٹی کے آفیشل بینک اکاؤنٹ میں واجبات جمع کروائیں۔"
  });
}

export function downloadSalarySlipPDF(opts: {
  employee: { name: string; role: string; cnic?: string | null; joinDate?: string | null };
  period: string;
  grossSalary: number;
  advanceDeducted: number;
  netPaid: number;
  paidAt: string;
}) {
  const isUrdu = typeof localStorage !== 'undefined' && localStorage.getItem('lang') === 'ur';
  printHTMLReport({
    title: "Salary Slip",
    titleUrdu: "تنخواہ کی پرچی",
    fileName: `SalarySlip_${opts.employee.name.replace(/\s+/g, "_")}_${opts.period.replace(/\s+/g, "_")}.pdf`,
    metaFields: [
      { label: "Employee Name", labelUrdu: "ملازم کا نام", value: opts.employee.name },
      { label: "Role", labelUrdu: "عہدہ", value: opts.employee.role },
      { label: "Pay Period", labelUrdu: "تنخواہ کی مدت", value: opts.period },
      { label: "Payment Date", labelUrdu: "ادائیگی کی تاریخ", value: opts.paidAt }
    ],
    tableHeaders: [
      { text: "Earnings & Deductions Description", textUrdu: "تنخواہ اور کٹوتیوں کی تفصیل" },
      { text: "Amount (PKR)", textUrdu: "رقم" }
    ],
    tableRows: [
      [isUrdu ? "بنیادی تنخواہ (Gross)" : "Gross Salary", `PKR ${opts.grossSalary.toLocaleString()}`],
      [isUrdu ? "ایڈوانس کٹوتی (Deduction)" : "Advance Salary Recovered", `- PKR ${opts.advanceDeducted.toLocaleString()}`]
    ],
    footerRows: [
      [isUrdu ? "کل قابل ادائیگی تنخواہ (Net Paid)" : "NET PAID AMOUNT", `PKR ${opts.netPaid.toLocaleString()}`]
    ],
    notes: "Note: This is a system-generated salary slip and does not require physical signature under digital validation.",
    notesUrdu: "نوٹ: یہ ایک خودکار سسٹم سے تیار کردہ پرچی ہے جس پر دستخط کی ضرورت نہیں ہے۔"
  });
}

export function downloadTrialBalancePDF(opts: {
  from: string; to: string;
  rows: Array<{ code: string; name: string; account_type: string; total_debit: number; total_credit: number; balance: number }>;
}) {
  const isUrdu = typeof localStorage !== 'undefined' && localStorage.getItem('lang') === 'ur';
  const totalDr = opts.rows.reduce((s, r) => s + Number(r.total_debit), 0);
  const totalCr = opts.rows.reduce((s, r) => s + Number(r.total_credit), 0);

  printHTMLReport({
    title: "Trial Balance",
    titleUrdu: "ٹرائل بیلنس شیٹ",
    fileName: `Trial_Balance_${opts.from}_to_${opts.to}.pdf`,
    metaFields: [
      { label: "Period From", labelUrdu: "شروع تاریخ", value: opts.from },
      { label: "Period To", labelUrdu: "آخری تاریخ", value: opts.to }
    ],
    tableHeaders: [
      { text: "Account Head", textUrdu: "کھاتہ کا نام" },
      { text: "Type", textUrdu: "قسم" },
      { text: "Debit (PKR)", textUrdu: "ڈیبٹ (نام)" },
      { text: "Credit (PKR)", textUrdu: "کریڈٹ (جمع)" },
      { text: "Balance", textUrdu: "بقایا بیلنس" }
    ],
    tableRows: opts.rows.map(r => [
      r.name, r.account_type.toUpperCase(),
      `PKR ${r.total_debit.toLocaleString()}`,
      `PKR ${r.total_credit.toLocaleString()}`,
      `PKR ${r.balance.toLocaleString()}`
    ]),
    footerRows: [[
      isUrdu ? "کل میزان" : "TOTAL TRIAL VALUE", "",
      `PKR ${totalDr.toLocaleString()}`,
      `PKR ${totalCr.toLocaleString()}`,
      `PKR ${(totalDr - totalCr).toLocaleString()}`
    ]]
  });
}

export function downloadProfitLossPDF(opts: {
  from: string; to: string;
  rows: Array<{ code: string; name: string; account_type: string; amount: number }>;
}) {
  const isUrdu = typeof localStorage !== 'undefined' && localStorage.getItem('lang') === 'ur';
  const income = opts.rows.filter(r => r.account_type === "income");
  const expense = opts.rows.filter(r => r.account_type === "expense");
  const totalIncome = income.reduce((s, r) => s + Number(r.amount), 0);
  const totalExpense = expense.reduce((s, r) => s + Number(r.amount), 0);
  const net = totalIncome - totalExpense;

  const body = [
    [isUrdu ? "--- آمدنی کے ذرائع ---" : "--- REVENUE HEADS ---", ""],
    ...income.map(r => [r.name, `PKR ${r.amount.toLocaleString()}`]),
    [isUrdu ? "کل آمدنی" : "Total Revenue", `PKR ${totalIncome.toLocaleString()}`],
    ["", ""],
    [isUrdu ? "--- اخراجات کی تفصیل ---" : "--- OPERATING EXPENSES ---", ""],
    ...expense.map(r => [r.name, `PKR ${r.amount.toLocaleString()}`]),
    [isUrdu ? "کل اخراجات" : "Total Expenses", `PKR ${totalExpense.toLocaleString()}`]
  ];

  printHTMLReport({
    title: "Profit & Loss Statement",
    titleUrdu: "منافع اور نقصان کا گوشوارہ",
    fileName: `Profit_Loss_${opts.from}_to_${opts.to}.pdf`,
    metaFields: [
      { label: "Report Period", labelUrdu: "مدت رپورٹ", value: `${opts.from} to ${opts.to}` }
    ],
    tableHeaders: [
      { text: "Financial Head Description", textUrdu: "تفصیل کھاتہ" },
      { text: "Amount (PKR)", textUrdu: "رقم" }
    ],
    tableRows: body,
    footerRows: [[
      net >= 0 ? (isUrdu ? "خالص منافع (Net Profit)" : "NET PROFIT") : (isUrdu ? "خالص نقصان (Net Loss)" : "NET LOSS"),
      `PKR ${Math.abs(net).toLocaleString()}`
    ]]
  });
}

export function downloadBalanceSheetPDF(opts: {
  asOf: string;
  rows: Array<{ code: string; name: string; account_type: string; amount: number }>;
}) {
  const isUrdu = typeof localStorage !== 'undefined' && localStorage.getItem('lang') === 'ur';
  const assets = opts.rows.filter(r => r.account_type === "asset");
  const liabilities = opts.rows.filter(r => r.account_type === "liability");
  const equity = opts.rows.filter(r => r.account_type === "equity");
  
  const totA = assets.reduce((s, r) => s + Number(r.amount), 0);
  const totL = liabilities.reduce((s, r) => s + Number(r.amount), 0);
  const totE = equity.reduce((s, r) => s + Number(r.amount), 0);

  const body = [
    [isUrdu ? "--- اثاثہ جات ---" : "--- ASSETS ---", ""],
    ...assets.map(r => [r.name, `PKR ${r.amount.toLocaleString()}`]),
    [isUrdu ? "کل اثاثے" : "Total Assets", `PKR ${totA.toLocaleString()}`],
    ["", ""],
    [isUrdu ? "--- واجبات ---" : "--- LIABILITIES ---", ""],
    ...liabilities.map(r => [r.name, `PKR ${r.amount.toLocaleString()}`]),
    [isUrdu ? "کل واجبات" : "Total Liabilities", `PKR ${totL.toLocaleString()}`],
    ["", ""],
    [isUrdu ? "--- سرمایہ / ایکویٹی ---" : "--- EQUITY ---", ""],
    ...equity.map(r => [r.name, `PKR ${r.amount.toLocaleString()}`]),
    [isUrdu ? "کل سرمایہ" : "Total Equity", `PKR ${totE.toLocaleString()}`]
  ];

  printHTMLReport({
    title: "Balance Sheet",
    titleUrdu: "میزانِ حق (بیلنس شیٹ)",
    fileName: `Balance_Sheet_${opts.asOf}.pdf`,
    metaFields: [
      { label: "Statement Date", labelUrdu: "تک کی تاریخ", value: opts.asOf }
    ],
    tableHeaders: [
      { text: "Account Classification", textUrdu: "تفصیل اثاثہ و واجبات" },
      { text: "Valuation (PKR)", textUrdu: "رقم" }
    ],
    tableRows: body,
    footerRows: [
      [isUrdu ? "کل واجبات اور سرمایہ" : "TOTAL LIABILITIES & EQUITY", `PKR ${(totL + totE).toLocaleString()}`],
      [isUrdu ? "کل اثاثہ جات" : "TOTAL ASSETS", `PKR ${totA.toLocaleString()}`]
    ]
  });
}

export function downloadApartmentsPDF(apts: any[]) {
  printHTMLReport({
    title: "Apartments List Report",
    titleUrdu: "اپارٹمنٹس کی فہرست",
    fileName: `Apartments_List_${new Date().toISOString().slice(0, 10)}.pdf`,
    tableHeaders: [
      { text: "Unit", textUrdu: "فلیٹ نمبر" },
      { text: "Floor", textUrdu: "منزل" },
      { text: "Type", textUrdu: "قسم" },
      { text: "Area", textUrdu: "رقبہ" },
      { text: "Monthly Rent", textUrdu: "ماہانہ کرایہ" },
      { text: "Owner / Malkiyat", textUrdu: "مالک کا نام" },
      { text: "Status", textUrdu: "حالت" }
    ],
    tableRows: apts.map(a => [
      a.number,
      a.floor ?? "—",
      a.type ?? "—",
      a.area_sqft ? `${a.area_sqft} sqft` : "—",
      `PKR ${Number(a.rent || 0).toLocaleString()}`,
      a.owner_name || "Margalla Gateway",
      String(a.status).toUpperCase()
    ])
  });
}

export function downloadTenantsPDF(tenants: any[]) {
  printHTMLReport({
    title: "Tenants Portal Directory",
    titleUrdu: "کرایہ داروں کی ڈائریکٹری",
    fileName: `Tenants_Roster_${new Date().toISOString().slice(0, 10)}.pdf`,
    layout: "landscape",
    tableHeaders: [
      { text: "Tenant Name", textUrdu: "کرایہ دار کا نام" },
      { text: "Apartment", textUrdu: "اپارٹمنٹ" },
      { text: "Phone", textUrdu: "فون نمبر" },
      { text: "Client ID", textUrdu: "کلائنٹ آئی ڈی" },
      { text: "CNIC", textUrdu: "شناختی کارڈ نمبر" },
      { text: "Monthly Rent", textUrdu: "ماہانہ کرایہ" },
      { text: "Security Deposit", textUrdu: "سیکیورٹی جمع" }
    ],
    tableRows: tenants.map(t => [
      t.full_name || "—",
      t.apartment_no || "—",
      t.phone || "—",
      t.client_id || "—",
      t.cnic || "—",
      `PKR ${Number(t.rent_amount || 0).toLocaleString()}`,
      `PKR ${Number(t.security_deposit || 0).toLocaleString()}`
    ])
  });
}

export function downloadStaffPDF(staff: any[]) {
  printHTMLReport({
    title: "Staff Registry",
    titleUrdu: "ملازمین کی فہرست",
    fileName: `Staff_Registry_${new Date().toISOString().slice(0, 10)}.pdf`,
    layout: "landscape",
    tableHeaders: [
      { text: "Name", textUrdu: "نام ملازم" },
      { text: "Role", textUrdu: "عہدہ" },
      { text: "Phone", textUrdu: "فون نمبر" },
      { text: "CNIC", textUrdu: "شناختی کارڈ" },
      { text: "Monthly Salary", textUrdu: "ماہانہ تنخواہ" },
      { text: "Advance Balance", textUrdu: "ایڈوانس بقایا" },
      { text: "Status", textUrdu: "حالت" }
    ],
    tableRows: staff.map(s => [
      s.full_name,
      s.role,
      s.phone || "—",
      s.cnic || "—",
      `PKR ${Number(s.salary || 0).toLocaleString()}`,
      Number(s.advance_balance) > 0 ? `PKR ${Number(s.advance_balance).toLocaleString()}` : "—",
      String(s.status).toUpperCase()
    ])
  });
}

export function downloadComplaintsPDF(complaints: any[]) {
  printHTMLReport({
    title: "Complaints & Maintenance Log",
    titleUrdu: "شکایات اور دیکھ بھال کا لاگ",
    fileName: `Complaints_Log_${new Date().toISOString().slice(0, 10)}.pdf`,
    layout: "landscape",
    tableHeaders: [
      { text: "Ticket ID", textUrdu: "شکایت نمبر" },
      { text: "Title", textUrdu: "عنوان" },
      { text: "Category", textUrdu: "زمرہ" },
      { text: "Priority", textUrdu: "ترجیح" },
      { text: "Apartment", textUrdu: "اپارٹمنٹ" },
      { text: "Status", textUrdu: "حالت" },
      { text: "Assigned To", textUrdu: "نام ملازم" },
      { text: "Cost", textUrdu: "لاگت" }
    ],
    tableRows: complaints.map(c => [
      c.id.slice(0, 8).toUpperCase(),
      c.title,
      c.category,
      String(c.priority).toUpperCase(),
      c.apartment_no || "—",
      String(c.status).toUpperCase(),
      c.assigned_to || "Unassigned",
      c.maintenance_cost ? `PKR ${Number(c.maintenance_cost).toLocaleString()}` : "—"
    ])
  });
}

export function downloadVisitorsPDF(visitors: any[]) {
  printHTMLReport({
    title: "Visitor Log Registry",
    titleUrdu: "مہمانوں کا رجسٹر",
    fileName: `Visitor_Log_${new Date().toISOString().slice(0, 10)}.pdf`,
    layout: "landscape",
    tableHeaders: [
      { text: "Visitor Name", textUrdu: "مہمان کا نام" },
      { text: "Apartment", textUrdu: "اپارٹمنٹ" },
      { text: "CNIC", textUrdu: "شناختی کارڈ" },
      { text: "Phone", textUrdu: "فون نمبر" },
      { text: "Purpose", textUrdu: "مقصد" },
      { text: "Vehicle", textUrdu: "گاڑی نمبر" },
      { text: "In Time", textUrdu: "آمد کا وقت" },
      { text: "Out Time", textUrdu: "روانگی کا وقت" }
    ],
    tableRows: visitors.map(v => [
      v.visitor_name,
      v.apartment_no || "—",
      v.cnic || "—",
      v.phone || "—",
      v.purpose || "—",
      v.vehicle_no || "—",
      v.in_time ? new Date(v.in_time).toLocaleString() : "—",
      v.out_time ? new Date(v.out_time).toLocaleString() : "—"
    ])
  });
}

export function downloadIncomeReportPDF(entries: any[]) {
  printHTMLReport({
    title: "Income & Financial Report",
    titleUrdu: "مالیاتی آمدنی کی رپورٹ",
    fileName: `Financial_Income_${new Date().toISOString().slice(0, 10)}.pdf`,
    tableHeaders: [
      { text: "Date", textUrdu: "تاریخ" },
      { text: "Type", textUrdu: "قسم" },
      { text: "Category", textUrdu: "زمرہ" },
      { text: "Description", textUrdu: "تفصیل" },
      { text: "Amount", textUrdu: "رقم" },
      { text: "Balance After", textUrdu: "بقایا بیلنس" }
    ],
    tableRows: entries.map(e => [
      e.entry_date || "—",
      String(e.type).toUpperCase() || "—",
      e.category || "—",
      e.description || "—",
      `PKR ${Number(e.amount || 0).toLocaleString()}`,
      `PKR ${Number(e.balance_after || 0).toLocaleString()}`
    ])
  });
}

export function downloadParkingReportPDF(slots: any[]) {
  printHTMLReport({
    title: "Parking Slots Allocation Report",
    titleUrdu: "پارکنگ سلاٹ الاٹمنٹ رپورٹ",
    fileName: `Parking_Slots_${new Date().toISOString().slice(0, 10)}.pdf`,
    tableHeaders: [
      { text: "Slot #", textUrdu: "سلاٹ نمبر" },
      { text: "Status", textUrdu: "حالت" },
      { text: "Apartment", textUrdu: "اپارٹمنٹ" },
      { text: "Resident", textUrdu: "رہائشی" },
      { text: "Vehicle Details", textUrdu: "گاڑی کی تفصیل" },
      { text: "License Plate", textUrdu: "نمبر پلیٹ" },
      { text: "Allocated At", textUrdu: "تاریخ الاٹمنٹ" }
    ],
    tableRows: slots.map(s => [
      s.id || s.slot_number || "—",
      String(s.status).toUpperCase(),
      s.apartmentNo || s.assigned_tenant_apartment || "—",
      s.residentName || s.assigned_tenant_name || "—",
      s.vehicleDetails || "—",
      s.licensePlate || "—",
      s.allocatedAt || s.created_at || "—"
    ])
  });
}

export function downloadDailyRentBookingsPDF(bookings: any[]) {
  const activeRevenue = bookings
    .filter(b => b.status !== "cancelled")
    .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

  printHTMLReport({
    title: "Daily Rent Bookings Report",
    titleUrdu: "روزانہ کرایہ بکنگ رپورٹ",
    fileName: `Daily_Bookings_${new Date().toISOString().slice(0, 10)}.pdf`,
    layout: "landscape",
    tableHeaders: [
      { text: "Check-In Date", textUrdu: "آمد کی تاریخ" },
      { text: "Unit", textUrdu: "کمرہ / یونٹ" },
      { text: "Guest Name", textUrdu: "مہمان کا نام" },
      { text: "Guest Phone", textUrdu: "فون نمبر" },
      { text: "Nights", textUrdu: "راتیں" },
      { text: "Rate/Night", textUrdu: "کرایہ فی رات" },
      { text: "Total Amount", textUrdu: "کل رقم" },
      { text: "Status", textUrdu: "حالت" }
    ],
    tableRows: bookings.map(b => [
      b.check_in_date || "—",
      b.apartment_no || "—",
      b.guest_name || "—",
      b.guest_phone || "—",
      String(b.nights || 0),
      `PKR ${Number(b.rate_per_night || 0).toLocaleString()}`,
      `PKR ${Number(b.total_amount || 0).toLocaleString()}`,
      String(b.status).toUpperCase()
    ]),
    footerRows: [[
      "TOTAL REVENUE (ACTIVE)", "", "", "", "", "",
      `PKR ${activeRevenue.toLocaleString()}`, ""
    ]]
  });
}

export function downloadDealerCommissionsPDF(commList: any[]) {
  const totalCommission = commList.reduce((sum, c) => sum + Number(c.dealer_commission || 0), 0);

  printHTMLReport({
    title: "Dealer Commissions Report",
    titleUrdu: "ڈیلر کمیشن کی رپورٹ",
    fileName: `Dealer_Commissions_${new Date().toISOString().slice(0, 10)}.pdf`,
    layout: "landscape",
    tableHeaders: [
      { text: "Apartment Unit", textUrdu: "اپارٹمنٹ" },
      { text: "Status", textUrdu: "حالت" },
      { text: "Monthly Rent", textUrdu: "ماہانہ کرایہ" },
      { text: "Owner Name", textUrdu: "مالک کا نام" },
      { text: "Dealer / Agency Name", textUrdu: "ڈیلر کا نام" },
      { text: "Commission Amount", textUrdu: "کمیشن رقم" }
    ],
    tableRows: commList.map(c => [
      c.number || "—",
      String(c.status).toUpperCase() || "—",
      `PKR ${Number(c.rent || 0).toLocaleString()}`,
      c.owner_name || "—",
      c.dealer_company || "—",
      `PKR ${Number(c.dealer_commission || 0).toLocaleString()}`
    ]),
    footerRows: [[
      "TOTAL COMMISSIONS", "", "", "", "",
      `PKR ${totalCommission.toLocaleString()}`
    ]]
  });
}

export function downloadManualAssetsPDF(assets: any[]) {
  const totalOriginalCost = assets.reduce((sum, a) => sum + Number(a.purchase_rate || 0), 0);
  const totalCurrentValue = assets.reduce((sum, a) => sum + Number(a.current_manual_rate || 0), 0);

  printHTMLReport({
    title: "Manual Company Assets Report",
    titleUrdu: "کمپنی اثاثہ جات کی دستی رپورٹ",
    fileName: `Manual_Assets_${new Date().toISOString().slice(0, 10)}.pdf`,
    tableHeaders: [
      { text: "Asset Code", textUrdu: "اثاثہ کوڈ" },
      { text: "Asset Name", textUrdu: "نامِ اثاثہ" },
      { text: "Category", textUrdu: "زمرہ" },
      { text: "Original Purchase Cost", textUrdu: "اصل قیمت خرید" },
      { text: "Current Manual Rate", textUrdu: "موجودہ قیمت" },
      { text: "Remarks", textUrdu: "ریمارکس" }
    ],
    tableRows: assets.map(a => [
      a.asset_code,
      a.asset_name,
      a.category,
      `PKR ${Number(a.purchase_rate || 0).toLocaleString()}`,
      `PKR ${Number(a.current_manual_rate || 0).toLocaleString()}`,
      a.remarks || "—"
    ]),
    footerRows: [[
      "TOTALS", "", "",
      `PKR ${totalOriginalCost.toLocaleString()}`,
      `PKR ${totalCurrentValue.toLocaleString()}`, ""
    ]]
  });
}

export function downloadInventoryStockPDF(items: any[]) {
  const totalQty = items.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
  const totalVal = items.reduce((sum, i) => sum + Number(i.total_value || 0), 0);

  printHTMLReport({
    title: "Maintenance Inventory Stock Report",
    titleUrdu: "مینٹیننس انوینٹری اسٹاک رپورٹ",
    fileName: `Inventory_Stock_${new Date().toISOString().slice(0, 10)}.pdf`,
    tableHeaders: [
      { text: "Item ID", textUrdu: "آئٹم کوڈ" },
      { text: "Item Name", textUrdu: "آئٹم کا نام" },
      { text: "Quantity", textUrdu: "تعداد" },
      { text: "Unit Cost", textUrdu: "قیمت فی اکائی" },
      { text: "Total Value", textUrdu: "کل مالیت" }
    ],
    tableRows: items.map(i => [
      i.item_id,
      i.item_name,
      Number(i.quantity).toLocaleString(),
      `PKR ${Number(i.unit_cost || 0).toLocaleString()}`,
      `PKR ${Number(i.total_value || 0).toLocaleString()}`
    ]),
    footerRows: [[
      "TOTALS", "", totalQty.toLocaleString(), "",
      `PKR ${totalVal.toLocaleString()}`
    ]]
  });
}

export function downloadApartmentAssetsPDF(assets: any[]) {
  const totalOriginalCost = assets.reduce((sum, a) => sum + Number(a.purchase_rate || 0), 0);
  const totalCurrentValue = assets.reduce((sum, a) => sum + Number(a.current_manual_rate || 0), 0);

  printHTMLReport({
    title: "Apartment Fixed Assets Report",
    titleUrdu: "اپارٹمنٹ فکسڈ اثاثہ جات رپورٹ",
    fileName: `Apartment_Assets_${new Date().toISOString().slice(0, 10)}.pdf`,
    layout: "landscape",
    tableHeaders: [
      { text: "Asset Code", textUrdu: "کوڈ" },
      { text: "Apt #", textUrdu: "اپارٹمنٹ" },
      { text: "Asset Name", textUrdu: "نام اثاثہ" },
      { text: "Category", textUrdu: "زمرہ" },
      { text: "Original Cost", textUrdu: "اصل لاگت" },
      { text: "Current Value", textUrdu: "موجودہ مالیت" },
      { text: "Remarks", textUrdu: "تفصیل" }
    ],
    tableRows: assets.map(a => [
      a.asset_code,
      a.apartment_no,
      a.asset_name,
      a.category,
      `PKR ${Number(a.purchase_rate || 0).toLocaleString()}`,
      `PKR ${Number(a.current_manual_rate || 0).toLocaleString()}`,
      a.remarks || "—"
    ]),
    footerRows: [[
      "TOTALS", "", "", "",
      `PKR ${totalOriginalCost.toLocaleString()}`,
      `PKR ${totalCurrentValue.toLocaleString()}`, ""
    ]]
  });
}

export function downloadRentalBillPDF(opts: {
  invoiceNo: string;
  date: string;
  billTo: { name: string; apartment?: string | null; phone?: string | null };
  electricityDetails: {
    prev: number;
    curr: number;
    rate: number;
    arrears: number;
    cost: number;
  };
  fixedGasCost: number;
  baseRent: number;
  consolidatedMaintenance: number;
  grandTotalNetBill: number;
  cashReceived?: number;
}) {
  const isUrdu = typeof localStorage !== 'undefined' && localStorage.getItem('lang') === 'ur';
  const cashPaid = opts.cashReceived || 0;
  const netRemaining = opts.grandTotalNetBill - cashPaid;
  const currentBill = opts.grandTotalNetBill - opts.electricityDetails.arrears;

  printHTMLReport({
    title: "UTILITY & MAINTENANCE STATEMENT",
    titleUrdu: "یوٹیلیٹی اور مینٹیننس بل اسٹیٹمنٹ",
    fileName: `Invoice_${opts.invoiceNo}.pdf`,
    metaFields: [
      { label: "Invoice No", labelUrdu: "انوائس نمبر", value: opts.invoiceNo },
      { label: "Billing Date", labelUrdu: "بل کی تاریخ", value: opts.date },
      { label: "Apartment", labelUrdu: "اپارٹمنٹ نمبر", value: opts.billTo.apartment || "—" },
      { label: "Resident Name", labelUrdu: "رہائشی کا نام", value: opts.billTo.name }
    ],
    tableHeaders: [
      { text: "Description", textUrdu: "تفصیل بل" },
      { text: "Calculation / Details", textUrdu: "حساب کتاب کی تفصیل" },
      { text: "Amount (PKR)", textUrdu: "رقم" }
    ],
    tableRows: [
      [
        isUrdu ? "ماہانہ اپارٹمنٹ کرایہ" : "Monthly Flat Rent",
        isUrdu ? "فلیٹ رینٹ معاہدہ" : "Fixed Monthly Apartment Contract Rent",
        `PKR ${opts.baseRent.toLocaleString()}`
      ],
      [
        isUrdu ? "فکسڈ بلڈنگ مینٹیننس چارجز" : "Consolidated Maintenance Fee",
        isUrdu ? "سیکیورٹی، پانی اور سروسز فیس" : "Includes Water, Security, and Building Operations",
        `PKR ${opts.consolidatedMaintenance.toLocaleString()}`
      ],
      [
        isUrdu ? "بجلی کے چارجز" : "Electricity Cost",
        isUrdu ? `یونٹس: ${opts.electricityDetails.curr - opts.electricityDetails.prev} (${opts.electricityDetails.prev} سے ${opts.electricityDetails.curr}) @ PKR ${opts.electricityDetails.rate}/یونٹ` : `Units: ${Math.max(0, opts.electricityDetails.curr - opts.electricityDetails.prev)} (${opts.electricityDetails.prev} to ${opts.electricityDetails.curr}) @ PKR ${opts.electricityDetails.rate}/unit`,
        `PKR ${opts.electricityDetails.cost.toLocaleString()}`
      ],
      [
        isUrdu ? "سلیٹر گیس چارجز" : "Fixed Gas Charges",
        isUrdu ? "ماہانہ گیس فلیٹ ریٹ" : "Flat Rate Utility Charge",
        `PKR ${opts.fixedGasCost.toLocaleString()}`
      ]
    ],
    footerRows: [
      [isUrdu ? "موجودہ مہینے کا بل" : "Total Current Bill", "", `PKR ${currentBill.toLocaleString()}`],
      [isUrdu ? "سابقہ بقایا جات (Arrears)" : "Previous Arrears (Baqaya)", "", `PKR ${opts.electricityDetails.arrears.toLocaleString()}`],
      [isUrdu ? "کل قابل ادا رقم" : "Gross Payable Amount", "", `PKR ${opts.grandTotalNetBill.toLocaleString()}`],
      [isUrdu ? "ادا شدہ رقم" : "Cash Received (Paid)", "", `PKR ${cashPaid.toLocaleString()}`],
      [isUrdu ? "خالص بقایا جات (Baqaya Balance)" : "Net Arrears (Baqaya Balance)", "", `PKR ${netRemaining.toLocaleString()}`]
    ],
    notes: "Please clear outstanding dues immediately to avoid suspension of utility services.",
    notesUrdu: "براہ کرم سسپنشن سے بچنے کے لیے واجب الادا رقم وقت پر جمع کروائیں۔"
  });
}

export function downloadRentCollectionPDF(opts: {
  summaryRows: any[];
  propertyRows: any[];
  apartmentRows: any[];
  residentRows: any[];
}) {
  printHTMLReport({
    title: "Monthly Rent Collection Report",
    titleUrdu: "ماہانہ کرایہ وصولی رپورٹ",
    fileName: `Rent_Collection_${new Date().toISOString().slice(0, 10)}.pdf`,
    layout: "landscape",
    tableHeaders: [
      { text: "Month / Parameter", textUrdu: "مہینہ / تفصیل" },
      { text: "Rent Billed (PKR)", textUrdu: "کل بل شدہ کرایہ" },
      { text: "Rent Collected (PKR)", textUrdu: "کل وصول شدہ کرایہ" },
      { text: "Outstanding Rent (PKR)", textUrdu: "بقایا واجب الادا" },
      { text: "Collection %", textUrdu: "وصولی کی شرح" }
    ],
    tableRows: opts.summaryRows.map(r => [
      r.month,
      `PKR ${r.billed.toLocaleString()}`,
      `PKR ${r.collected.toLocaleString()}`,
      `PKR ${r.outstanding.toLocaleString()}`,
      `${r.percentage.toFixed(1)}%`
    ])
  });
}

export function downloadArrearsRecoveryPDF(opts: {
  propertySummary: any[];
  agingRows: any[];
}) {
  printHTMLReport({
    title: "Arrears Recovery & Aging Analysis",
    titleUrdu: "بقایا جات وصولی اور ایجنگ تجزیہ رپورٹ",
    fileName: `Arrears_Recovery_Aging_${new Date().toISOString().slice(0, 10)}.pdf`,
    layout: "landscape",
    tableHeaders: [
      { text: "Resident Name", textUrdu: "رہائشی کا نام" },
      { text: "Unit", textUrdu: "یونٹ" },
      { text: "ID", textUrdu: "آئی ڈی" },
      { text: "1-30 Days", textUrdu: "1-30 دن" },
      { text: "31-60 Days", textUrdu: "31-60 دن" },
      { text: "61-90 Days", textUrdu: "61-90 دن" },
      { text: "91-120 Days", textUrdu: "91-120 دن" },
      { text: "120+ Days", textUrdu: "120+ دن" },
      { text: "Total Arrears", textUrdu: "کل بقایا" },
      { text: "Recovery %", textUrdu: "وصولی شرح" }
    ],
    tableRows: opts.agingRows.map(r => [
      r.name,
      r.unit,
      r.client_id,
      `PKR ${r.age_30.toLocaleString()}`,
      `PKR ${r.age_60.toLocaleString()}`,
      `PKR ${r.age_90.toLocaleString()}`,
      `PKR ${r.age_120.toLocaleString()}`,
      `PKR ${r.age_plus.toLocaleString()}`,
      `PKR ${r.total.toLocaleString()}`,
      `${Number(r.recovery_rate || 0).toFixed(0)}%`
    ])
  });
}

export function downloadResidentStatementPDF(opts: {
  user: { full_name: string; client_id: string; apartment_no: string };
  opening_balance: number;
  closing_balance: number;
  security_deposit: number;
  entries: Array<{
    id: string;
    entry_date: string;
    entry_type: "rent" | "security" | "maintenance" | "other";
    description: string;
    debit: number;
    credit: number;
    balance_after: number;
    voucher_no?: string;
  }>;
  period?: string;
}) {
  const isUrdu = typeof localStorage !== 'undefined' && localStorage.getItem('lang') === 'ur';
  let running = opts.opening_balance || 0;
  
  const body = [[
    opts.entries[0]?.entry_date || new Date().toISOString().slice(0, 10),
    isUrdu ? "افتتاحی بقایا (B/F)" : "OPENING BALANCE B/F",
    "—", "—",
    `PKR ${running.toLocaleString()}`
  ]];

  opts.entries.forEach(e => {
    running += Number(e.debit || 0) - Number(e.credit || 0);
    body.push([
      e.entry_date,
      e.description,
      e.debit > 0 ? `PKR ${Number(e.debit).toLocaleString()}` : "—",
      e.credit > 0 ? `PKR ${Number(e.credit).toLocaleString()}` : "—",
      `PKR ${running.toLocaleString()}`
    ]);
  });

  printHTMLReport({
    title: "Resident Account Ledger Statement",
    titleUrdu: "رہائشی کھاتہ لیجر اسٹیٹمنٹ",
    fileName: `Statement_${opts.user.full_name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`,
    metaFields: [
      { label: "Resident Name", labelUrdu: "نام رہائشی", value: opts.user.full_name },
      { label: "Client ID", labelUrdu: "کلائنٹ آئی ڈی", value: opts.user.client_id },
      { label: "Apartment No", labelUrdu: "اپارٹمنٹ نمبر", value: opts.user.apartment_no },
      { label: "Opening Balance", labelUrdu: "افتتاحی بقایا", value: `PKR ${opts.opening_balance.toLocaleString()}` },
      { label: "Outstanding Balance", labelUrdu: "کل واجب الادا رقم", value: `PKR ${opts.closing_balance.toLocaleString()}` },
      { label: "Security Deposit", labelUrdu: "سیکیورٹی جمع رقم", value: `PKR ${opts.security_deposit.toLocaleString()}` }
    ],
    tableHeaders: [
      { text: "Date", textUrdu: "تاریخ" },
      { text: "Description", textUrdu: "تفصیل" },
      { text: "Debit (PKR)", textUrdu: "نام (ڈیبٹ)" },
      { text: "Credit (PKR)", textUrdu: "جمع (کریڈٹ)" },
      { text: "Running Balance", textUrdu: "بقایا میزان" }
    ],
    tableRows: body,
    footerRows: [[
      "",
      isUrdu ? "مجموعی واجب الادا بقایا" : "TOTAL STATEMENT CLOSING DUES",
      `PKR ${opts.entries.reduce((s, e) => s + Number(e.debit || 0), 0).toLocaleString()}`,
      `PKR ${opts.entries.reduce((s, e) => s + Number(e.credit || 0), 0).toLocaleString()}`,
      `PKR ${opts.closing_balance.toLocaleString()}`
    ]]
  });
}
