import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/book")({
  head: () => ({ meta: [
    { title: "Book a Visit — Margalla Gateway" },
    { name: "description", content: "Schedule a personal tour of Margalla Gateway." },
  ]}),
  component: BookPage,
});

function BookPage() {
  const [sending, setSending] = useState(false);
  return (
    <PageShell title="Book a Visit" subtitle="Schedule a private tour at your convenience.">
      <form
        className="max-w-2xl mx-auto bg-card border border-border/60 rounded-lg p-8 space-y-5 mt-8"
        onSubmit={(e) => { e.preventDefault(); setSending(true); setTimeout(() => { setSending(false); toast.success("Visit booked! We'll confirm shortly."); (e.target as HTMLFormElement).reset(); }, 800); }}
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Full Name</Label><Input required className="mt-1" /></div>
          <div><Label>Phone</Label><Input required className="mt-1" /></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Email</Label><Input required type="email" className="mt-1" /></div>
          <div>
            <Label>Apartment Type</Label>
            <Select>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Bedroom — PKR 45,000</SelectItem>
                <SelectItem value="2">2 Bedroom — PKR 65,000</SelectItem>
                <SelectItem value="3-standard">3 Bedroom (Standard) — PKR 110,000</SelectItem>
                <SelectItem value="3-compact">3 Bedroom (Compact) — PKR 85,000</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Preferred Date</Label><Input required type="date" className="mt-1" /></div>
          <div><Label>Preferred Time</Label><Input required type="time" className="mt-1" /></div>
        </div>
        <div><Label>Notes</Label><Textarea rows={4} className="mt-1" placeholder="Anything we should know?" /></div>
        <Button disabled={sending} className="bg-primary text-primary-foreground w-full">{sending ? "Booking..." : "Confirm Visit"}</Button>
      </form>
    </PageShell>
  );
}
