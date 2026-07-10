import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { requireUserWithRedirect } from "@/lib/requireUser";
import { apiFetch } from "@/lib/api-client";

const DEFAULT_RATE = 5000;          // PKR / night
const FREE_PARKING = 1;             // 1 free spot per apartment
const PARKING_PER_DAY = 500;        // PKR per extra spot per day

type Booking = {
  id?: string;
  apartment_no: string;
  guest_name: string;
  guest_phone: string | null;
  check_in_date: string;
  check_in_time: string;
  check_out_date: string;
  check_out_time: string;
  extra_parking_spots: number;
  rate_per_night: number;
  parking_charge_per_day: number;
  notes: string | null;
};

const empty = (): Booking => ({
  apartment_no: "",
  guest_name: "",
  guest_phone: "",
  check_in_date: format(new Date(), "yyyy-MM-dd"),
  check_in_time: "14:00",
  check_out_date: format(new Date(Date.now() + 86400000), "yyyy-MM-dd"),
  check_out_time: "12:00",
  extra_parking_spots: 0,
  rate_per_night: 0,
  parking_charge_per_day: 0,
  notes: "",
});

export function BookingDialog({
  open,
  onOpenChange,
  initial,
  defaultApartment,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Booking;
  defaultApartment?: string;
  onSaved: () => void;
}) {
  const [b, setB] = useState<Booking>(empty());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setB(initial ? { ...initial } : { ...empty(), apartment_no: defaultApartment ?? "" });
    }
  }, [open, initial, defaultApartment]);

  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date(dateStr);
  };

  const ci = useMemo(() => parseLocalDate(b.check_in_date), [b.check_in_date]);
  const co = useMemo(() => parseLocalDate(b.check_out_date), [b.check_out_date]);
  const nights = Math.max(1, differenceInCalendarDays(co, ci) || 1);
  const extraParking = Math.max(0, Number(b.extra_parking_spots) || 0);
  const total = nights * Number(b.rate_per_night) + nights * extraParking * Number(b.parking_charge_per_day);

  const save = async () => {
    if (!b.apartment_no || !b.guest_name) { toast.error("Apartment & guest name required"); return; }
    if (co <= ci) { toast.error("Check-out must be after check-in"); return; }
    setSaving(true);
    try {
      const userId = await requireUserWithRedirect();
      if (!userId) return;
      const payload = {
        apartment_no: b.apartment_no,
        guest_name: b.guest_name,
        guest_phone: b.guest_phone || null,
        check_in_date: b.check_in_date,
        check_in_time: b.check_in_time,
        check_out_date: b.check_out_date,
        check_out_time: b.check_out_time,
        nights,
        rate_per_night: Number(b.rate_per_night),
        extra_parking_spots: extraParking,
        parking_charge_per_day: Number(b.parking_charge_per_day),
        total_amount: total,
        notes: b.notes || null,
      };
      const { error, data } = initial?.id
        ? await supabase.from("daily_bookings").update(payload).eq("id", initial.id).select()
        : await supabase.from("daily_bookings").insert({ ...payload, created_by: userId }).select();
      if (error) throw error;
      
      // Auto-post to ledger if amount > 0 and it's a new booking or we want to just record it
      if (total > 0 && !initial?.id) {
        try {
          await apiFetch('/ledger', {
            method: 'POST',
            body: JSON.stringify({
              user_id: 'system',
              entry_date: b.check_in_date,
              entry_type: 'other',
              description: `Daily Booking: Apt ${b.apartment_no} - Guest: ${b.guest_name} (Nights: ${nights}, Parking: PKR ${b.parking_charge_per_day}/day)`,
              debit: 0,
              credit: total
            })
          });
        } catch (e) {
          console.error("Ledger post failed", e);
        }
      }

      toast.success(initial?.id ? "Booking updated" : "Booking created");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      console.error("Booking save error:", e);
      toast.error("Could not save booking — please try again");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Booking" : "New Daily Booking"}</DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-4 py-2">
          <div>
            <Label>Apartment No</Label>
            <Input value={b.apartment_no} onChange={(e) => setB({ ...b, apartment_no: e.target.value })} placeholder="e.g. A-204" />
          </div>
          <div>
            <Label>Guest Name</Label>
            <Input value={b.guest_name} onChange={(e) => setB({ ...b, guest_name: e.target.value })} />
          </div>
          <div>
            <Label>Guest Phone</Label>
            <Input value={b.guest_phone ?? ""} onChange={(e) => setB({ ...b, guest_phone: e.target.value })} />
          </div>
          <div>
            <Label>Rate / Night (PKR)</Label>
            <Input type="number" value={b.rate_per_night} onChange={(e) => setB({ ...b, rate_per_night: Number(e.target.value) })} />
          </div>

          <div>
            <Label>Check-in Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !b.check_in_date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {b.check_in_date ? format(parseLocalDate(b.check_in_date), "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseLocalDate(b.check_in_date)}
                  onSelect={(d) => d && setB({ ...b, check_in_date: format(d, "yyyy-MM-dd") })}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Check-in Time</Label>
            <Input type="time" value={b.check_in_time} onChange={(e) => setB({ ...b, check_in_time: e.target.value })} />
          </div>

          <div>
            <Label>Check-out Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !b.check_out_date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {b.check_out_date ? format(parseLocalDate(b.check_out_date), "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseLocalDate(b.check_out_date)}
                  onSelect={(d) => d && setB({ ...b, check_out_date: format(d, "yyyy-MM-dd") })}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Check-out Time</Label>
            <Input type="time" value={b.check_out_time} onChange={(e) => setB({ ...b, check_out_time: e.target.value })} />
          </div>

          <div>
            <Label>Extra Parking Spots</Label>
            <Input type="number" min={0} value={b.extra_parking_spots} onChange={(e) => setB({ ...b, extra_parking_spots: Number(e.target.value) })} />
            <p className="text-xs text-muted-foreground mt-1">{FREE_PARKING} free per apartment. Extra: PKR {b.parking_charge_per_day}/day each.</p>
          </div>
          <div>
            <Label>Parking Charge / Day (PKR)</Label>
            <Input type="number" value={b.parking_charge_per_day} onChange={(e) => setB({ ...b, parking_charge_per_day: Number(e.target.value) })} />
          </div>

          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Textarea value={b.notes ?? ""} onChange={(e) => setB({ ...b, notes: e.target.value })} rows={2} />
          </div>

          <div className="sm:col-span-2 bg-secondary/40 rounded-md p-4 grid grid-cols-3 gap-2 text-sm">
            <div><div className="text-muted-foreground text-xs">Nights</div><div className="font-semibold">{nights}</div></div>
            <div><div className="text-muted-foreground text-xs">Parking ({extraParking} extra × {nights} day)</div><div className="font-semibold">PKR {(nights * extraParking * Number(b.parking_charge_per_day)).toLocaleString()}</div></div>
            <div><div className="text-muted-foreground text-xs">Total</div><div className="font-bold text-primary text-lg">PKR {total.toLocaleString()}</div></div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Booking"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
