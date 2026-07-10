import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { AdminLayout } from "@/components/admin/AdminLayout";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardList, Printer, Search, RefreshCw, FileText, TrendingDown, Clock, Home } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute('/admin/vacant-list')({
  component: DailyVacantList,
});

interface AptItem {
  apartment_no: string;
  floor: string | number;
  type: string;
  size: number;
  rent: number;
  status: 'available' | 'occupied';
  vacant_since: string | null;
  remarks: string;
}

function DailyVacantList() {
  const [apartments, setApartments] = useState<AptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'available' | 'occupied' | 'all'>('available');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // --- Step 1: Get registered apartments from apartments table ---
      let aptMap: Record<string, { 
        type: string; 
        furnishing: string; 
        notes: string; 
        status: string;
        floor: string | number;
        area_sqft: number;
        rent: number;
        updated_at: string;
      }> = {};
      
      try {
        const aptRes = await apiFetch<{ apartments?: any[] }>('/apartments');
        if (aptRes?.apartments) {
          aptRes.apartments.forEach((a: any) => {
            aptMap[String(a.number || '').trim()] = {
              type: a.type || 'Standard',
              furnishing: a.furnishing_status || 'Unfurnished',
              notes: a.notes || '',
              status: a.status || 'available',
              floor: a.floor ? String(a.floor) : 'Ground',
              area_sqft: Number(a.area_sqft || 0),
              rent: Number(a.rent || 0),
              updated_at: a.updated_at || new Date().toISOString()
            };
          });
        }
      } catch (_) {}

      // --- Step 2: Get ALL tenants (occupied apartments) ---
      const usersRes = await apiFetch<{ users?: any[] }>('/users');
      const tenants = (usersRes?.users || []).filter(
        (u: any) => u.role === 'resident' && u.apartment_no
      );

      // Build a set of occupied apartment numbers
      const occupiedSet = new Set(tenants.map((t: any) => String(t.apartment_no || '').trim()));

      const result: AptItem[] = [];

      // --- Add occupied apartments (from tenants) ---
      tenants.forEach((t: any) => {
        const aptNo = String(t.apartment_no || '').trim();
        const aptInfo = aptMap[aptNo];
        
        result.push({
          apartment_no: aptNo,
          floor: aptInfo?.floor || 0,
          type: aptInfo?.type || t.apartment_type || 'Standard',
          size: aptInfo?.area_sqft || 0,
          rent: Number(t.rent_amount || aptInfo?.rent || 0),
          status: 'occupied',
          vacant_since: null,
          remarks: `Tenant: ${t.full_name || 'Resident'}`,
        });
      });

      // --- Add available apartments (registered but NOT occupied) ---
      Object.entries(aptMap).forEach(([aptNo, info]) => {
        if (!occupiedSet.has(aptNo)) {
          result.push({
            apartment_no: aptNo,
            floor: info.floor,
            type: info.type,
            size: info.area_sqft,
            rent: info.rent,
            status: 'available',
            vacant_since: info.updated_at,
            remarks: info.notes || 'Available immediately',
          });
        }
      });

      // Sort by apartment number
      result.sort((a, b) => (a.apartment_no || "").localeCompare(b.apartment_no || "", undefined, { numeric: true }));
      setApartments(result);
    } catch (err: any) {
      console.error('Vacant list fetch error:', err);
      setError('Could not load apartment registry. Check server connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = (apartments || []).filter(item => {
    const matchStatus = statusFilter === 'all' || item.status === statusFilter;
    const q = (searchQuery || "").toLowerCase();
    const matchSearch =
      (item.apartment_no || "").toLowerCase().includes(q) ||
      (item.type || "").toLowerCase().includes(q) ||
      (item.remarks || "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // Calculate summary stats
  const vacantCount = apartments.filter(a => a.status === 'available').length;
  const occupiedCount = apartments.filter(a => a.status === 'occupied').length;

  const potentialRentLoss = apartments
    .filter(a => a.status === 'available')
    .reduce((acc, a) => acc + (a.rent || 0), 0);

  const vacantUnits = apartments.filter(a => a.status === 'available');
  let avgVacancyDays = 0;
  if (vacantUnits.length > 0) {
    const totalDays = vacantUnits.reduce((acc, a) => {
      if (!a.vacant_since) return acc + 15;
      const cleanStr = String(a.vacant_since).includes(' ') && !String(a.vacant_since).includes('T')
        ? String(a.vacant_since).replace(' ', 'T')
        : String(a.vacant_since);
      const parsed = new Date(cleanStr).getTime();
      const diffDays = isNaN(parsed) ? 15 : Math.ceil(Math.abs(Date.now() - parsed) / (1000 * 60 * 60 * 24));
      return acc + Math.max(1, diffDays);
    }, 0);
    avgVacancyDays = Math.round(totalDays / vacantUnits.length);
  }

  // Premium PDF print report
  const generatePDFReport = () => {
    try {
      const doc = new jsPDF();
      
      // Document header with gold and navy themes
      doc.setFillColor(15, 23, 42); // slate-900 / navy
      doc.rect(0, 0, 210, 35, "F");
      
      doc.setTextColor(212, 175, 55); // gold #d4af37
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("MARGALLA GATEWAY TOWER ISLAMABAD", 15, 15);
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("DAILY VACANT APARTMENTS STATUS REPORT", 15, 22);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-PK')} | Mode: ${statusFilter.toUpperCase()}`, 15, 28);
      
      // Summary cards details in PDF
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`Total Vacant Units: ${vacantCount}`, 15, 45);
      doc.text(`Potential Monthly Rent Loss: PKR ${potentialRentLoss.toLocaleString()}`, 75, 45);
      doc.text(`Average Vacancy Days: ${avgVacancyDays} Days`, 155, 45);
      
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.5);
      doc.line(15, 48, 195, 48);

      // Create Table Columns
      const headers = [["SR #", "APT #", "FLOOR", "TYPE", "SIZE (SQFT)", "EXPECTED RENT", "VACANT SINCE", "REMARKS / STATUS"]];
      const body = filtered.map((item, idx) => {
        let vacancyText = "—";
        if (item.status === 'available' && item.vacant_since) {
          const cleanStr = String(item.vacant_since).includes(' ') && !String(item.vacant_since).includes('T')
            ? String(item.vacant_since).replace(' ', 'T')
            : String(item.vacant_since);
          const parsed = new Date(cleanStr).getTime();
          if (!isNaN(parsed)) {
            const diffDays = Math.ceil(Math.abs(Date.now() - parsed) / (1000 * 60 * 60 * 24));
            vacancyText = `${diffDays} days ago`;
          }
        }
        return [
          idx + 1,
          item.apartment_no,
          item.floor || "Ground",
          item.type,
          item.size > 0 ? `${item.size} sqft` : "—",
          item.rent > 0 ? `PKR ${item.rent.toLocaleString()}` : "—",
          vacancyText,
          item.status === 'available' ? `🟢 VACANT (${item.remarks})` : `🔴 OCCUPIED (${item.remarks})`
        ];
      });

      // Call autoTable
      autoTable(doc, {
        head: headers,
        body: body,
        startY: 52,
        theme: "striped",
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [212, 175, 55],
          fontSize: 8,
          fontStyle: "bold"
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [50, 50, 50]
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        margin: { top: 50, left: 15, right: 15 }
      });

      // Save PDF
      doc.save(`MG_Vacant_Registry_${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success("Premium Vacancy Report PDF downloaded!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF Report");
    }
  };

  return (
    <AdminLayout title="Vacant Apartments Registry">
      <div className="space-y-6 text-white p-6 max-w-6xl mx-auto font-sans">
        
        {/* HEADER */}
        <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-display font-black text-[#d4af37] tracking-wide uppercase flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-[#d4af37]" />
              Daily Vacant Apartments Registry
            </h1>
            <p className="text-xs text-gray-400 mt-1">Live tracker of un-rented, available and leased spaces across Margalla Gateway.</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={fetchData}
              variant="outline"
              disabled={loading}
              className="border-white/10 hover:bg-white/5 text-gray-300 h-9"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={generatePDFReport}
              className="bg-[#d4af37] text-black hover:bg-[#b8962e] font-bold h-9 text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(212,175,55,0.15)]"
            >
              <Printer className="h-4 w-4" />
              Download Report (PDF)
            </Button>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-black border border-[#10b981]/20 p-4 rounded-xl hover:border-[#10b981]/40 transition-colors">
            <div className="flex justify-between items-start">
              <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-bold">Total Vacant</p>
              <Home className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold font-mono text-[#10b981] mt-1">{vacantCount}</p>
            <p className="text-[9px] text-gray-500 mt-1">Units available for allocation</p>
          </div>

          <div className="bg-black border border-rose-500/20 p-4 rounded-xl hover:border-rose-500/40 transition-colors">
            <div className="flex justify-between items-start">
              <p className="text-[10px] text-rose-500 uppercase tracking-widest font-bold">Potential Rent Loss</p>
              <TrendingDown className="h-4 w-4 text-rose-500" />
            </div>
            <p className="text-3xl font-bold font-mono text-rose-500 mt-1">
              PKR {potentialRentLoss.toLocaleString()}
            </p>
            <p className="text-[9px] text-gray-500 mt-1">Monthly expected rent from vacant units</p>
          </div>

          <div className="bg-black border border-[#f59e0b]/20 p-4 rounded-xl hover:border-[#f59e0b]/40 transition-colors">
            <div className="flex justify-between items-start">
              <p className="text-[10px] text-amber-500 uppercase tracking-widest font-bold">Avg Vacancy Days</p>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-3xl font-bold font-mono text-[#f59e0b] mt-1">
              {avgVacancyDays} <span className="text-xs font-normal">Days</span>
            </p>
            <p className="text-[9px] text-gray-500 mt-1">Average days vacant per unleased unit</p>
          </div>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="flex flex-col sm:flex-row gap-3 bg-black/40 border border-white/5 p-3 rounded-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="text"
              placeholder="Search by Apartment #, Floor, Type, or Tenant remarks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-black/50 border-white/10 text-white h-9 text-xs"
            />
          </div>

          <div className="flex gap-2.5 items-center">
            <Label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Status Filter:</Label>
            <div className="flex bg-black/80 border border-white/10 p-0.5 rounded-lg">
              <button
                onClick={() => setStatusFilter('available')}
                className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-md transition ${statusFilter === 'available' ? 'bg-[#d4af37] text-black' : 'text-gray-400 hover:text-white'}`}
              >
                Vacant
              </button>
              <button
                onClick={() => setStatusFilter('occupied')}
                className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-md transition ${statusFilter === 'occupied' ? 'bg-[#d4af37] text-black' : 'text-gray-400 hover:text-white'}`}
              >
                Occupied
              </button>
              <button
                onClick={() => setStatusFilter('all')}
                className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-md transition ${statusFilter === 'all' ? 'bg-[#d4af37] text-black' : 'text-gray-400 hover:text-white'}`}
              >
                All
              </button>
            </div>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="bg-black/50 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left border-collapse">
              <thead className="bg-black border-b border-white/10 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="p-3 w-12 text-center">SR #</th>
                  <th className="p-3">Apt #</th>
                  <th className="p-3">Floor</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Size</th>
                  <th className="p-3 text-right">Expected Rent</th>
                  <th className="p-3">Vacant Since</th>
                  <th className="p-3">Remarks / Tenant</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-500">
                        <RefreshCw className="h-6 w-6 animate-spin text-[#d4af37]" />
                        <span>Loading apartment registry...</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={9} className="p-16 text-center text-rose-400 font-bold">
                      ⚠️ {error}
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-16 text-center text-gray-500">
                      {apartments.length === 0
                        ? '📭 No data available. Please add apartments or tenants first.'
                        : 'No records found matching the active search criteria.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, idx) => {
                    let vacancyText = "—";
                    if (item.status === 'available' && item.vacant_since) {
                      const cleanStr = String(item.vacant_since).includes(' ') && !String(item.vacant_since).includes('T')
                        ? String(item.vacant_since).replace(' ', 'T')
                        : String(item.vacant_since);
                      const parsed = new Date(cleanStr).getTime();
                      if (!isNaN(parsed)) {
                        const diffDays = Math.ceil(Math.abs(Date.now() - parsed) / (1000 * 60 * 60 * 24));
                        vacancyText = `${diffDays} days ago`;
                      }
                    }

                    return (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 text-gray-500 font-mono text-center font-bold">{idx + 1}</td>
                        <td className="p-3 font-extrabold text-[#d4af37] tracking-wider text-sm">
                          {item.apartment_no}
                        </td>
                        <td className="p-3 font-medium">
                          {item.floor}
                        </td>
                        <td className="p-3 text-gray-300">{item.type}</td>
                        <td className="p-3 text-right font-mono text-gray-300">
                          {item.size > 0 ? `${item.size} sqft` : "—"}
                        </td>
                        <td className="p-3 text-right font-mono font-bold">
                          {item.rent > 0 ? (
                            <span className="text-emerald-400">PKR {item.rent.toLocaleString()}</span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-gray-400">{vacancyText}</td>
                        <td className="p-3 text-gray-400">
                          <span className={item.status === 'occupied' ? 'text-amber-400 font-semibold' : ''}>
                            {item.remarks}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                            item.status === 'available'
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-950/30 text-rose-400 border-rose-500/20'
                          }`}>
                            {item.status === 'available' ? 'VACANT' : 'OCCUPIED'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* TABLE FOOTER */}
          <div className="p-4 bg-black border-t border-white/10 flex justify-between items-center text-[10px] text-gray-500">
            <span>
              Showing <strong className="text-white">{filtered.length}</strong> of {apartments.length} registered units
            </span>
            <span className="font-mono uppercase tracking-widest text-emerald-500">
              ● Live Sync Active
            </span>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
