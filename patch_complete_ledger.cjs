const fs = require('fs');

const filePath = 'src/routes/admin.financial-ledger.tsx';
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/\r\n/g, '\n');

// 1. Update useState signature (remove parking, add rv/pv/ri/rf/general)
const oldUseState = `const [ledgerSubTab, setLedgerSubTab] = useState<"tenant" | "apartment" | "parking" | "staff" | "inventory" | "general">("tenant");`;
if (!content.includes(oldUseState)) {
  // Let's check original signature in restored file:
  const originalStateSignature = `const [ledgerSubTab, setLedgerSubTab] = useState<"tenant" | "apartment" | "parking" | "staff" | "inventory" | "general">("tenant");`;
  // Let's replace the one that exists:
  content = content.replace(/const \[ledgerSubTab,\s*setLedgerSubTab\]\s*=\s*useState<[^>]+>\("tenant"\);/, 
    `const [ledgerSubTab, setLedgerSubTab] = useState<"tenant" | "apartment" | "staff" | "inventory" | "general" | "rv" | "pv" | "ri" | "rf">("tenant");`
  );
  console.log("Updated ledgerSubTab useState signature.");
} else {
  content = content.replace(oldUseState, 
    `const [ledgerSubTab, setLedgerSubTab] = useState<"tenant" | "apartment" | "staff" | "inventory" | "general" | "rv" | "pv" | "ri" | "rf">("tenant");`
  );
  console.log("Updated ledgerSubTab useState signature.");
}

// 2. Update filteredLedgerEntries memo hook logic
const oldFilterHook = `    if (ledgerSubTab === "tenant") {
      if (selectedResidentId) {
        list = list.filter(e => e.user_id === selectedResidentId);
      }
    } else if (ledgerSubTab === "apartment") {
      const selectedRes = (residents || []).find(r => r.id === selectedResidentId);
      const targetApt = selectedRes ? selectedRes.apartment_no : null;
      if (targetApt) {
        list = list.filter(e => {
          const res = (residents || []).find(r => r.id === e.user_id);
          return res && res.apartment_no === targetApt;
        });
      } else {
        list = list.filter(e => {
          const res = (residents || []).find(r => r.id === e.user_id);
          return res && res.apartment_no;
        });
      }
    } else if (ledgerSubTab === "parking") {
      list = list.filter(e => (e.description || "").toLowerCase().includes("parking") || (e.description || "").toLowerCase().includes("park"));
    } else if (ledgerSubTab === "staff") {`;

const newFilterHook = `    if (ledgerSubTab === "tenant") {
      if (selectedResidentId) {
        list = list.filter(e => e.user_id === selectedResidentId);
      }
    } else if (ledgerSubTab === "apartment") {
      const selectedRes = (residents || []).find(r => r.id === selectedResidentId);
      const targetApt = selectedRes ? selectedRes.apartment_no : null;
      if (targetApt) {
        list = list.filter(e => {
          const res = (residents || []).find(r => r.id === e.user_id);
          return res && res.apartment_no === targetApt;
        });
      } else {
        list = list.filter(e => {
          const res = (residents || []).find(r => r.id === e.user_id);
          return res && res.apartment_no;
        });
      }
    } else if (ledgerSubTab === "staff") {`;

if (content.includes(oldFilterHook)) {
  content = content.replace(oldFilterHook, newFilterHook);
  console.log("Updated filteredLedgerEntries logic.");
} else {
  console.error("Could not find oldFilterHook");
}

// 2b. Add general, rv, pv, ri, rf check to filteredLedgerEntries
const oldGeneralFilter = `    } else if (ledgerSubTab === "general") {
      if (selectedResidentId) {
        list = list.filter(e => e.user_id === selectedResidentId);
      }
    }`;

const newGeneralFilter = `    } else if (ledgerSubTab === "general" || ledgerSubTab === "rv" || ledgerSubTab === "pv" || ledgerSubTab === "ri" || ledgerSubTab === "rf") {
      if (selectedResidentId) {
        list = list.filter(e => e.user_id === selectedResidentId);
      }
    }`;

if (content.includes(oldGeneralFilter)) {
  content = content.replace(oldGeneralFilter, newGeneralFilter);
  console.log("Updated general/voucher filters hook.");
}

// 3. Update handlePrintLedger titles and metadata
const oldPrintTitles = `      ledgerSubTab === "general" ? "Master General Ledger" :
      "Inventory Ledger";`;

const newPrintTitles = `      ledgerSubTab === "general" ? "Master General Ledger" :
      ledgerSubTab === "rv" ? "Receipt Voucher RV Ledger" :
      ledgerSubTab === "pv" ? "Payment Voucher PV Ledger" :
      ledgerSubTab === "ri" ? "Rental Invoice RI Ledger" :
      ledgerSubTab === "rf" ? "Refund Voucher RF Ledger" :
      "Inventory Ledger";`;

if (content.includes(oldPrintTitles)) {
  content = content.replace(oldPrintTitles, newPrintTitles);
  console.log("Updated handlePrintLedger titles.");
}

const oldHeaderId = `const headerId = isSingleSelection && singleResident ? singleResident.client_id : (ledgerSubTab === "tenant" ? "ALL TENANTS" : ledgerSubTab === "apartment" ? "ALL APARTMENTS" : ledgerSubTab === "general" ? "MASTER LEDGER" : "ALL");`;
const newHeaderId = `const headerId = isSingleSelection && singleResident ? singleResident.client_id : (ledgerSubTab === "tenant" ? "ALL TENANTS" : ledgerSubTab === "apartment" ? "ALL APARTMENTS" : (ledgerSubTab === "general" || ["rv", "pv", "ri", "rf"].includes(ledgerSubTab)) ? "MASTER LEDGER" : "ALL");`;
if (content.includes(oldHeaderId)) {
  content = content.replace(oldHeaderId, newHeaderId);
}

const oldHeaderName = `const headerName = isSingleSelection && singleResident ? singleResident.full_name + (singleResident.apartment_no ? " / " + singleResident.apartment_no : "") : (ledgerSubTab === "tenant" ? "All Tenant Records" : ledgerSubTab === "general" ? "All Global Transactions" : "All Records");`;
const newHeaderName = `const headerName = isSingleSelection && singleResident ? singleResident.full_name + (singleResident.apartment_no ? " / " + singleResident.apartment_no : "") : (ledgerSubTab === "tenant" ? "All Tenant Records" : (ledgerSubTab === "general" || ["rv", "pv", "ri", "rf"].includes(ledgerSubTab)) ? "All Global Transactions" : "All Records");`;
if (content.includes(oldHeaderName)) {
  content = content.replace(oldHeaderName, newHeaderName);
}

// 4. Update fetchAllLedgerEntries to override vtFilter
const oldFetchBody = `      const res = await apiFetch<any>('/rpc-bridge', {
        method: 'POST',
        body: JSON.stringify({
          name: 'erp_get_ledger_lines',
          data: {
            account_code: accountCode,
            tenant_id: selectedResidentId || undefined,
            voucher_type: ledgerVoucherFilter,
            status: ledgerStatusFilter,
            start_date: ledgerDateFrom || undefined,
            end_date: ledgerDateTo || undefined
          }
        })
      });`;

const newFetchBody = `      let vtFilter = ledgerVoucherFilter;
      if (ledgerSubTab === "rv") vtFilter = "RV";
      else if (ledgerSubTab === "pv") vtFilter = "PV";
      else if (ledgerSubTab === "ri") vtFilter = "INV";
      else if (ledgerSubTab === "rf") vtFilter = "RF";

      const res = await apiFetch<any>('/rpc-bridge', {
        method: 'POST',
        body: JSON.stringify({
          name: 'erp_get_ledger_lines',
          data: {
            account_code: accountCode,
            tenant_id: selectedResidentId || undefined,
            voucher_type: vtFilter,
            status: ledgerStatusFilter,
            start_date: ledgerDateFrom || undefined,
            end_date: ledgerDateTo || undefined
          }
        })
      });`;

if (content.includes(oldFetchBody)) {
  content = content.replace(oldFetchBody, newFetchBody);
  console.log("Updated fetchAllLedgerEntries API body.");
}

// 5. Update Select Profile block for optional rendering
const oldSelectDropdown = `                {ledgerSubTab === "general" ? (
                  <>
                    <Label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Select Profile (Optional)</Label>
                    <select
                      value={selectedResidentId}
                      onChange={(e) => setSelectedResidentId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">-- All General Transactions --</option>
                      {residents.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.full_name} {r.apartment_no ? \`(Apt: \${r.apartment_no})\` : ''} - ID: {r.client_id}
                        </option>
                      ))}
                    </select>
                  </>
                ) : ledgerSubTab === "staff" ? (`;

const newSelectDropdown = `                {(ledgerSubTab === "general" || ledgerSubTab === "rv" || ledgerSubTab === "pv" || ledgerSubTab === "ri" || ledgerSubTab === "rf") ? (
                  <>
                    <Label className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Select Profile (Optional)</Label>
                    <select
                      value={selectedResidentId}
                      onChange={(e) => setSelectedResidentId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">-- All General Transactions --</option>
                      {residents.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.full_name} {r.apartment_no ? \`(Apt: \${r.apartment_no})\` : ''} - ID: {r.client_id}
                        </option>
                      ))}
                    </select>
                  </>
                ) : ledgerSubTab === "staff" ? (`;

if (content.includes(oldSelectDropdown)) {
  content = content.replace(oldSelectDropdown, newSelectDropdown);
  console.log("Updated Select Profile dropdown rendering logic.");
}

// 6. Update UI buttons (remove Parking, fix typo, add Master Ledger, add second row)
const oldButtonsContainer = `              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setLedgerSubTab("tenant")}
                  className={\`text-[10px] font-bold px-3 py-1.5 rounded-md transition \${
                    ledgerSubTab === "tenant" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }\`}
                >
                  Tenant Ledgers
                </button>
                <button
                  onClick={() => setLedgerSubTab("apartment")}
                  className={\`text-[10px] font-bold px-3 py-1.5 rounded-md transition \${
                    ledgerSubTab === "apartment" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }\`}
                >
                  Parking Ledgers
                </button>
                <button
                  onClick={() => setLedgerSubTab("staff")}
                  className={\`text-[10px] font-bold px-3 py-1.5 rounded-md transition \${
                    ledgerSubTab === "staff" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }\`}
                >
                  Staff Ledgers
                </button>
                <button
                  onClick={() => setLedgerSubTab("inventory")}
                  className={\`text-[10px] font-bold px-3 py-1.5 rounded-md transition \${
                    ledgerSubTab === "inventory" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }\`}
                >
                  Inventory Ledgers
                </button>
              </div>`;

const newButtonsContainer = `              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setLedgerSubTab("tenant")}
                  className={\`text-[10px] font-bold px-3 py-1.5 rounded-md transition \${
                    ledgerSubTab === "tenant" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }\`}
                >
                  Tenant Ledgers
                </button>
                <button
                  onClick={() => setLedgerSubTab("apartment")}
                  className={\`text-[10px] font-bold px-3 py-1.5 rounded-md transition \${
                    ledgerSubTab === "apartment" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }\`}
                >
                  Apartment Ledgers
                </button>
                <button
                  onClick={() => setLedgerSubTab("staff")}
                  className={\`text-[10px] font-bold px-3 py-1.5 rounded-md transition \${
                    ledgerSubTab === "staff" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }\`}
                >
                  Staff Ledgers
                </button>
                <button
                  onClick={() => setLedgerSubTab("inventory")}
                  className={\`text-[10px] font-bold px-3 py-1.5 rounded-md transition \${
                    ledgerSubTab === "inventory" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }\`}
                >
                  Inventory Ledgers
                </button>
                <button
                  onClick={() => setLedgerSubTab("general")}
                  className={\`text-[10px] font-bold px-3 py-1.5 rounded-md transition \${
                    ledgerSubTab === "general" ? "bg-amber-600 text-white shadow-[0_0_10px_rgba(217,119,6,0.4)]" : "text-amber-500/70 hover:text-amber-400"
                  }\`}
                >
                  Master Ledger (All)
                </button>
              </div>
            </div>

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
                  className={\`text-[9px] font-bold px-2.5 py-1.5 rounded-md transition \${
                    ledgerSubTab === "rv" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }\`}
                >
                  Receipt Voucher (RV)
                </button>
                <button
                  onClick={() => setLedgerSubTab("pv")}
                  className={\`text-[9px] font-bold px-2.5 py-1.5 rounded-md transition \${
                    ledgerSubTab === "pv" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }\`}
                >
                  Payment Voucher (PV)
                </button>
                <button
                  onClick={() => setLedgerSubTab("ri")}
                  className={\`text-[9px] font-bold px-2.5 py-1.5 rounded-md transition \${
                    ledgerSubTab === "ri" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }\`}
                >
                  Rental Invoice (RI)
                </button>
                <button
                  onClick={() => setLedgerSubTab("rf")}
                  className={\`text-[9px] font-bold px-2.5 py-1.5 rounded-md transition \${
                    ledgerSubTab === "rf" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }\`}
                >
                  Refund Voucher (RF)
                </button>
              </div>`;

if (content.includes(oldButtonsContainer)) {
  content = content.replace(oldButtonsContainer, newButtonsContainer);
  console.log("Injected second row of tab buttons and Master Ledger tab.");
} else {
  console.error("Could not find oldButtonsContainer");
}

// 7. Update Voucher Type dropdown to preselect/disable on subtabs and add Refund (RF) option
const oldVoucherSelect = `                  <Select value={ledgerVoucherFilter} onValueChange={setLedgerVoucherFilter}>
                    <SelectTrigger className="w-full bg-slate-900 border-slate-700 text-xs h-[38px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Types</SelectItem>
                      <SelectItem value="RV">Receipt (RV)</SelectItem>
                      <SelectItem value="PV">Payment (PV)</SelectItem>
                      <SelectItem value="JV">Journal (JV)</SelectItem>
                      <SelectItem value="INV">Invoice (INV)</SelectItem>
                    </SelectContent>
                  </Select>`;

const newVoucherSelect = `                  <Select 
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
                  </Select>`;

if (content.includes(oldVoucherSelect)) {
  content = content.replace(oldVoucherSelect, newVoucherSelect);
  console.log("Updated Voucher Type select dropdown.");
} else {
  console.error("Could not find oldVoucherSelect");
}

// 8. Remove account code from table cell
const oldTableCell = `                        <td className="p-3 text-left">
                          <span className="text-slate-400 font-bold">{e.account_code || "N/A"}</span> <span className="text-slate-500 font-sans">{e.account_name || ""}</span>
                        </td>`;

const newTableCell = `                        <td className="p-3 text-left text-slate-300 font-sans">
                          {e.account_name || "N/A"}
                        </td>`;

if (content.includes(oldTableCell)) {
  content = content.replace(oldTableCell, newTableCell);
  console.log("Removed account code from table cell.");
} else {
  console.error("Could not find oldTableCell");
}

// 9. Conditional Directory Lists for Tenants & Apartments when selectedResidentId is empty
// Let's identify the exact target bounds inside the card
const targetStart = `            {/* ERP Accounting Filters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">`;

const targetEnd = `            {/* Print/PDF exports actions ribbon */}
            <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
              <Button onClick={() => handlePrintLedger("print")} className="bg-slate-800 border border-slate-700 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 cursor-pointer">
                <Printer className="h-4 w-4 text-amber-500" /> Print Statement
              </Button>
              <Button onClick={() => handlePrintLedger("pdf")} className="bg-slate-800 border border-slate-700 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 cursor-pointer">
                <Download className="h-4 w-4 text-blue-500" /> Save PDF Copy
              </Button>
            </div>`;

if (content.indexOf(targetStart) !== -1 && content.indexOf(targetEnd) !== -1) {
  const startIndex = content.indexOf(targetStart);
  const endIndex = content.indexOf(targetEnd) + targetEnd.length;
  
  const originalMiddle = content.substring(startIndex, endIndex);
  
  const replacementMiddle = `            {((ledgerSubTab === "tenant" && selectedResidentId === "") || (ledgerSubTab === "apartment" && selectedResidentId === "")) ? (
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
                              <td className={\`p-3 text-right font-bold \${Number(r.outstanding_balance || 0) > 0 ? "text-red-400" : "text-emerald-400"}\`}>
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
                \${originalMiddle}
              </>
            )}`;
            
  content = content.replace(originalMiddle, replacementMiddle);
  console.log("Wrapped table container with conditional lists successfully.");
} else {
  console.error("Could not find start or end bounds for replacement.");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Done.");
