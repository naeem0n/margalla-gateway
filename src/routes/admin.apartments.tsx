import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, Printer, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { downloadApartmentsPDF } from "@/lib/pdf";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/apartments")({
  component: ApartmentsPage,
});

type Apt = {
  id: string;
  number: string;
  floor: string | number | null;
  type: string | null;
  bedrooms: string | null;
  area_sqft: number | null;
  rent: number;
  status: string;
  description: string | null;
  notes: string | null;
  media_urls: string[];
  owner_name?: string;
  ownership_type?: string;
  dealer_company?: string | null;
  furnishing_status?: string;
};

const EMPTY_FORM = {
  number: "",
  floor: "",
  type: "2bed",
  bedrooms: "2",
  area_sqft: "",
  rent: "",
  status: "available",
  description: "",
  notes: "",
  owner_name: "",
  ownership_type: "Company",
  dealer_company: "",
  furnishing_status: "unfurnished",
  count: "1",
  parking_slot: "",
};

function ApartmentsPage() {
  const [rows, setRows] = useState<Apt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ apartments: Apt[] }>("/apartments");
      const mapped = res.apartments ?? [];
      setRows(mapped);
      localStorage.setItem("margalla_offline_apartments", JSON.stringify(mapped));
    } catch (e: any) {
      console.error("Load apartments failed:", e);
      toast.error("Could not load apartments — check server connection");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.number.trim()) return toast.error("Unit number is required");
    if (!form.rent || Number(form.rent) <= 0) return toast.error("Valid rent amount is required");
    const count = Math.min(Math.max(Number(form.count) || 1, 1), 20);
    setSaving(true);
    try {
      for (let i = 0; i < count; i++) {
        const unitNum = count === 1 ? form.number.trim() : `${form.number.trim()}-${i + 1}`;
        await apiFetch("/apartments", {
          method: "POST",
          body: JSON.stringify({
            number: unitNum,
            floor: form.floor || null,
            type: form.type || null,
            bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
            area_sqft: form.area_sqft ? Number(form.area_sqft) : null,
            rent: Number(form.rent),
            status: form.status,
            description: form.description || null,
            notes: form.notes || null,
            owner_name: form.owner_name || null,
            ownership_type: form.ownership_type || "Company",
            dealer_company: form.dealer_company || null,
            furnishing_status: form.furnishing_status || "unfurnished",
            stall_rent: 0,  // Parking FREE
            parking_slot: count === 1 ? (form.parking_slot || null) : `P-${i+1}`,
          }),
        });
      }
      toast.success(`${count} apartment(s) added successfully!`);
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to add apartment");
    } finally {
      setSaving(false);
    }
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value;
    setForm(f => {
      const updated: any = { ...f, [k]: val };
      // Auto-generate parking slot from unit number
      if (k === "number") {
        updated.parking_slot = val.trim() ? `P-${val.trim().replace(/^[A-Za-z]+-?/i, '')}` : "";
      }
      return updated;
    });
  };

  return (
    <AdminLayout title="Apartments">
      <div className="flex justify-between items-center mb-4">
        <p className="text-muted-foreground text-sm">
          {rows.length} total &middot; {rows.filter(r => r.status === "occupied").length} occupied &middot; {rows.filter(r => r.status === "available").length} vacant
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => downloadApartmentsPDF(rows)} className="flex items-center gap-1">
            <Printer className="h-4 w-4" /> Print PDF
          </Button>
          <Button onClick={() => setShowForm(true)} className="flex items-center gap-1 bg-primary text-primary-foreground">
            <Plus className="h-4 w-4" /> Add Apartment
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border/60 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Unit</th>
              <th className="px-4 py-3 text-left">Floor</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Area</th>
              <th className="px-4 py-3 text-left">Rent (PKR)</th>
              <th className="px-4 py-3 text-left">Owner / Malkiyat</th>
              <th className="px-4 py-3 text-left">Media</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <div className="text-muted-foreground mb-3">No apartments added yet.</div>
                  <Button onClick={() => setShowForm(true)} size="sm" className="bg-primary text-primary-foreground">
                    <Plus className="h-4 w-4 mr-1" /> Add First Apartment
                  </Button>
                </td>
              </tr>
            ) : rows.map(a => (
              <tr key={a.id} className="border-t border-border/40 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-semibold">{a.number}</td>
                <td className="px-4 py-3">{a.floor ?? "—"}</td>
                <td className="px-4 py-3">
                  <div>{a.type ?? "—"}</div>
                  {a.furnishing_status && (
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{a.furnishing_status}</div>
                  )}
                </td>
                <td className="px-4 py-3">{a.area_sqft ? `${a.area_sqft} sqft` : "—"}</td>
                <td className="px-4 py-3 font-semibold text-emerald-500">PKR {Number(a.rent).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-xs">{a.owner_name || "Margalla Gateway"}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {a.ownership_type || "Company"}
                    {a.ownership_type === "Third-Party" && a.dealer_company && ` (${a.dealer_company})`}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <ImageIcon className="h-3 w-3" />{a.media_urls?.length ?? 0}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded font-medium ${
                    a.status === "occupied" ? "bg-success/20 text-success" :
                    a.status === "available" ? "bg-primary/20 text-primary" :
                    "bg-muted text-muted-foreground"
                  }`}>{a.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Apartment Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Add New Apartment</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <Label>Unit Number *</Label>
              <Input placeholder="e.g. A-101" value={form.number} onChange={set("number")} />
            </div>
            <div className="space-y-1">
              <Label>Parking Slot (Auto) 🅿️ <span className="text-green-500 text-[10px]">FREE</span></Label>
              <Input
                value={form.parking_slot}
                onChange={set("parking_slot")}
                placeholder="Auto from unit no."
                className="bg-muted/40 text-muted-foreground"
              />
            </div>
            <div className="space-y-1">
              <Label>Floor</Label>
              <select className="w-full border border-border rounded-md px-3 py-2 bg-background text-sm" value={form.floor} onChange={set("floor")}>
                <option value="">-- Select Floor --</option>
                <option value="Basement">Basement (Parking)</option>
                <option value="Ground Floor">Ground Floor</option>
                <option value="1st Floor">1st Floor</option>
                <option value="2nd Floor">2nd Floor</option>
                <option value="3rd Floor">3rd Floor</option>
                <option value="4th Floor">4th Floor</option>
                <option value="5th Floor">5th Floor</option>
                <option value="6th Floor">6th Floor</option>
                <option value="7th Floor">7th Floor</option>
                <option value="8th Floor">8th Floor</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <select className="w-full border border-border rounded-md px-3 py-2 bg-background text-sm" value={form.type} onChange={set("type")}>
                <option value="room">Room</option>
                <option value="room-sharing">Room Sharing</option>
                <option value="studio">Studio</option>
                <option value="1bed">1 Bedroom</option>
                <option value="2bed">2 Bedroom</option>
                <option value="3bed-small">3 Bedroom (Small)</option>
                <option value="3bed-standard">3 Bedroom (Standard)</option>
                <option value="penthouse">Penthouse</option>
                <option value="parking">Parking</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Bedrooms</Label>
              <Input type="number" placeholder="e.g. 2" value={form.bedrooms} onChange={set("bedrooms")} />
            </div>
            <div className="space-y-1">
              <Label>Area (sqft)</Label>
              <Input type="number" placeholder="e.g. 1200" value={form.area_sqft} onChange={set("area_sqft")} />
            </div>
            <div className="space-y-1">
              <Label>Monthly Rent (PKR) *</Label>
              <Input type="number" placeholder="e.g. 50000" value={form.rent} onChange={set("rent")} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <select className="w-full border border-border rounded-md px-3 py-2 bg-background text-sm" value={form.status} onChange={set("status")}>
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="vacate">Vacate</option>
                <option value="maintenance">Under Maintenance</option>
                <option value="others">Others</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Furnishing</Label>
              <select className="w-full border border-border rounded-md px-3 py-2 bg-background text-sm" value={form.furnishing_status} onChange={set("furnishing_status")}>
                <option value="unfurnished">Unfurnished</option>
                <option value="semi-furnished">Semi Furnished</option>
                <option value="fully-furnished">Fully Furnished</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Owner Name</Label>
              <Input placeholder="e.g. Mr. Ahmed" value={form.owner_name} onChange={set("owner_name")} />
            </div>
            <div className="space-y-1">
              <Label>Ownership Type</Label>
              <select className="w-full border border-border rounded-md px-3 py-2 bg-background text-sm" value={form.ownership_type} onChange={set("ownership_type")}>
                <option value="Company">Company</option>
                <option value="Own">Own</option>
                <option value="Third-Party">Third-Party</option>
              </select>
            </div>
            {form.ownership_type === "Third-Party" && (
              <div className="space-y-1 col-span-2">
                <Label>Dealer / Company Name</Label>
                <Input placeholder="e.g. Islamabad Properties Ltd" value={form.dealer_company} onChange={set("dealer_company")} />
              </div>
            )}
            <div className="space-y-1">
              <Label>How Many Units to Add?</Label>
              <Input type="number" min={1} max={20} placeholder="1" value={form.count} onChange={set("count")} />
              <p className="text-[10px] text-muted-foreground">Enter 2 to add 2 units (e.g. A-101-1, A-101-2)</p>
            </div>
            <div className="space-y-1">
              <Label>Description / Notes</Label>
              <Input placeholder="Optional notes about this apartment" value={form.description} onChange={set("description")} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground">
              {saving ? "Saving..." : "Save Apartment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
