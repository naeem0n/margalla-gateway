import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Phone, Mail, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [
    { title: "Contact — Margalla Gateway" },
    { name: "description", content: "Get in touch with the Margalla Gateway team." },
  ]}),
  component: ContactPage,
});

function ContactPage() {
  const [sending, setSending] = useState(false);
  return (
    <PageShell title="Contact" subtitle="We'd love to hear from you.">
      <div className="grid lg:grid-cols-3 gap-8 mt-8">
        <div className="space-y-4">
          {[
            { i: Phone, t: "Phone", v: "+92 300 1234567" },
            { i: Mail, t: "Email", v: "info@margalla-gateway.com" },
            { i: MapPin, t: "Address", v: "E-11/4, Street No 26-A, Islamabad" },
          ].map((x) => (
            <div key={x.t} className="bg-card border border-border/60 rounded-lg p-5 flex gap-4">
              <x.i className="h-6 w-6 text-primary shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground">{x.t}</div>
                <div className="font-medium">{x.v}</div>
              </div>
            </div>
          ))}
        </div>
        <form
          className="lg:col-span-2 bg-card border border-border/60 rounded-lg p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSending(true);
            setTimeout(() => { setSending(false); toast.success("Message sent. We'll be in touch soon."); (e.target as HTMLFormElement).reset(); }, 800);
          }}
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div><Label>Full Name</Label><Input required placeholder="John Doe" className="mt-1" /></div>
            <div><Label>Phone</Label><Input required placeholder="+92 300 0000000" className="mt-1" /></div>
          </div>
          <div><Label>Email</Label><Input required type="email" placeholder="you@example.com" className="mt-1" /></div>
          <div><Label>Message</Label><Textarea required rows={5} placeholder="How can we help?" className="mt-1" /></div>
          <Button disabled={sending} className="bg-primary text-primary-foreground">{sending ? "Sending..." : "Send Message"}</Button>
        </form>
      </div>
    </PageShell>
  );
}
