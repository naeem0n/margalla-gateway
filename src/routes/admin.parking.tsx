import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Car, RefreshCw, Plus, Check, X, ShieldAlert, Wrench, UserCheck, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/admin/parking")({
  component: ParkingPage,
});

type ParkingSlot = {
  id: string;
  slot_number: string;
  status: string; // 'available' | 'occupied' | 'maintenance'
  assigned_tenant_id: string | null;
  vehicle_type: string; // 'car' | 'bike'
  vehicle_model: string | null;
  license_plate: string | null;
  apartment_no: string | null;
  created_at: string;
  updated_at: string;
};

type Resident = {
  id: string;
  full_name: string | null;
  apartment_no: string | null;
  client_id: string | null;
};

function ParkingPage() {
  const { lang, t } = useLanguage();
  const isUrdu = lang === "ur";
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null);
  
  // Form states
  const [formStatus, setFormStatus] = useState("available");
  const [formTenantId, setFormTenantId] = useState("");
  const [formVehicleType, setFormVehicleType] = useState("car");
  const [formVehicleModel, setFormVehicleModel] = useState("");
  const [formLicensePlate, setFormLicensePlate] = useState("");
  const [formApartmentNo, setFormApartmentNo] = useState("");
  const [formParkingFee, setFormParkingFee] = useState(0);
  const [saving, setSaving] = useState(false);
  const [addSlotOpen, setAddSlotOpen] = useState(false);
  const [newSlotName, setNewSlotName] = useState("");

  // Fetch slots and residents
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch slots
      const slotsRes = await apiFetch<{ data: any[] }>("/query-bridge", {
        method: "POST",
        body: JSON.stringify({
          table: "parking",
          action: "select"
        })
      });
      
      let fetchedSlots = slotsRes.data || [];
      
      // 2. If 0 slots found, auto-seed P-1 to P-117 (for 117 apartments)
      if (fetchedSlots.length === 0) {
        toast.info("Initializing parking grid P-1 to P-117...");
        const newSlots: ParkingSlot[] = [];
        for (let i = 1; i <= 117; i++) {
          const slotNum = `P-${i}`;
          const slotData = {
            id: `park-${i}`,
            slot_number: slotNum,
            status: "available",
            assigned_tenant_id: null,
            vehicle_type: "car",
            vehicle_model: "",
            license_plate: "",
            apartment_no: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          await apiFetch("/query-bridge", {
            method: "POST",
            body: JSON.stringify({
              table: "parking",
              action: "insert",
              data: slotData
            })
          });
          newSlots.push(slotData);
        }
        fetchedSlots = newSlots;
      }
      
      // Sort slots numerically by P-XXX index
      fetchedSlots.sort((a, b) => {
        const numA = parseInt(a.slot_number.replace("P-", ""), 10);
        const numB = parseInt(b.slot_number.replace("P-", ""), 10);
        return numA - numB;
      });
      setSlots(fetchedSlots);

      // 3. Fetch residents for allocation dropdown
      const usersRes = await apiFetch<{ users: any[] }>("/users");
      if (usersRes && usersRes.users) {
        setResidents(
          usersRes.users
            .filter((u: any) => u.role === "resident")
            .map((u: any) => ({
              id: u.id,
              full_name: u.full_name,
              apartment_no: u.apartment_no,
              client_id: u.client_id
            }))
        );
      }
    } catch (e: any) {
      console.error("Failed to load parking slots:", e);
      toast.error("Error loading parking database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Open slot details/allocation dialog
  const handleSlotClick = (slot: ParkingSlot) => {
    setSelectedSlot(slot);
    setFormStatus(slot.status);
    setFormTenantId(slot.assigned_tenant_id || "");
    setFormVehicleType(slot.vehicle_type || "car");
    setFormVehicleModel(slot.vehicle_model || "");
    setFormLicensePlate(slot.license_plate || "");
    setFormApartmentNo(slot.apartment_no || "");
    setFormParkingFee(0);
    setDialogOpen(true);
  };

  // Pre-fill apartment number when resident is chosen
  const handleResidentChange = (tenantId: string) => {
    setFormTenantId(tenantId);
    if (tenantId) {
      const res = residents.find(r => r.id === tenantId);
      if (res && res.apartment_no) {
        setFormApartmentNo(res.apartment_no);
      }
    } else {
      setFormApartmentNo("");
    }
  };

  // Pre-fill resident details if apartment number is manually entered/changed
  const handleApartmentChange = (aptNo: string) => {
    setFormApartmentNo(aptNo);
    const res = residents.find(r => r.apartment_no?.toLowerCase() === aptNo.trim().toLowerCase());
    if (res) {
      setFormTenantId(res.id);
    }
  };

  // Save allocation form
  const handleSaveAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    setSaving(true);
    try {
      const isOccupied = formStatus === "occupied";
      const updatedData = {
        status: formStatus,
        assigned_tenant_id: isOccupied ? (formTenantId || null) : null,
        vehicle_type: isOccupied ? formVehicleType : "car",
        vehicle_model: isOccupied ? formVehicleModel : "",
        license_plate: isOccupied ? formLicensePlate : "",
        apartment_no: isOccupied ? formApartmentNo : "",
        updated_at: new Date().toISOString()
      };

      await apiFetch("/query-bridge", {
        method: "POST",
        body: JSON.stringify({
          table: "parking",
          action: "update",
          filters: [{ column: "id", value: selectedSlot.id }],
          data: updatedData
        })
      });

      if (isOccupied && formParkingFee > 0 && formTenantId) {
        try {
          await apiFetch('/ledger', {
            method: 'POST',
            body: JSON.stringify({
              user_id: formTenantId,
              entry_date: new Date().toISOString().split('T')[0],
              entry_type: 'other',
              description: `Parking Allocation Fee - Slot ${selectedSlot.slot_number} (${formVehicleType} / ${formLicensePlate})`,
              debit: Number(formParkingFee),
              credit: 0
            })
          });
        } catch (e) { console.error("Parking ledger error", e); }
      }

      toast.success(`Slot ${selectedSlot.slot_number} updated successfully!`);
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to update parking slot.");
    } finally {
      setSaving(false);
    }
  };

  // Quick release slot back to available
  const handleReleaseSlot = async () => {
    if (!selectedSlot) return;

    setSaving(true);
    try {
      const updatedData = {
        status: "available",
        assigned_tenant_id: null,
        vehicle_type: "car",
        vehicle_model: "",
        license_plate: "",
        apartment_no: "",
        updated_at: new Date().toISOString()
      };

      await apiFetch("/query-bridge", {
        method: "POST",
        body: JSON.stringify({
          table: "parking",
          action: "update",
          filters: [{ column: "id", value: selectedSlot.id }],
          data: updatedData
        })
      });

      toast.success(`Slot ${selectedSlot.slot_number} has been released!`);
      setDialogOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to release slot.");
    } finally {
      setSaving(false);
    }
  };

  // Quick toggle status button
  const handleToggleStatus = async (slot: ParkingSlot, newStatus: string) => {
    try {
      const updatedData = {
        status: newStatus,
        assigned_tenant_id: newStatus === "occupied" ? slot.assigned_tenant_id : null,
        vehicle_type: newStatus === "occupied" ? slot.vehicle_type : "car",
        vehicle_model: newStatus === "occupied" ? slot.vehicle_model : "",
        license_plate: newStatus === "occupied" ? slot.license_plate : "",
        apartment_no: newStatus === "occupied" ? slot.apartment_no : "",
        updated_at: new Date().toISOString()
      };

      await apiFetch("/query-bridge", {
        method: "POST",
        body: JSON.stringify({
          table: "parking",
          action: "update",
          filters: [{ column: "id", value: slot.id }],
          data: updatedData
        })
      });

      toast.success(`Slot ${slot.slot_number} set to ${newStatus}`);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to toggle slot status.");
    }
  };

  const handlePrintParkingReport = () => {
    const rowsHtml = slots.map((s, idx) => {
      const tenant = residents.find(r => r.id === s.assigned_tenant_id);
      const tenantName = tenant ? tenant.full_name : (s.assigned_tenant_id ? "Resident" : "—");
      
      let statusLabel = s.status.toUpperCase();
      if (s.status === "available") statusLabel = isUrdu ? "دستیاب" : "Available";
      else if (s.status === "occupied") statusLabel = isUrdu ? "مختص شدہ" : "Occupied";
      else if (s.status === "maintenance") statusLabel = isUrdu ? "مرمت" : "Maintenance";

      return `
        <tr>
          <td>${idx + 1}</td>
          <td style="font-weight: bold; color: #b8962e;">${s.slot_number}</td>
          <td><span class="status-badge status-${s.status}">${statusLabel}</span></td>
          <td>${s.apartment_no || "—"}</td>
          <td>${tenantName}</td>
          <td>${s.vehicle_type ? s.vehicle_type.toUpperCase() : "—"}${s.vehicle_model ? ` (${s.vehicle_model})` : ""}</td>
          <td>${s.license_plate || "—"}</td>
        </tr>
      `;
    }).join("");

    const totalSlots = slots.length;
    const occupiedSlots = slots.filter(s => s.status === "occupied").length;
    const maintenanceSlots = slots.filter(s => s.status === "maintenance").length;
    const availableSlots = totalSlots - occupiedSlots - maintenanceSlots;

    const htmlDoc = `<!DOCTYPE html>
      <html>
        <head>
          <title>Margalla Gateway - Parking Registry Report</title>
          <style>
            body { font-family: monospace; padding: 25px; color: #000; background: #fff; font-size: 11px; }
            .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #000; padding-bottom: 15px; }
            .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1.5px; }
            .summary-strip { display: flex; justify-content: space-around; margin: 15px 0; padding: 10px; background: #f8f9fa; border: 1px solid #ddd; font-weight: bold; }
            table { border-collapse: collapse; margin-top: 15px; width: 100%; }
            th, td { border: 1px solid #000; padding: 8px; text-align: center; font-size: 9px; }
            th { background-color: #f2f2f2; font-weight: bold; text-transform: uppercase; }
            .status-badge { font-weight: bold; padding: 2px 6px; border-radius: 3px; font-size: 8px; }
            .status-available { background-color: #e6fffa; color: #0f766e; border: 1px solid #b2f5ea; }
            .status-occupied { background-color: #ebf8ff; color: #2b6cb0; border: 1px solid #bee3f8; }
            .status-maintenance { background-color: #fffaf0; color: #dd6b20; border: 1px solid #feebc8; }
            @media print { @page { size: portrait; margin: 1cm; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Margalla Gateway Management System</h1>
            <p><strong>Basement Parking Slots Registry &amp; Ledger Report</strong></p>
            <p>Date Generated: ${new Date().toLocaleDateString('en-PK', { dateStyle: 'full' })}</p>
          </div>
          <div class="summary-strip">
            <span>Total Slots: ${totalSlots}</span>
            <span>Available: ${availableSlots}</span>
            <span>Occupied: ${occupiedSlots}</span>
            <span>Maintenance: ${maintenanceSlots}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Slot Number</th>
                <th>Status</th>
                <th>Apt Number</th>
                <th>Resident Name</th>
                <th>Vehicle Type (Model)</th>
                <th>License Plate</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>`;

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

  // Calculate summary metrics
  const totalSlots = slots.length;
  const occupiedSlots = slots.filter(s => s.status === "occupied").length;
  const maintenanceSlots = slots.filter(s => s.status === "maintenance").length;
  const availableSlots = totalSlots - occupiedSlots - maintenanceSlots;

  return (
    <AdminLayout title="Parking Slot Management">
      <div className="w-full space-y-6 text-white p-2">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-xl p-6 shadow-xl">
          <div>
            <h1 className="text-2xl font-display font-black text-amber-400 tracking-wide uppercase flex items-center gap-2">
              <Car className="h-6 w-6 text-amber-400 animate-pulse" />
              {isUrdu ? "پارکنگ کی جگہ کا انتظام" : "Premium Parking Slot Management"}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {isUrdu ? "فلیٹ پارکنگ کارڈز اور گاڑیوں کی الاٹمنٹ کا انتظام کریں۔" : "Allocate parking slots, register vehicles, and track occupied spaces with real-time grid view."}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handlePrintParkingReport}
              className="bg-amber-500 hover:bg-amber-600 text-black h-9 text-xs font-black uppercase"
            >
              <Printer className="mr-2 h-4 w-4" />
              {isUrdu ? "رپورٹ پرنٹ کریں" : "Print PDF Report"}
            </Button>
            <Button
              onClick={loadData}
              variant="outline"
              disabled={loading}
              className="border-slate-700 hover:bg-slate-800 hover:text-white text-slate-300 h-9 text-xs"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              {isUrdu ? "تازہ کریں" : "Refresh Grid"}
            </Button>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl shadow-lg hover:border-amber-500/20 transition-all duration-300">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">{isUrdu ? "کل سلاٹس" : "Total Slots"}</p>
            <p className="text-3xl font-bold font-mono text-white mt-1">{totalSlots}</p>
          </div>
          <div className="bg-slate-900/60 border border-emerald-500/10 p-4 rounded-xl shadow-lg hover:border-emerald-500/30 transition-all duration-300">
            <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-black">{isUrdu ? "دستیاب سلاٹس" : "Available Slots"}</p>
            <p className="text-3xl font-bold font-mono text-emerald-400 mt-1">{availableSlots}</p>
          </div>
          <div className="bg-slate-900/60 border border-blue-500/10 p-4 rounded-xl shadow-lg hover:border-blue-500/30 transition-all duration-300">
            <p className="text-[10px] text-blue-400 uppercase tracking-widest font-black">{isUrdu ? "مختص شدہ سلاٹس" : "Occupied Slots"}</p>
            <p className="text-3xl font-bold font-mono text-blue-400 mt-1">{occupiedSlots}</p>
          </div>
          <div className="bg-slate-900/60 border border-orange-500/10 p-4 rounded-xl shadow-lg hover:border-orange-500/30 transition-all duration-300">
            <p className="text-[10px] text-orange-400 uppercase tracking-widest font-black">{isUrdu ? "مرمت کے تحت" : "Maintenance"}</p>
            <p className="text-3xl font-bold font-mono text-orange-400 mt-1">{maintenanceSlots}</p>
          </div>
        </div>

        {/* Main Content Layout - Grid + Side Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Parking Grid (lg:col-span-8) */}
          <div className="lg:col-span-8 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                🚧 Basement Parking Layout
              </h2>
              <span className="text-[10px] text-slate-500 font-bold">CLICK A SLOT TO EDIT</span>
            </div>

            {loading ? (
              <div className="flex flex-col justify-center items-center py-24 text-slate-500 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-amber-400" />
                <span className="text-xs uppercase tracking-widest font-black">Loading parking layout...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {slots.map((slot) => {
                  const isOccupied = slot.status === "occupied";
                  const isMaintenance = slot.status === "maintenance";
                  const isSelected = selectedSlot?.id === slot.id;
                  
                  let cardStyle = "border-slate-800 bg-slate-950/60 hover:border-slate-600 hover:bg-slate-900/80 hover:shadow-2xl hover:-translate-y-1";
                  let statusColor = "text-emerald-400 bg-emerald-500/15";
                  
                  if (isSelected) {
                    cardStyle = "border-amber-400 bg-slate-900/90 shadow-[0_10px_35px_-5px_rgba(212,175,55,0.25)] scale-[1.03] ring-2 ring-amber-400/40 z-10";
                  } else if (isOccupied) {
                    cardStyle = "border-blue-900/60 bg-blue-950/20 hover:border-blue-500/60 hover:bg-blue-950/30";
                    statusColor = "text-blue-400 bg-blue-500/15";
                  } else if (isMaintenance) {
                    cardStyle = "border-orange-900/60 bg-orange-950/20 hover:border-orange-500/60 hover:bg-orange-950/30";
                    statusColor = "text-orange-400 bg-orange-500/15";
                  }

                  const res = residents.find(r => r.id === slot.assigned_tenant_id);

                  return (
                    <div
                      key={slot.id}
                      onClick={() => handleSlotClick(slot)}
                      className={`relative overflow-hidden p-5 rounded-2xl flex flex-col justify-between min-h-[160px] cursor-pointer transition-all duration-300 group ${cardStyle}`}
                      style={{
                        transformStyle: "preserve-3d",
                        perspective: "1000px"
                      }}
                    >
                      {/* Top slot header */}
                      <div className="flex justify-between items-start gap-1">
                        <span className="text-xl font-black font-mono tracking-tight whitespace-nowrap text-white group-hover:text-amber-400 transition-colors">
                          {slot.slot_number}
                        </span>
                        <span className={`text-[10px] uppercase px-2.5 py-1 rounded-md font-black tracking-widest shadow-inner ${statusColor}`}>
                          {slot.status}
                        </span>
                      </div>

                      {/* Middle body info */}
                      <div className="my-3 space-y-1.5 text-[11px] text-slate-400">
                        {isOccupied ? (
                          <>
                            <div className="font-black text-white truncate flex items-center gap-1.5 text-xs">
                              🚪 {slot.apartment_no ? `Apt ${slot.apartment_no}` : "Apt N/A"}
                            </div>
                            {res && (
                              <div className="text-[11px] text-amber-400 font-bold truncate uppercase">
                                👤 {res.full_name}
                              </div>
                            )}
                            <div className="truncate text-slate-300 flex items-center gap-1.5">
                              {slot.vehicle_type === "bike" ? "🏍️" : "🚗"} <span className="font-medium">{slot.vehicle_model || "Vehicle N/A"}</span>
                            </div>
                            <div className="font-mono text-emerald-400 text-xs font-bold tracking-widest bg-emerald-500/10 inline-block px-1.5 py-0.5 rounded border border-emerald-500/20 mt-1">
                              🎫 {slot.license_plate || "No Plate"}
                            </div>
                          </>
                        ) : isMaintenance ? (
                          <div className="text-orange-400 flex items-center gap-1.5 font-black text-[10px] uppercase tracking-wider mt-5">
                            <Wrench className="h-4 w-4 animate-bounce" /> Under Maintenance
                          </div>
                        ) : (
                          <div className="text-emerald-400 flex items-center gap-1.5 font-black text-[10px] uppercase tracking-wider mt-5">
                            <Check className="h-4 w-4" /> Vacant Slot
                          </div>
                        )}
                      </div>

                      {/* Hover action bar */}
                      <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5 mt-2" onClick={e => e.stopPropagation()}>
                        <span className="text-[10px] uppercase font-bold text-slate-500">
                          {slot.vehicle_type === "bike" ? "🏍️ BIKE" : "🚗 CAR"}
                        </span>
                        <div className="flex gap-2">
                          {slot.status !== "available" && (
                            <button
                              onClick={() => handleToggleStatus(slot, "available")}
                              className="text-[10px] font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-widest bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded transition-colors"
                            >
                              Free
                            </button>
                          )}
                          {slot.status !== "maintenance" && (
                            <button
                              onClick={() => handleToggleStatus(slot, "maintenance")}
                              className="text-[10px] font-black text-orange-400 hover:text-orange-300 uppercase tracking-widest bg-orange-500/10 hover:bg-orange-500/20 px-2 py-0.5 rounded transition-colors"
                            >
                              Maint
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Premium Edit & Info Side Panel (lg:col-span-4) */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl sticky top-6 space-y-5">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                ⚙️ Slot Details & Allocation
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {selectedSlot ? `Configure details for parking slot ${selectedSlot.slot_number}` : "Select any slot in the grid to configure"}
              </p>
            </div>

            {!selectedSlot ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-center space-y-3">
                <Car className="h-10 w-10 text-slate-600 stroke-[1.5]" />
                <div className="text-xs uppercase font-bold tracking-widest text-slate-500">No Slot Selected</div>
                <p className="text-[10px] text-slate-400 max-w-[200px]">
                  Click on any card in the parking grid to view resident details or assign vehicles.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSaveAllocation} className="space-y-4 text-xs">
                {/* Slot info badge */}
                <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Current Slot</span>
                    <span className="text-lg font-black font-mono text-white">{selectedSlot.slot_number}</span>
                  </div>
                  <span className={`text-[9px] uppercase tracking-wider px-2 py-1 rounded-md font-black ${
                    formStatus === "occupied" ? "text-blue-400 bg-blue-500/10" :
                    formStatus === "maintenance" ? "text-orange-400 bg-orange-500/10" :
                    "text-emerald-400 bg-emerald-500/10"
                  }`}>
                    {formStatus}
                  </span>
                </div>

                {/* Status Selection */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Slot Status</Label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2.5 rounded-lg text-xs outline-none focus:border-amber-500 transition-colors"
                  >
                    <option value="available">🟢 Available (Vacant)</option>
                    <option value="occupied">🔵 Occupied (Allocated)</option>
                    <option value="maintenance">🟠 Under Maintenance</option>
                  </select>
                </div>

                {formStatus === "occupied" ? (
                  <div className="space-y-4 border border-slate-800 p-4 rounded-xl bg-slate-950/40">
                    <p className="text-[9px] text-amber-400 font-black tracking-widest uppercase border-b border-slate-800 pb-1.5 mb-2">
                      👥 Resident & Vehicle Info
                    </p>

                    {/* Resident Select */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Assigned Resident</Label>
                      <select
                        value={formTenantId}
                        onChange={(e) => handleResidentChange(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2.5 rounded-lg text-xs outline-none focus:border-amber-500 transition-colors"
                      >
                        <option value="">-- Choose Resident --</option>
                        {residents.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.full_name} ({r.apartment_no ? `Apt ${r.apartment_no}` : "No Apt"})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Apartment No */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Apartment Unit</Label>
                      <Input
                        type="text"
                        value={formApartmentNo}
                        onChange={(e) => handleApartmentChange(e.target.value)}
                        placeholder="e.g. M-102"
                        className="bg-slate-950 border-slate-800 text-white h-10 text-xs focus-visible:ring-amber-500/30"
                      />
                    </div>

                    {/* Vehicle Type */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Vehicle Type</Label>
                      <select
                        value={formVehicleType}
                        onChange={(e) => setFormVehicleType(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2.5 rounded-lg text-xs outline-none focus:border-amber-500 transition-colors"
                      >
                        <option value="car">🚗 Car</option>
                        <option value="bike">🏍️ Motorbike</option>
                      </select>
                    </div>

                    {/* Vehicle Model */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Vehicle Model / Description</Label>
                      <Input
                        type="text"
                        value={formVehicleModel}
                        onChange={(e) => setFormVehicleModel(e.target.value)}
                        placeholder="e.g. Honda Civic (Black)"
                        className="bg-slate-950 border-slate-800 text-white h-10 text-xs focus-visible:ring-amber-500/30"
                      />
                    </div>

                    {/* License Plate */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">License Plate Number</Label>
                      <Input
                        type="text"
                        value={formLicensePlate}
                        onChange={(e) => setFormLicensePlate(e.target.value)}
                        placeholder="e.g. ICT-123-GP"
                        className="bg-slate-950 border-slate-800 text-emerald-400 font-mono h-10 text-xs font-black tracking-widest focus-visible:ring-amber-500/30"
                      />
                    </div>

                    {/* Parking Allocation Fee */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Parking Allocation Fee (PKR)</Label>
                      <Input
                        type="number"
                        value={formParkingFee}
                        onChange={(e) => setFormParkingFee(Number(e.target.value))}
                        placeholder="e.g. 500"
                        className="bg-slate-950 border-slate-800 text-white h-10 text-xs focus-visible:ring-amber-500/30"
                      />
                    </div>
                  </div>
                ) : formStatus === "maintenance" ? (
                  <div className="p-4 border border-orange-500/20 bg-orange-500/5 text-orange-400 rounded-xl text-[11px] leading-relaxed flex gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-orange-500" />
                    <span>
                      <strong>Notice:</strong> Marking this slot under maintenance will release the current allocation parameters and block it from general resident assignment.
                    </span>
                  </div>
                ) : (
                  <div className="p-4 border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 rounded-xl text-[11px] leading-relaxed flex gap-2">
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                    <span>
                      <strong>Vacant Status:</strong> Setting to available will clear resident records, returning the space to the general pool.
                    </span>
                  </div>
                )}

                {/* Side Panel Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-2">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-amber-400 text-black hover:bg-amber-500 font-bold text-xs h-10 rounded-lg shadow-lg flex items-center justify-center gap-1"
                  >
                    {saving ? "Saving Changes..." : "Save Allocation"}
                  </Button>
                  
                  {selectedSlot.status !== "available" && (
                    <Button
                      type="button"
                      onClick={handleReleaseSlot}
                      variant="destructive"
                      disabled={saving}
                      className="w-full text-xs h-10 rounded-lg flex items-center justify-center gap-1"
                    >
                      Release & Vacate Slot
                    </Button>
                  )}

                  <Button
                    type="button"
                    onClick={() => setSelectedSlot(null)}
                    variant="outline"
                    disabled={saving}
                    className="w-full border-slate-800 hover:bg-slate-800 text-xs h-10 rounded-lg text-slate-400 hover:text-white"
                  >
                    Close Panel
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
