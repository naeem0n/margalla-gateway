import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { requireUserWithRedirect } from "@/lib/requireUser";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { downloadVisitorsPDF } from "@/lib/pdf";

export const Route = createFileRoute("/admin/visitors")({ component: Page });

/* ─── Types ─────────────────────────────────────────────── */
type VisitorRow = {
  id: string;
  visitor_name: string;
  cnic: string | null;
  phone: string | null;
  apartment_no: string | null;
  purpose: string | null;
  vehicle_no: string | null;
  host_name: string | null;
  in_time: string | null;
  out_time: string | null;
};

type VisitorForm = {
  visitor_name: string;
  visitor_cnic: string;
  visitor_phone: string;
  apartment_no: string;
  vehicle_no: string;
  purpose_of_visit: string;
};

const EMPTY_FORM: VisitorForm = {
  visitor_name: "",
  visitor_cnic: "",
  visitor_phone: "",
  apartment_no: "",
  vehicle_no: "",
  purpose_of_visit: "",
};

/* ─── Page ───────────────────────────────────────────────── */
function Page() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<VisitorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<VisitorForm>(EMPTY_FORM);
  const [msg, setMsg] = useState("");

  /* ── Fetch ── */
  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("visitors")
      .select("id,visitor_name,cnic,phone,apartment_no,purpose,vehicle_no,host_name,in_time,out_time")
      .order("in_time", { ascending: false })
      .limit(300);
    setRows((data ?? []) as VisitorRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.visitor_name.trim() || !form.visitor_cnic.trim() || !form.apartment_no.trim()) {
      setMsg("🚨 Name, CNIC aur Apartment No lazmi hain!");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const userId = await requireUserWithRedirect();
      if (!userId) { setSaving(false); return; }
      if (!isAdmin) { toast.error("Admin access required"); setSaving(false); return; }

      const { error } = await supabase.from("visitors").insert({
        visitor_name: form.visitor_name.trim(),
        cnic:         form.visitor_cnic.trim() || null,
        phone:        form.visitor_phone.trim() || null,
        apartment_no: form.apartment_no.trim() || null,
        vehicle_no:   form.vehicle_no.trim() || null,
        purpose:      form.purpose_of_visit.trim() || null,
      });

      setSaving(false);
      if (error) { setMsg(`🚨 ${error.message}`); return; }

      setMsg("✅ Visitor credentials saved securely!");
      setForm(EMPTY_FORM);
      load();
    } catch (err: any) {
      console.error("Visitor save error:", err);
      setMsg("🚨 Security API communication failure.");
      setSaving(false);
    }
  };

  /* ── Mark check-out ── */
  const markOut = async (id: string) => {
    try {
      const userId = await requireUserWithRedirect();
      if (!userId) return;
      if (!isAdmin) { toast.error("Admin access required"); return; }
      const { error } = await supabase
        .from("visitors")
        .update({ out_time: new Date().toISOString() })
        .eq("id", id);
      if (error) return toast.error(error.message);
      toast.success("Marked checked-out");
      load();
    } catch (err: any) {
      console.error("Mark out failed:", err);
      toast.error("Could not mark check-out — try again");
    }
  };

  /* ─── Render ─────────────────────────────────────────── */
  return (
    <AdminLayout title="Visitors">
      {/* ── Header bar ── */}
      <div className="border-b border-slate-800 pb-4 mb-6 flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-xl font-black text-yellow-500 tracking-wide">
            🛡️ TOWER SECURITY & VISITOR GUARD GATE
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Isolated credentials tracking sheet — Zero Tenant Data cross interference.
          </p>
        </div>
        <button
          onClick={() => downloadVisitorsPDF(rows as any)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-xs transition-colors"
        >
          🖨️ Print Visitor Log Sheet
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 print:block">

        {/* ── VISITOR LOGGING FORM ── */}
        <div className="bg-card border border-border/60 p-5 rounded-2xl space-y-4 h-fit print:hidden shadow-sm">
          <h3 className="text-sm font-bold text-foreground uppercase border-b border-border pb-2">
            📝 Log New Entry
          </h3>

          {msg && (
            <div className="p-2 bg-slate-950/60 text-xs text-yellow-400 border border-slate-700 rounded-lg">
              {msg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            {/* Name */}
            <div>
              <label className="text-muted-foreground block mb-1 font-medium">
                Visitor Full Name *
              </label>
              <input
                type="text"
                value={form.visitor_name}
                onChange={e => setForm({ ...form, visitor_name: e.target.value })}
                className="w-full bg-background border border-border rounded-xl p-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-yellow-500/40 transition"
                placeholder="e.g., Kamran Ahmed"
              />
            </div>

            {/* CNIC */}
            <div>
              <label className="text-muted-foreground block mb-1 font-medium">
                CNIC / Identification No *
              </label>
              <input
                type="text"
                value={form.visitor_cnic}
                onChange={e => setForm({ ...form, visitor_cnic: e.target.value })}
                className="w-full bg-background border border-border rounded-xl p-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-yellow-500/40 transition"
                placeholder="37405-XXXXXXXX-X"
              />
            </div>

            {/* Phone + Apartment */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-muted-foreground block mb-1 font-medium">Phone Number</label>
                <input
                  type="text"
                  value={form.visitor_phone}
                  onChange={e => setForm({ ...form, visitor_phone: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl p-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-yellow-500/40 transition"
                  placeholder="03XX-XXXXXXX"
                />
              </div>
              <div>
                <label className="text-muted-foreground block mb-1 font-medium">Target Apt No *</label>
                <input
                  type="text"
                  value={form.apartment_no}
                  onChange={e => setForm({ ...form, apartment_no: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl p-3 text-yellow-500 font-bold placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-yellow-500/40 transition"
                  placeholder="e.g., 108"
                />
              </div>
            </div>

            {/* Vehicle */}
            <div>
              <label className="text-muted-foreground block mb-1 font-medium">
                Vehicle Registration No
              </label>
              <input
                type="text"
                value={form.vehicle_no}
                onChange={e => setForm({ ...form, vehicle_no: e.target.value })}
                className="w-full bg-background border border-border rounded-xl p-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-yellow-500/40 transition"
                placeholder="e.g., ICT-RIZ-123"
              />
            </div>

            {/* Purpose */}
            <div>
              <label className="text-muted-foreground block mb-1 font-medium">
                Purpose of Visit
              </label>
              <input
                type="text"
                value={form.purpose_of_visit}
                onChange={e => setForm({ ...form, purpose_of_visit: e.target.value })}
                className="w-full bg-background border border-border rounded-xl p-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-yellow-500/40 transition"
                placeholder="e.g., Maintenance Work / Guest"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-60 text-slate-950 font-black py-3 rounded-xl transition-colors mt-4"
            >
              {saving ? "⏳ Saving…" : "🔒 LOCK SECURE GATE ENTRY"}
            </button>
          </form>
        </div>

        {/* ── VISITOR LOGS TABLE ── */}
        <div className="xl:col-span-2 bg-card border border-border/60 p-5 rounded-2xl space-y-4 shadow-sm print:bg-white print:border-none print:text-black">
          <div className="flex items-center justify-between border-b border-border pb-2 print:border-black">
            <h3 className="font-extrabold text-sm text-foreground print:text-black">
              📋 Audited Guard Gate Records (Read-Only Logs)
            </h3>
            {loading && (
              <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wider print:bg-gray-100 print:text-black">
                <tr>
                  <th className="p-3 rounded-tl-lg">Visitor Info</th>
                  <th className="p-3">CNIC / ID</th>
                  <th className="p-3 text-center">Apt</th>
                  <th className="p-3">Vehicle #</th>
                  <th className="p-3">Purpose</th>
                  <th className="p-3 text-right">Check-In</th>
                  <th className="p-3 text-right rounded-tr-lg">Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-muted-foreground">
                      No visitor entries yet.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-muted/20 transition-colors print:text-black print:border-gray-300"
                  >
                    {/* Name + Phone */}
                    <td className="p-3">
                      <span className="font-bold text-foreground print:text-black">{r.visitor_name}</span>
                      <br />
                      <span className="text-[10px] text-muted-foreground print:text-black">
                        {r.phone || "No Phone"}
                      </span>
                    </td>

                    {/* CNIC */}
                    <td className="p-3 font-mono text-foreground/80 print:text-black">
                      {r.cnic || "—"}
                    </td>

                    {/* Apartment */}
                    <td className="p-3 text-center font-black text-yellow-500 text-sm print:text-black">
                      {r.apartment_no || "—"}
                    </td>

                    {/* Vehicle */}
                    <td className="p-3 font-bold text-blue-400 print:text-black">
                      {r.vehicle_no || "—"}
                    </td>

                    {/* Purpose */}
                    <td className="p-3 text-muted-foreground print:text-black">
                      {r.purpose || "—"}
                    </td>

                    {/* Check-in */}
                    <td className="p-3 text-right font-mono text-muted-foreground print:text-black">
                      {r.in_time ? format(new Date(r.in_time), "dd MMM hh:mm a") : "—"}
                    </td>

                    {/* Check-out / action */}
                    <td className="p-3 text-right print:text-black">
                      {r.out_time ? (
                        <span className="font-mono text-green-500">
                          {format(new Date(r.out_time), "hh:mm a")}
                        </span>
                      ) : (
                        <button
                          onClick={() => markOut(r.id)}
                          className="text-[10px] border border-border rounded-md px-2 py-1 hover:bg-muted transition-colors text-foreground"
                        >
                          Check-out
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
