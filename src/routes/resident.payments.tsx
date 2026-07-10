import { createFileRoute } from "@tanstack/react-router";
import { ResidentLayout } from "@/components/resident/ResidentLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleTable } from "@/components/admin/SimpleTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { requireUserWithRedirect } from "@/lib/requireUser";
import { toast } from "sonner";
import { format } from "date-fns";
import { compressImage } from "@/lib/image-compress";
import { getApiBase } from "@/lib/api-client";

export const Route = createFileRoute("/resident/payments")({ component: Page });

type Req = { id: string; amount: number; method: string; reference: string | null; status: string; created_at: string };

function Page() {
  const { user, isResident } = useAuth();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Req[]>([]);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setFilePreview(null);
      return;
    }
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setFilePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setFilePreview("pdf");
    }
  }, [file]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("payment_requests")
      .select("id,amount,method,reference,status,created_at")
      .eq("resident_id", user.id)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Req[]);
  };
  useEffect(() => {
    load();
    if (!user) return;

    const channel = supabase
      .channel("payment-requests-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_requests", filter: `resident_id=eq.${user.id}` },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const submit = async () => {
    const userId = await requireUserWithRedirect();
    if (!userId) return;
    if (!isResident) { toast.error("Resident role required"); return; }

    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setSaving(true);
    let receipt_path: string | null = null;
    try {
      if (file) {
        const allowedMimes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
        if (!allowedMimes.includes(file.type)) {
          toast.error("Only PDF, JPG, and PNG files are allowed");
          setSaving(false);
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error("File size must be under 5MB");
          setSaving(false);
          return;
        }
        const uploadFile = await compressImage(file);
        
        // 1. Try local upload first
        try {
          const fd = new FormData();
          fd.append("file", uploadFile);
          fd.append("title", uploadFile.name);
          fd.append("owner_type", "payment-receipt");
          fd.append("owner_id", userId);
          fd.append("doc_type", "receipt");

          const token = localStorage.getItem("mgt_api_token");
          const res = await fetch(`${getApiBase()}/documents`, {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: fd
          });
          if (!res.ok) throw new Error("Local upload failed");
          const data = await res.json() as { file_path: string };
          const apiHost = getApiBase().replace(/\/api$/, "");
          receipt_path = `${apiHost}/uploads/${data.file_path}`;
        } catch (localErr) {
          console.warn("Local upload failed, trying cloud fallback:", localErr);
          const path = `${userId}/${Date.now()}-${file.name}`;
          const { error: upErr } = await supabase.storage.from("receipts").upload(path, uploadFile);
          if (upErr) { throw upErr; }
          receipt_path = path;
        }
      }
      const { error } = await supabase.from("payment_requests").insert({
        resident_id: userId,
        amount: amt,
        method,
        reference: reference.trim() || null,
        note: note.trim() || null,
        receipt_path,
        status: "pending",
      });
      setSaving(false);
      if (error) throw error;
      toast.success("Payment submitted — pending admin review");
      setAmount(""); setReference(""); setNote(""); setFile(null);
      load();
    } catch (e: any) {
      console.error("Submit payment failed:", e);
      toast.error("Could not submit payment — try again");
      setSaving(false);
    }
  };

  return (
    <ResidentLayout title="Payments">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-card border border-border/60 rounded-lg p-6 lg:col-span-1">
          <h3 className="font-display text-xl mb-4">Submit Payment</h3>
          <div className="space-y-3">
            <div><Label>Amount (PKR)</Label><Input type="number" className="mt-1" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div>
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Reference / TX ID</Label><Input className="mt-1" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
            <div><Label>Note</Label><Input className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <div>
              <Label>Receipt (image/PDF)</Label>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png" className="mt-1" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {filePreview && (
                <div className="mt-2 p-2 border border-border/40 rounded-lg flex items-center gap-3 bg-muted/20">
                  {filePreview === "pdf" ? (
                    <div className="h-10 w-10 flex items-center justify-center bg-red-950/20 text-red-500 rounded border border-red-900/30 font-bold text-xs">PDF</div>
                  ) : (
                    <img src={filePreview} className="h-12 w-12 object-cover rounded border border-border" alt="Preview" />
                  )}
                  <div className="text-[10px] truncate max-w-xs">
                    <p className="font-bold text-foreground truncate">{file?.name}</p>
                    <p className="text-muted-foreground">{(file!.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
              )}
            </div>
            <Button className="w-full bg-primary text-primary-foreground" onClick={submit} disabled={saving}>
              {saving ? "Submitting..." : "Submit Payment"}
            </Button>
          </div>
        </div>
        <div className="lg:col-span-2">
          {rows.length === 0 ? (
            <div className="bg-card border border-border/60 rounded-lg p-10 text-center text-sm text-muted-foreground">
              You have no payment submissions yet.
            </div>
          ) : (
            <SimpleTable
              rows={rows.map((r) => ({
                date: format(new Date(r.created_at), "dd MMM yyyy"),
                method: r.method,
                amount: `PKR ${Number(r.amount).toLocaleString()}`,
                ref: r.reference ?? "—",
                status: r.status,
              }))}
              columns={[
                { key: "date", label: "Date" },
                { key: "method", label: "Method" },
                { key: "amount", label: "Amount" },
                { key: "ref", label: "Reference" },
                { key: "status", label: "Status" },
              ]}
            />
          )}
        </div>
      </div>
    </ResidentLayout>
  );
}
