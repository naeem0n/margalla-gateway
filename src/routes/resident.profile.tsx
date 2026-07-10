import { createFileRoute } from "@tanstack/react-router";
import { ResidentLayout } from "@/components/resident/ResidentLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { requireUserWithRedirect } from "@/lib/requireUser";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { IdCard } from "lucide-react";
import jsPDF from "jspdf";

export const Route = createFileRoute("/resident/profile")({ component: Page });

function Page() {
  const { user } = useAuth();
  const [form, setForm] = useState({ full_name: "", cnic: "", phone: "", email: "", apartment_no: "", client_id: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name,cnic,phone,email,apartment_no,client_id").eq("id", user.id).maybeSingle()
      .then(({ data }: any) => {
        if (data) setForm({
          full_name: data.full_name ?? "",
          cnic: data.cnic ?? "",
          phone: data.phone ?? "",
          email: data.email ?? user.email ?? "",
          apartment_no: data.apartment_no ?? "",
          client_id: data.client_id ?? "",
        });
        setLoading(false);
      });
  }, [user]);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    const userId = await requireUserWithRedirect();
    if (!userId || !user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name || null,
      cnic: form.cnic || null,
      phone: form.phone || null,
      email: form.email || null,
    }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
  };

  const printIdCard = () => {
    const doc = new jsPDF({ format: [85, 55], unit: "mm", orientation: "landscape" });
    doc.setFillColor(15, 35, 70);
    doc.rect(0, 0, 85, 14, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11); doc.text("MARGALLA GATEWAY", 4, 9);
    doc.setFontSize(7); doc.text("Resident ID Card", 4, 12.5);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.text("Name:", 4, 22); doc.text(form.full_name || "-", 22, 22);
    doc.text("Apt:", 4, 28); doc.text(form.apartment_no || "-", 22, 28);
    doc.text("Phone:", 4, 34); doc.text(form.phone || "-", 22, 34);
    doc.setFontSize(10); doc.setTextColor(180, 140, 50);
    doc.text(form.client_id || "—", 4, 44);
    doc.setFontSize(6); doc.setTextColor(100, 100, 100);
    doc.text("Valid only with management authorization.", 4, 50);
    doc.autoPrint(); 
    window.open(doc.output("bloburl"), "_blank");
  };

  return (
    <ResidentLayout title="My Profile">
      <div className="max-w-2xl bg-card border border-border/60 rounded-lg p-6 space-y-4">
        {loading ? <div className="text-sm text-muted-foreground">Loading...</div> : (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label>Full Name</Label><Input className="mt-1" value={form.full_name} disabled /></div>
              <div><Label>CNIC</Label><Input className="mt-1" value={form.cnic} disabled /></div>
              <div><Label>Phone</Label><Input className="mt-1" value={form.phone} disabled /></div>
              <div><Label>Email</Label><Input className="mt-1" value={form.email} disabled /></div>
              <div><Label>Apartment</Label><Input className="mt-1" value={form.apartment_no} disabled /></div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={printIdCard}>
                <IdCard className="mr-2 h-4 w-4" /> Print ID Card
              </Button>
            </div>
          </>
        )}
      </div>
    </ResidentLayout>
  );
}
