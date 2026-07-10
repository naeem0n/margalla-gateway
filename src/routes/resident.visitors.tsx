import { createFileRoute } from "@tanstack/react-router";
import { ResidentLayout } from "@/components/resident/ResidentLayout";
import { SimpleTable } from "@/components/admin/SimpleTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { requireUserWithRedirect } from "@/lib/requireUser";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/resident/visitors")({ component: Page });

type V = { id: string; visitor_name: string; purpose: string | null; phone: string | null; vehicle_no: string | null; in_time: string | null };

function Page() {
  const { user, isResident } = useAuth();
  const { profile } = useProfile();
  const [rows, setRows] = useState<V[]>([]);
  const [form, setForm] = useState({ visitor_name: "", purpose: "", phone: "", vehicle_no: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      if (!profile?.apartment_no) { setRows([]); return; }
      const { data, error } = await supabase.from("visitors")
        .select("id,visitor_name,purpose,phone,vehicle_no,in_time")
        .eq("apartment_no", profile.apartment_no)
        .order("in_time", { ascending: false });
      if (error) throw error;
      const mapped = (data ?? []) as V[];
      setRows(mapped);
      localStorage.setItem(`margalla_visitors_${profile.apartment_no}`, JSON.stringify(mapped));
    } catch (e: any) {
      console.error("Load visitors failed, trying local fallback:", e);
      if (profile?.apartment_no) {
        const offlineData = localStorage.getItem(`margalla_visitors_${profile.apartment_no}`);
        if (offlineData) {
          try {
            setRows(JSON.parse(offlineData));
          } catch (_) {}
        }
      }
    }
  };
  useEffect(() => { load(); }, [profile?.apartment_no]);

  const submit = async () => {
    const userId = await requireUserWithRedirect();
    if (!userId) return;
    if (!isResident) { toast.error("Resident role required"); return; }
    if (!profile?.apartment_no) return toast.error("Your apartment is not set on your profile");
    if (!form.visitor_name.trim()) return toast.error("Visitor name is required");
    setSaving(true);
    try {
      const payload = {
        visitor_name: form.visitor_name.trim(),
        purpose: form.purpose.trim() || null,
        phone: form.phone.trim() || null,
        vehicle_no: form.vehicle_no.trim() || null,
        apartment_no: profile.apartment_no,
        host_name: profile.full_name ?? null,
        in_time: new Date().toISOString(),
      };

      try {
        const { error } = await supabase.from("visitors").insert(payload);
        if (error) throw error;
      } catch (dbErr) {
        console.warn("Database insert failed, writing to local storage:", dbErr);
        const offlineData = localStorage.getItem(`margalla_visitors_${profile.apartment_no}`);
        let list: V[] = [];
        if (offlineData) {
          try { list = JSON.parse(offlineData); } catch (_) {}
        }
        list.unshift({
          id: `offline-visitor-${Date.now()}`,
          ...payload
        });
        localStorage.setItem(`margalla_visitors_${profile.apartment_no}`, JSON.stringify(list));
      }
      setSaving(false);
      toast.success("Visitor registered");
      setForm({ visitor_name: "", purpose: "", phone: "", vehicle_no: "" });
      load();
    } catch (e: any) {
      console.error("Register visitor failed:", e);
      toast.error("Could not register visitor — try again");
      setSaving(false);
    }
  };

  return (
    <ResidentLayout title="My Visitors">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-card border border-border/60 rounded-lg p-6">
          <h3 className="font-display text-xl mb-4">Pre-register Visitor</h3>
          <div className="space-y-3">
            <div><Label>Visitor Name</Label><Input className="mt-1" value={form.visitor_name} onChange={(e) => setForm({ ...form, visitor_name: e.target.value })} /></div>
            <div><Label>Purpose</Label><Input className="mt-1" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
            <div><Label>Phone</Label><Input className="mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Vehicle No.</Label><Input className="mt-1" value={form.vehicle_no} onChange={(e) => setForm({ ...form, vehicle_no: e.target.value })} /></div>
            <Button className="w-full bg-primary text-primary-foreground" onClick={submit} disabled={saving}>
              {saving ? "Saving..." : "Pre-register"}
            </Button>
          </div>
        </div>
        <div className="lg:col-span-2">
          {rows.length === 0 ? (
            <div className="bg-card border border-border/60 rounded-lg p-10 text-center text-sm text-muted-foreground">
              No visitors logged for your apartment yet.
            </div>
          ) : (
            <SimpleTable
              rows={rows.map((r) => ({
                name: r.visitor_name,
                purpose: r.purpose ?? "—",
                vehicle: r.vehicle_no ?? "—",
                date: r.in_time ? format(new Date(r.in_time), "dd MMM") : "—",
                time: r.in_time ? format(new Date(r.in_time), "hh:mm a") : "—",
              }))}
              columns={[
                { key: "name", label: "Visitor" },
                { key: "purpose", label: "Purpose" },
                { key: "vehicle", label: "Vehicle" },
                { key: "date", label: "Date" },
                { key: "time", label: "Time" },
              ]}
            />
          )}
        </div>
      </div>
    </ResidentLayout>
  );
}
