const fs = require('fs');

const filePath = 'src/routes/admin.financial-ledger.tsx';
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/\r\n/g, '\n');

// 1. Update filteredLedgerEntries filter hook to use e.tenant_id
const oldFilterBlock = `    if (ledgerSubTab === "tenant") {
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
    } else if (ledgerSubTab === "staff") {
      // Filter staff ledger entries
      if (selectedResidentId) {
        // If a specific staff member is selected by ID, match by user_id OR description
        const selectedStaff = (staff || []).find((s: any) => s.id === selectedResidentId);
        list = list.filter(e => {
          if (e.user_id === selectedResidentId) return true;
          if (e.user_id === "system" && selectedStaff) {
            const desc = (e.description || "").toLowerCase();
            return desc.includes(selectedStaff.full_name.toLowerCase()) ||
              desc.includes("salary") || desc.includes("advance") || desc.includes("wages");
          }
          return false;
        });
      }
    } else if (ledgerSubTab === "general" || ledgerSubTab === "rv" || ledgerSubTab === "pv" || ledgerSubTab === "ri" || ledgerSubTab === "rf") {
      if (selectedResidentId) {
        list = list.filter(e => e.user_id === selectedResidentId);
      }
    }`;

const newFilterBlock = `    if (ledgerSubTab === "tenant") {
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
      // Filter staff ledger entries
      if (selectedResidentId) {
        // If a specific staff member is selected by ID, match by tenant_id OR description
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
      }
    } else if (ledgerSubTab === "general" || ledgerSubTab === "rv" || ledgerSubTab === "pv" || ledgerSubTab === "ri" || ledgerSubTab === "rf") {
      if (selectedResidentId) {
        list = list.filter(e => e.tenant_id === selectedResidentId);
      }
    }`;

if (content.includes(oldFilterBlock)) {
  content = content.replace(oldFilterBlock, newFilterBlock);
  console.log("1. Filter logic updated to use tenant_id and Apartment tab restricted to Rent.");
} else {
  console.error("1. Could not find oldFilterBlock in admin.financial-ledger.tsx");
}

// 2. Update the row entityName rendering logic to use tenant_id and extract custom names
const oldEntityNameRender = `                      const res = (residents || []).find(r => r.id === e.user_id);
                      if (res) {
                        entityName = \`\${res.full_name} \${res.apartment_no ? \`(Apt \${res.apartment_no})\` : ""}\`;
                      } else if (e.user_id === "system") {
                        entityName = "System Accounts";
                      }`;

const newEntityNameRender = `                      const res = (residents || []).find(r => r.id === e.tenant_id);
                      if (res) {
                        entityName = \`\${res.full_name} \${res.apartment_no ? \`(Apt \${res.apartment_no})\` : ""}\`;
                      } else if (e.tenant_id === "system") {
                        const desc = e.description || "";
                        const matchRv = desc.match(/Received from\\s+(.*?)(?:\\s+-|\\s+\\.|\\s+Method:|\\s+on account of|$)/i);
                        const matchPv = desc.match(/Paid to\\s+(.*?)(?:\\s+\\.|\\s+Method:|$)/i);
                        if (matchRv) {
                          entityName = matchRv[1].trim();
                        } else if (matchPv) {
                          entityName = matchPv[1].trim();
                        } else {
                          entityName = "System Account";
                        }
                      }`;

if (content.includes(oldEntityNameRender)) {
  content = content.replace(oldEntityNameRender, newEntityNameRender);
  console.log("2. Entity name renderer updated.");
} else {
  console.error("2. Could not find oldEntityNameRender in admin.financial-ledger.tsx");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.financial-ledger.tsx patching done.");
