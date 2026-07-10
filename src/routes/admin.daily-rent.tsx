import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, LogIn, LogOut, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BookingDialog } from "@/components/booking/BookingDialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { requireUserWithRedirect } from "@/lib/requireUser";
import { useAuth } from "@/hooks/useAuth";

type Row = {
  id: string;
  apartment_no: string;
  guest_name: string;
  guest_phone: string | null;
  check_in_date: string;
  check_in_time: string;
  check_out_date: string;
  check_out_time: string;
  nights: number;
  rate_per_night: number;
  extra_parking_spots: number;
  parking_charge_per_day: number;
  total_amount: number;
  status: "booked" | "checked_in" | "checked_out" | "cancelled";
  notes: string | null;
};

export const Route = createFileRoute("/admin/daily-rent")({ component: Page });

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Row | null>(null);
  const [filter, setFilter] = useState<"all" | Row["status"]>("all");
  const { isAdmin } = useAuth();

  const formatLocalDate = (dateStr: string) => {
    try {
      const parts = dateStr.split("-").map(Number);
      if (parts.length === 3) {
        const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
        return format(dateObj, "dd MMM");
      }
    } catch (e) {
      console.error(e);
    }
    return dateStr;
  };

  const load = async () => {
    setLoading(true);
    let q = supabase.from("daily_bookings").select("*").order("check_in_date", { ascending: false });
    const { data } = await q;
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: Row["status"]) => {
    try {
      const userId = await requireUserWithRedirect();
      if (!userId) return;
      if (!isAdmin) { toast.error("Admin access required"); return; }
      const { error } = await supabase.from("daily_bookings").update({ status }).eq("id", id);
      if (error) return toast.error(error.message);
      toast.success(`Marked ${status.replace("_", " ")}`);
      load();
    } catch (e: any) {
      console.error("Update booking status failed:", e);
      toast.error("Could not save status — try again");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete booking?")) return;
    try {
      const userId = await requireUserWithRedirect();
      if (!userId) return;
      if (!isAdmin) { toast.error("Admin access required"); return; }
      const { error } = await supabase.from("daily_bookings").delete().eq("id", id);
      if (error) return toast.error(error.message);
      load();
    } catch (e: any) {
      console.error("Delete booking failed:", e);
      toast.error("Could not delete booking — try again");
    }
  };

  const list = filter === "all" ? rows : rows.filter(r => r.status === filter);

  const totals = list.reduce(
    (a, r) => {
      a.count++;
      if (r.status !== "cancelled") a.revenue += Number(r.total_amount);
      return a;
    },
    { count: 0, revenue: 0 }
  );

  const badge = (s: Row["status"]) => {
    const m: any = {
      booked: "bg-primary/15 text-primary",
      checked_in: "bg-success/15 text-success",
      checked_out: "bg-muted text-muted-foreground",
      cancelled: "bg-destructive/15 text-destructive",
    };
    return <Badge className={m[s]}>{s.replace("_", " ")}</Badge>;
  };

  return (
    <AdminLayout title="Daily Rent">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <div className="text-xs text-muted-foreground">Total Bookings</div>
            <div className="text-2xl font-display">{totals.count}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Revenue (active)</div>
            <div className="text-2xl font-display text-success">PKR {totals.revenue.toLocaleString()}</div>
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="booked">Booked</SelectItem>
              <SelectItem value="checked_in">Checked-in</SelectItem>
              <SelectItem value="checked_out">Checked-out</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setEdit(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Booking
        </Button>
      </div>

      <div className="bg-card border border-border/60 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-muted-foreground text-xs">
            <tr>
              <th className="text-left px-3 py-2">Apt</th>
              <th className="text-left px-3 py-2">Guest</th>
              <th className="text-left px-3 py-2">Check-in</th>
              <th className="text-left px-3 py-2">Check-out</th>
              <th className="text-right px-3 py-2">Nights</th>
              <th className="text-right px-3 py-2">Parking</th>
              <th className="text-right px-3 py-2">Total</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-6 text-muted-foreground">Loading...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-6 text-muted-foreground">No bookings</td></tr>
            ) : list.map(r => (
              <tr key={r.id} className="border-t border-border/40 hover:bg-secondary/30">
                <td className="px-3 py-2 font-medium">{r.apartment_no}</td>
                <td className="px-3 py-2">{r.guest_name}<div className="text-xs text-muted-foreground">{r.guest_phone}</div></td>
                <td className="px-3 py-2 text-xs">{formatLocalDate(r.check_in_date)} {r.check_in_time}</td>
                <td className="px-3 py-2 text-xs">{formatLocalDate(r.check_out_date)} {r.check_out_time}</td>
                <td className="px-3 py-2 text-right">{r.nights}</td>
                <td className="px-3 py-2 text-right">{r.extra_parking_spots > 0 ? `+${r.extra_parking_spots}` : "—"}</td>
                <td className="px-3 py-2 text-right font-semibold">PKR {Number(r.total_amount).toLocaleString()}</td>
                <td className="px-3 py-2">{badge(r.status)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {r.status === "booked" && (
                    <Button size="sm" variant="ghost" title="Check-in" onClick={() => setStatus(r.id, "checked_in")}><LogIn className="h-4 w-4 text-success" /></Button>
                  )}
                  {r.status === "checked_in" && (
                    <Button size="sm" variant="ghost" title="Check-out" onClick={() => setStatus(r.id, "checked_out")}><LogOut className="h-4 w-4 text-primary" /></Button>
                  )}
                  {r.status !== "cancelled" && r.status !== "checked_out" && (
                    <Button size="sm" variant="ghost" title="Cancel" onClick={() => setStatus(r.id, "cancelled")}><X className="h-4 w-4 text-destructive" /></Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => { setEdit(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BookingDialog open={open} onOpenChange={setOpen} initial={edit ?? undefined} onSaved={load} />
    </AdminLayout>
  );
}
