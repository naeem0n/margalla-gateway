const fs = require('fs');

const filePath = 'src/routes/admin.financial-ledger.tsx';
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/\r\n/g, '\n');

// 1. Remove Parking Ledgers tab button
const oldTabButtonsBlock = `                <button
                  onClick={() => setLedgerSubTab("apartment")}
                  className={\`text-[10px] font-bold px-3 py-1.5 rounded-md transition \${
                    ledgerSubTab === "apartment" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }\`}
                >
                  Apartment Ledgers
                </button>
                <button
                  onClick={() => setLedgerSubTab("parking")}
                  className={\`text-[10px] font-bold px-3 py-1.5 rounded-md transition \${
                    ledgerSubTab === "parking" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }\`}
                >
                  Parking Ledgers
                </button>`;

const newTabButtonsBlock = `                <button
                  onClick={() => setLedgerSubTab("apartment")}
                  className={\`text-[10px] font-bold px-3 py-1.5 rounded-md transition \${
                    ledgerSubTab === "apartment" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }\`}
                >
                  Apartment Ledgers
                </button>`;

if (content.includes(oldTabButtonsBlock)) {
  content = content.replace(oldTabButtonsBlock, newTabButtonsBlock);
  console.log("Removed Parking Ledgers button.");
} else {
  console.error("Could not find oldTabButtonsBlock");
}

// 2. Remove account code from table cell
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

// 3. Conditional Directory Lists for Tenants & Apartments when selectedResidentId is empty
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
