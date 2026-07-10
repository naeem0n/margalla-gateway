import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { requireUserWithRedirect } from "@/lib/requireUser";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, Wallet, Banknote, FileText, RefreshCw, User, Printer, Upload, X, Eye, Download, File } from "lucide-react";
import { downloadSalarySlipPDF, downloadStaffPDF } from "@/lib/pdf";
import { apiFetch, isDesktopApp, getApiBase } from "@/lib/api-client";
import { compressImage } from "@/lib/image-compress";

export const Route = createFileRoute("/admin/staff")({ component: Page });

type Staff = {
  id: string;
  full_name: string;
  role: string;
  phone: string | null;
  cnic: string | null;
  salary: number;
  join_date: string | null;
  status: string;
  notes: string | null;
  duty_start: string | null;
  duty_end: string | null;
  advance_balance: number;
  photo_url?: string | null;
  id_card_url?: string | null;
  appointment_letter_url?: string | null;
  father_name?: string | null;
  address?: string | null;
  witness_name?: string | null;
  witness_cnic?: string | null;
  witness_phone?: string | null;
};

type SalaryPayment = {
  id: string;
  staff_id: string;
  period_month: string;
  gross_salary: number;
  advance_deducted: number;
  net_paid: number;
  paid_at: string;
};

const emptyForm = {
  full_name: "", role: "", phone: "", cnic: "",
  salary: 0, join_date: format(new Date(), "yyyy-MM-dd"),
  duty_start: "09:00", duty_end: "18:00", status: "active", notes: "",
  father_name: "", address: "",
  witness_name: "", witness_cnic: "", witness_phone: "",
  photo_url: "", id_card_url: "", appointment_letter_url: "",
};

function Page() {
  const [rows, setRows] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const [advOpen, setAdvOpen] = useState(false);
  const [advFor, setAdvFor] = useState<Staff | null>(null);
  const [advAmt, setAdvAmt] = useState("");
  const [advNotes, setAdvNotes] = useState("");
  const [advDate, setAdvDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const [payOpen, setPayOpen] = useState(false);
  const [payFor, setPayFor] = useState<Staff | null>(null);
  const [payPeriod, setPayPeriod] = useState(() => format(new Date(), "yyyy-MM"));
  const [payGross, setPayGross] = useState("");
  const [payAdvance, setPayAdvance] = useState("");

  const [uploadingField, setUploadingField] = useState<'photo_url' | 'id_card_url' | 'appointment_letter_url' | null>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileStaff, setProfileStaff] = useState<Staff | null>(null);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);

  useEffect(() => {
    if (payFor) {
      setPayGross(String(payFor.salary || 0));
      setPayAdvance(String(payFor.advance_balance || 0));
    }
  }, [payFor]);

  const { isAdmin } = useAuth();

  const formatPeriod = (periodStr: string) => {
    try {
      const parts = periodStr.split("-");
      if (parts.length >= 2) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const dateObj = new Date(y, m - 1, 1);
        return format(dateObj, "MMM yyyy");
      }
    } catch (err) {
      console.error(err);
    }
    return periodStr;
  };

  const load = async () => {
    setLoading(true);
    if (isDesktopApp()) {
      try {
        const res = await apiFetch<{ staff: any[] }>("/staff");
        if (res && res.staff) {
          setRows(res.staff as Staff[]);
        }
      } catch (localErr) {
        console.error("Local load staff failed:", localErr);
        toast.error("Could not load staff members");
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const { data, error } = await supabase.from("staff").select("*").order("full_name");
      if (error) throw error;
      setRows((data ?? []) as Staff[]);
    } catch (e: any) {
      console.warn("Load staff from Supabase failed, trying local fallback:", e);
      try {
        const res = await apiFetch<{ staff: any[] }>("/staff");
        if (res && res.staff) {
          setRows(res.staff as Staff[]);
        }
      } catch (localErr) {
        console.error("Local fallback load staff failed:", localErr);
        toast.error("Could not load staff members");
      }
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ ...emptyForm }); setOpen(true); };

  const handleFileChange = async (field: 'photo_url' | 'id_card_url' | 'appointment_letter_url', files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large (max 5MB limit). Please compress your PDF before uploading.");
      return;
    }
    setUploadingField(field);
    const toastId = toast.loading(`Uploading ${file.name}...`);
    try {
      // 1. Compress the file if it is an image
      let uploadFile = file;
      if (file.type.startsWith("image/")) {
        toast.loading("Compressing image...", { id: toastId });
        uploadFile = await compressImage(file, 1600, 1600, 0.75);
      }

      // 2. Prepare FormData
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("title", uploadFile.name);
      fd.append("owner_type", "staff");
      fd.append("owner_id", editing?.id || "temp-staff");
      fd.append("doc_type", field);

      // 3. Request upload to the local API
      const token = localStorage.getItem("mgt_api_token");
      const res = await fetch(`${getApiBase()}/documents`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd
      });
      
      if (!res.ok) {
        throw new Error("Upload failed on server");
      }
      
      const data = await res.json() as { file_path: string };
      const apiHost = getApiBase().replace(/\/api$/, "");
      const publicUrl = `${apiHost}/uploads/${data.file_path}`;
      
      setForm(f => ({ ...f, [field]: publicUrl }));
      toast.success("Document uploaded successfully", { id: toastId });
    } catch (e: any) {
      console.error("Staff document upload failed:", e);
      toast.error(e?.message || "Failed to upload document", { id: toastId });
    } finally {
      setUploadingField(null);
    }
  };

  const openDocument = (url: string, title: string) => {
    if (!url) return;
    if (url.startsWith("data:")) {
      const mime = url.split(";")[0]?.split(":")[1] || "application/octet-stream";
      const win = window.open();
      if (win) {
        win.document.write(`
          <html>
            <head>
              <title>${title}</title>
              <style>
                body { margin: 0; background: #0f172a; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; color: white; }
                img, iframe { max-width: 90%; max-height: 90vh; border: none; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                .btn { position: absolute; top: 20px; right: 20px; padding: 10px 20px; background: #e2b047; color: #000; text-decoration: none; border-radius: 4px; font-weight: bold; }
              </style>
            </head>
            <body>
              <a class="btn" href="${url}" download="${title.replace(/\s+/g, '_')}">Download File</a>
              ${mime.startsWith("image/") ? `<img src="${url}" alt="${title}" />` : `<iframe src="${url}" width="80%" height="80%"></iframe>`}
            </body>
          </html>
        `);
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = title;
        link.click();
      }
    } else {
      window.open(url, "_blank");
    }
  };

  const openEdit = (s: Staff) => {
    setEditing(s);
    setForm({
      full_name: s.full_name, role: s.role, phone: s.phone ?? "", cnic: s.cnic ?? "",
      salary: Number(s.salary) || 0, join_date: s.join_date ?? format(new Date(), "yyyy-MM-dd"),
      duty_start: s.duty_start ?? "09:00", duty_end: s.duty_end ?? "18:00",
      status: s.status, notes: s.notes ?? "",
      father_name: s.father_name ?? "", address: s.address ?? "",
      witness_name: s.witness_name ?? "", witness_cnic: s.witness_cnic ?? "", witness_phone: s.witness_phone ?? "",
      photo_url: s.photo_url ?? "", id_card_url: s.id_card_url ?? "", appointment_letter_url: s.appointment_letter_url ?? ""
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.full_name || !form.role) { toast.error("Name and role required"); return; }
    setSaving(true);
    const payload = {
      full_name: form.full_name, role: form.role, phone: form.phone || null,
      cnic: form.cnic || null, salary: Number(form.salary) || 0,
      join_date: form.join_date || null, duty_start: form.duty_start || null,
      duty_end: form.duty_end || null, status: form.status, notes: form.notes || null,
      father_name: form.father_name || null, address: form.address || null,
      witness_name: form.witness_name || null, witness_cnic: form.witness_cnic || null, witness_phone: form.witness_phone || null,
      photo_url: form.photo_url || null, id_card_url: form.id_card_url || null, appointment_letter_url: form.appointment_letter_url || null
    };

    if (isDesktopApp()) {
      try {
        if (editing) {
          await apiFetch(`/staff/${editing.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
        } else {
          await apiFetch("/staff", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        }
        toast.success(editing ? "Staff updated" : "Staff added");
        setOpen(false);
        load();
      } catch (localErr) {
        console.error("Local save failed:", localErr);
        toast.error("Could not save staff record — try again");
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      const userId = await requireUserWithRedirect();
      if (!userId) return;
      if (!isAdmin) { toast.error("Admin access required"); setSaving(false); return; }
      
      try {
        const res = editing
          ? await supabase.from("staff").update(payload).eq("id", editing.id)
          : await supabase.from("staff").insert(payload);
        if (res.error) throw res.error;
      } catch (e: any) {
        console.warn("Save staff to Supabase failed, trying local fallback:", e);
        try {
          if (editing) {
            await apiFetch(`/staff/${editing.id}`, {
              method: "PATCH",
              body: JSON.stringify(payload),
            });
          } else {
            await apiFetch("/staff", {
              method: "POST",
              body: JSON.stringify(payload),
            });
          }
        } catch (localErr) {
          console.error("Local save failed:", localErr);
          throw localErr;
        }
      }
      
      toast.success(editing ? "Staff updated" : "Staff added");
      setOpen(false);
      load();
    } catch (e: any) {
      console.error("Save staff failed:", e);
      toast.error("Could not save staff record — try again");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: Staff) => {
    if (!confirm(`Remove ${s.full_name}?`)) return;
    
    if (isDesktopApp()) {
      try {
        await apiFetch(`/staff/${s.id}`, { method: "DELETE" });
        load();
      } catch (localErr) {
        console.error("Local delete failed:", localErr);
        toast.error("Could not delete staff — try again");
      }
      return;
    }

    try {
      const userId = await requireUserWithRedirect();
      if (!userId) return;
      if (!isAdmin) { toast.error("Admin access required"); return; }
      
      try {
        const { error } = await supabase.from("staff").delete().eq("id", s.id);
        if (error) throw error;
      } catch (e: any) {
        console.warn("Delete staff from Supabase failed, trying local fallback:", e);
        try {
          await apiFetch(`/staff/${s.id}`, { method: "DELETE" });
        } catch (localErr) {
          console.error("Local delete failed:", localErr);
          throw localErr;
        }
      }
      
      load();
    } catch (e: any) {
      console.error("Delete staff failed:", e);
      toast.error("Could not delete staff — try again");
    }
  };

  const giveAdvance = async () => {
    if (!advFor || !advAmt) return;
    const amt = Number(advAmt);
    if (amt <= 0) { toast.error("Amount must be positive"); return; }

    if (isDesktopApp()) {
      try {
        await apiFetch("/staff/give-advance", {
          method: "POST",
          body: JSON.stringify({ staff_id: advFor.id, amount: amt, notes: advNotes, date: advDate }),
        });
        toast.success(`Advance PKR ${amt.toLocaleString()} paid to ${advFor.full_name}`);
        setAdvOpen(false); setAdvAmt(""); setAdvNotes(""); setAdvDate(format(new Date(), "yyyy-MM-dd"));
        load();
      } catch (localErr) {
        console.error("Local advance failed:", localErr);
        toast.error("Could not give advance — try again");
      }
      return;
    }

    try {
      const userId = await requireUserWithRedirect();
      if (!userId) return;
      if (!isAdmin) { toast.error("Admin access required"); return; }
      
      try {
        const { error } = await supabase.rpc("give_staff_advance", { _staff_id: advFor.id, _amount: amt, _notes: advNotes || undefined, _date: advDate });
        if (error) throw error;
      } catch (e: any) {
        console.warn("Give advance via Supabase failed, trying local fallback:", e);
        await apiFetch("/staff/give-advance", {
          method: "POST",
          body: JSON.stringify({ staff_id: advFor.id, amount: amt, notes: advNotes, date: advDate }),
        });
      }
      
      toast.success(`Advance PKR ${amt.toLocaleString()} paid to ${advFor.full_name}`);
      setAdvOpen(false); setAdvAmt(""); setAdvNotes(""); setAdvDate(format(new Date(), "yyyy-MM-dd"));
      load();
    } catch (e: any) {
      console.error("Give advance failed:", e);
      toast.error(e.message || "Could not give advance — try again");
    }
  };

  const paySalary = async () => {
    if (!payFor) return;
    const grossAmt = Number(payGross || 0);
    const advDeduct = Number(payAdvance || 0);
    const netAmt = Math.max(grossAmt - advDeduct, 0);
    const periodStr = payPeriod + "-01";

    let payRecord: any = null;
    try {
      const res = await apiFetch<{ payment: SalaryPayment }>("/staff/pay-salary", {
        method: "POST",
        body: JSON.stringify({ 
          staff_id: payFor.id, 
          period: periodStr,
          gross_salary: grossAmt,
          advance_deducted: advDeduct,
          net_paid: netAmt
        }),
      });
      if (res && res.payment) {
        payRecord = res.payment;
      }
    } catch (localErr: any) {
      console.error("Pay salary failed:", localErr);
      toast.error(localErr.message || "Could not pay salary — try again");
      return;
    }

    toast.success(`Salary processed · Net PKR ${netAmt.toLocaleString()}`);
    setPayOpen(false);
    
    if (payRecord) {
      downloadSalarySlipPDF({
        employee: { name: payFor.full_name, role: payFor.role, cnic: payFor.cnic ?? undefined, joinDate: payFor.join_date ?? undefined },
        period: formatPeriod(payRecord.period_month),
        grossSalary: Number(payRecord.gross_salary),
        advanceDeducted: Number(payRecord.advance_deducted),
        netPaid: Number(payRecord.net_paid),
        paidAt: format(new Date(payRecord.paid_at), "dd MMM yyyy"),
      });
    }
    load();
  };

  const openProfile = async (s: Staff) => {
    setProfileStaff(s);
    setProfileOpen(true);

    if (isDesktopApp()) {
      try {
        const res = await apiFetch<{ payments: SalaryPayment[] }>(`/staff/${s.id}/payments`);
        if (res && res.payments) {
          setPayments(res.payments);
        }
      } catch (localErr) {
        console.error("Local salary history failed:", localErr);
      }
      return;
    }

    try {
      const { data, error } = await supabase.from("staff_salary_payments").select("*").eq("staff_id", s.id).order("paid_at", { ascending: false });
      if (error) throw error;
      setPayments((data ?? []) as SalaryPayment[]);
    } catch (e: any) {
      console.warn("Fetch salary history from Supabase failed, trying local fallback:", e);
      try {
        const res = await apiFetch<{ payments: SalaryPayment[] }>(`/staff/${s.id}/payments`);
        if (res && res.payments) {
          setPayments(res.payments);
        }
      } catch (localErr) {
        console.error("Local salary history failed:", localErr);
      }
    }
  };

  const slipFor = (s: Staff, p: SalaryPayment) => {
    downloadSalarySlipPDF({
      employee: { name: s.full_name, role: s.role, cnic: s.cnic ?? undefined, joinDate: s.join_date ?? undefined },
      period: formatPeriod(p.period_month),
      grossSalary: Number(p.gross_salary),
      advanceDeducted: Number(p.advance_deducted),
      netPaid: Number(p.net_paid),
      paidAt: format(new Date(p.paid_at), "dd MMM yyyy"),
    });
  };

  return (
    <AdminLayout title="Staff">
      <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
        <p className="text-muted-foreground text-sm">{rows.length} employees · {rows.filter(r => r.status === "active").length} active</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => downloadStaffPDF(rows)}><Printer className="h-4 w-4 mr-1" />Print PDF</Button>
          <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Staff</Button>
        </div>
      </div>

      <div className="bg-card border border-border/60 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-muted-foreground text-xs">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Role</th>
              <th className="text-left px-3 py-2">Phone</th>
              <th className="text-left px-3 py-2">Duty</th>
              <th className="text-right px-3 py-2">Salary</th>
              <th className="text-right px-3 py-2">Advance</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">No staff yet. Click "Add Staff".</td></tr>
            ) : rows.map(s => (
              <tr key={s.id} className="border-t border-border/40 hover:bg-secondary/30">
                <td className="px-3 py-2 font-medium">
                  <div className="flex items-center gap-2">
                    {s.photo_url ? (
                      <img src={s.photo_url} className="w-8 h-8 rounded-full object-cover border border-primary/20 shadow-sm" alt="" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                        {(s.full_name || "??").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div>{s.full_name}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">{s.cnic ?? ""}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">{s.role}</td>
                <td className="px-3 py-2">{s.phone ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{s.duty_start && s.duty_end ? `${s.duty_start}–${s.duty_end}` : "—"}</td>
                <td className="px-3 py-2 text-right">PKR {Number(s.salary).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{Number(s.advance_balance) > 0 ? <span className="text-warning font-medium">PKR {Number(s.advance_balance).toLocaleString()}</span> : "—"}</td>
                <td className="px-3 py-2"><Badge className={s.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}>{s.status}</Badge></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" title="Profile" onClick={() => openProfile(s)}><User className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" title="Give Advance" onClick={() => { setAdvFor(s); setAdvOpen(true); }}><Wallet className="h-4 w-4 text-warning" /></Button>
                  <Button size="sm" variant="ghost" title="Pay Salary" onClick={() => { setPayFor(s); setPayOpen(true); }}><Banknote className="h-4 w-4 text-success" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(s)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Staff Member" : "Add New Staff Member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Personal Details Section */}
            <div className="border border-border/40 p-3 rounded-lg bg-secondary/10 space-y-3">
              <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Personal Information</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Full Name *</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Muhammad Ali" />
                </div>
                <div>
                  <Label>Father's Name</Label>
                  <Input value={form.father_name} onChange={(e) => setForm({ ...form, father_name: e.target.value })} placeholder="Father's Name" />
                </div>
                <div>
                  <Label>CNIC Number</Label>
                  <Input value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} placeholder="37405-1234567-1" />
                </div>
                <div>
                  <Label>Phone Number</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0300-1234567" />
                </div>
                <div>
                  <Label>Joining Date</Label>
                  <Input type="date" value={form.join_date} onChange={(e) => setForm({ ...form, join_date: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Residential Address</Label>
                  <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="House #, Street #, City" />
                </div>
              </div>
            </div>

            {/* Job & Duty Details Section */}
            <div className="border border-border/40 p-3 rounded-lg bg-secondary/10 space-y-3">
              <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Job & Shift Details</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Role *</Label>
                  <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Security Guard, Sweeper, Electrician..." />
                </div>
                <div>
                  <Label>Monthly Salary (PKR) *</Label>
                  <Input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })} placeholder="25000" />
                </div>
                <div>
                  <Label>Shift Start Time</Label>
                  <Input type="time" value={form.duty_start} onChange={(e) => setForm({ ...form, duty_start: e.target.value })} />
                </div>
                <div>
                  <Label>Shift End Time</Label>
                  <Input type="time" value={form.duty_end} onChange={(e) => setForm({ ...form, duty_end: e.target.value })} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_leave">On Leave</SelectItem>
                      <SelectItem value="terminated">Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Internal Notes</Label>
                  <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any special instruction or remarks" />
                </div>
              </div>
            </div>

            {/* Witness / Guarantor Details Section */}
            <div className="border border-border/40 p-3 rounded-lg bg-secondary/10 space-y-3">
              <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Guarantor / Witness Details</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Witness Full Name</Label>
                  <Input value={form.witness_name} onChange={(e) => setForm({ ...form, witness_name: e.target.value })} placeholder="Guarantor name" />
                </div>
                <div>
                  <Label>Witness CNIC</Label>
                  <Input value={form.witness_cnic} onChange={(e) => setForm({ ...form, witness_cnic: e.target.value })} placeholder="37405-9876543-1" />
                </div>
                <div>
                  <Label>Witness Phone</Label>
                  <Input value={form.witness_phone} onChange={(e) => setForm({ ...form, witness_phone: e.target.value })} placeholder="0333-1234567" />
                </div>
              </div>
            </div>

            {/* Media / Documents Section */}
            <div className="border border-border/40 p-3 rounded-lg bg-secondary/10 space-y-3">
              <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Documents Attachments (Max 20MB each)</h4>
              <div className="grid grid-cols-3 gap-3">
                {/* Photo */}
                <div className="flex flex-col items-center justify-center border border-border/50 rounded-lg p-2.5 bg-background relative min-h-[110px]">
                  <span className="text-[11px] font-medium text-muted-foreground mb-2">Photo</span>
                  {form.photo_url ? (
                    <div className="relative group">
                      <img src={form.photo_url} className="w-14 h-14 rounded-full object-cover border border-primary/30" alt="Preview" />
                      <button type="button" onClick={() => setForm({ ...form, photo_url: "" })} className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5 shadow hover:bg-destructive/80 transition">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="w-14 h-14 rounded-full border border-dashed border-border/80 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition bg-secondary/30">
                      {uploadingField === 'photo_url' ? (
                        <div className="flex flex-col items-center justify-center">
                          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="text-[8px] text-muted-foreground mt-0.5">Uploading</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground mt-0.5">Upload</span>
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden" disabled={uploadingField !== null} onChange={(e) => handleFileChange('photo_url', e.target.files)} />
                    </label>
                  )}
                </div>

                {/* ID Card Copy */}
                <div className="flex flex-col items-center justify-center border border-border/50 rounded-lg p-2.5 bg-background relative min-h-[110px]">
                  <span className="text-[11px] font-medium text-muted-foreground mb-2">CNIC Copy</span>
                  {form.id_card_url ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <File className="h-7 w-7 text-primary" />
                      <span className="text-[9px] text-muted-foreground font-semibold">Attached</span>
                      <div className="flex gap-1 mt-0.5">
                        <Button size="icon" variant="ghost" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => openDocument(form.id_card_url, "CNIC Copy")}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive hover:text-destructive/80" onClick={() => setForm({ ...form, id_card_url: "" })}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label className="w-14 h-14 border border-dashed border-border/80 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition bg-secondary/30">
                      {uploadingField === 'id_card_url' ? (
                        <div className="flex flex-col items-center justify-center">
                          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="text-[8px] text-muted-foreground mt-0.5">Uploading</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground mt-0.5">Upload</span>
                        </>
                      )}
                      <input type="file" accept="image/*,application/pdf" className="hidden" disabled={uploadingField !== null} onChange={(e) => handleFileChange('id_card_url', e.target.files)} />
                    </label>
                  )}
                </div>

                {/* Appointment Letter */}
                <div className="flex flex-col items-center justify-center border border-border/50 rounded-lg p-2.5 bg-background relative min-h-[110px]">
                  <span className="text-[11px] font-medium text-muted-foreground mb-2">Appt. Letter</span>
                  {form.appointment_letter_url ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <File className="h-7 w-7 text-primary" />
                      <span className="text-[9px] text-muted-foreground font-semibold">Attached</span>
                      <div className="flex gap-1 mt-0.5">
                        <Button size="icon" variant="ghost" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => openDocument(form.appointment_letter_url, "Appointment Letter")}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive hover:text-destructive/80" onClick={() => setForm({ ...form, appointment_letter_url: "" })}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label className="w-14 h-14 border border-dashed border-border/80 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition bg-secondary/30">
                      {uploadingField === 'appointment_letter_url' ? (
                        <div className="flex flex-col items-center justify-center">
                          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="text-[8px] text-muted-foreground mt-0.5">Uploading</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground mt-0.5">Upload</span>
                        </>
                      )}
                      <input type="file" accept="image/*,application/pdf" className="hidden" disabled={uploadingField !== null} onChange={(e) => handleFileChange('appointment_letter_url', e.target.files)} />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advance dialog */}
      <Dialog open={advOpen} onOpenChange={setAdvOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Give Advance Salary</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="text-sm">Employee: <span className="font-medium">{advFor?.full_name}</span></div>
            <div className="text-sm text-muted-foreground">Current advance balance: PKR {Number(advFor?.advance_balance ?? 0).toLocaleString()}</div>
            <div><Label>Date</Label><Input type="date" value={advDate} onChange={(e) => setAdvDate(e.target.value)} /></div>
            <div><Label>Advance Amount (PKR) *</Label><Input type="number" value={advAmt} onChange={(e) => setAdvAmt(e.target.value)} /></div>
            <div><Label>Notes</Label><Textarea rows={2} value={advNotes} onChange={(e) => setAdvNotes(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">This posts a Staff Advance expense and increases the outstanding balance. It will be auto-deducted on the next salary payment.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvOpen(false)}>Cancel</Button>
            <Button onClick={giveAdvance}>Pay Advance</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay salary dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Process Salary</DialogTitle></DialogHeader>
          {payFor && (
            <div className="grid gap-3 py-2 text-sm">
              <div className="bg-muted/40 p-3 rounded-lg border border-border/40 font-semibold flex justify-between">
                <div>Employee: <span className="font-bold text-amber-500">{payFor.full_name}</span></div>
                <div>Role: <span className="font-mono text-xs">{payFor.role}</span></div>
              </div>

              <div>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Salary Month / Year</Label>
                <Input 
                  type="month" 
                  value={payPeriod} 
                  onChange={(e) => setPayPeriod(e.target.value)} 
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Gross Salary (PKR)</Label>
                  <Input 
                    type="number" 
                    value={payGross} 
                    onChange={(e) => setPayGross(e.target.value)} 
                    className="mt-1 font-bold text-emerald-500"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Advance Deducted (PKR)</Label>
                  <Input 
                    type="number" 
                    value={payAdvance} 
                    onChange={(e) => setPayAdvance(e.target.value)} 
                    className="mt-1 font-bold text-red-500"
                  />
                </div>
              </div>

              <div className="bg-secondary/40 p-3 rounded border border-border/65 flex items-center justify-between">
                <div className="text-xs font-bold uppercase text-muted-foreground">Calculated Net Payout:</div>
                <div className="font-black text-emerald-400 text-xl">
                  PKR {Math.max(Number(payGross || 0) - Number(payAdvance || 0), 0).toLocaleString()}
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground italic">
                Posts a Salary expense in the accounting ledger, deducts the specified advance balance from staff record, and downloads a printable salary slip.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={paySalary}>Pay & Download Slip</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-950 border border-yellow-500/20 text-slate-100">
          <DialogHeader className="border-b border-border/40 pb-4">
            <DialogTitle className="text-xl font-bold text-yellow-500 flex items-center gap-2">
              <User className="h-5 w-5 text-yellow-500" /> Staff Profile
            </DialogTitle>
          </DialogHeader>
          
          {profileStaff && (
            <div className="space-y-6 pt-4">
              {/* Header card */}
              <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-border/30">
                {profileStaff.photo_url ? (
                  <img src={profileStaff.photo_url} className="w-24 h-24 rounded-full object-cover border-4 border-yellow-500/35 shadow-md cursor-pointer hover:scale-105 transition duration-300" alt={profileStaff.full_name} onClick={() => openDocument(profileStaff.photo_url!, "Employee Photo")} />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-yellow-500/10 text-yellow-500 font-bold border-4 border-yellow-500/20 flex items-center justify-center text-3xl shadow-md">
                    {(profileStaff.full_name || "??").slice(0, 2).toUpperCase()}
                  </div>
                )}
                
                <div className="text-center md:text-left space-y-1 flex-1">
                  <h3 className="text-2xl font-bold text-slate-50">{profileStaff.full_name}</h3>
                  <div className="text-sm text-yellow-500/80 font-medium">{profileStaff.role}</div>
                  <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-1">
                    <Badge className={profileStaff.status === "active" ? "bg-success/15 text-success border border-success/30" : "bg-muted text-muted-foreground border border-muted"}>
                      {profileStaff.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                    {Number(profileStaff.advance_balance) > 0 && (
                      <Badge className="bg-yellow-500/15 text-yellow-500 border border-yellow-500/35">
                        Advance: PKR {Number(profileStaff.advance_balance).toLocaleString()}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Document quick access */}
                <div className="flex flex-col gap-2 w-full md:w-auto">
                  {profileStaff.id_card_url && (
                    <Button variant="outline" size="sm" className="w-full md:w-auto border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400 text-xs" onClick={() => openDocument(profileStaff.id_card_url!, "CNIC ID Card Copy")}>
                      <FileText className="h-3.5 w-3.5 mr-1.5" /> CNIC Card
                    </Button>
                  )}
                  {profileStaff.appointment_letter_url && (
                    <Button variant="outline" size="sm" className="w-full md:w-auto border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400 text-xs" onClick={() => openDocument(profileStaff.appointment_letter_url!, "Appointment Letter")}>
                      <FileText className="h-3.5 w-3.5 mr-1.5" /> Appt. Letter
                    </Button>
                  )}
                </div>
              </div>

              {/* Information panels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Personal Information */}
                <div className="bg-slate-900/40 p-4 rounded-xl border border-border/20 space-y-3">
                  <h4 className="text-sm font-semibold text-yellow-500 border-b border-border/20 pb-1.5">Personal Details</h4>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-1 text-xs">
                    <div><span className="text-muted-foreground block">Father's Name</span><span className="font-medium text-slate-200">{profileStaff.father_name || "—"}</span></div>
                    <div><span className="text-muted-foreground block">CNIC Number</span><span className="font-medium text-slate-200">{profileStaff.cnic || "—"}</span></div>
                    <div><span className="text-muted-foreground block">Phone</span><span className="font-medium text-slate-200">{profileStaff.phone || "—"}</span></div>
                    <div><span className="text-muted-foreground block">Joining Date</span><span className="font-medium text-slate-200">{profileStaff.join_date || "—"}</span></div>
                    <div className="col-span-2"><span className="text-muted-foreground block">Address</span><span className="font-medium text-slate-200 whitespace-pre-line">{profileStaff.address || "—"}</span></div>
                  </div>
                </div>

                {/* Duty & Financials */}
                <div className="bg-slate-900/40 p-4 rounded-xl border border-border/20 space-y-3">
                  <h4 className="text-sm font-semibold text-yellow-500 border-b border-border/20 pb-1.5">Duty & Financials</h4>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-1 text-xs">
                    <div><span className="text-muted-foreground block">Monthly Salary</span><span className="font-semibold text-emerald-400 text-sm">PKR {Number(profileStaff.salary).toLocaleString()}</span></div>
                    <div><span className="text-muted-foreground block">Advance Balance</span><span className="font-medium text-yellow-500">PKR {Number(profileStaff.advance_balance).toLocaleString()}</span></div>
                    <div><span className="text-muted-foreground block">Duty Shift</span><span className="font-medium text-slate-200">{profileStaff.duty_start && profileStaff.duty_end ? `${profileStaff.duty_start} – ${profileStaff.duty_end}` : "—"}</span></div>
                    <div className="col-span-2 pt-1"><span className="text-muted-foreground block mb-0.5">Notes</span><span className="font-medium text-slate-300 italic whitespace-pre-line">{profileStaff.notes || "No special notes."}</span></div>
                  </div>
                </div>

                {/* Witness / Guarantor Info */}
                <div className="col-span-1 md:col-span-2 bg-slate-900/40 p-4 rounded-xl border border-border/20 space-y-3">
                  <h4 className="text-sm font-semibold text-yellow-500 border-b border-border/20 pb-1.5 flex items-center gap-1">
                    Guarantor / Witness Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div><span className="text-muted-foreground block">Witness Name</span><span className="font-medium text-slate-200">{profileStaff.witness_name || "—"}</span></div>
                    <div><span className="text-muted-foreground block">Witness CNIC</span><span className="font-medium text-slate-200">{profileStaff.witness_cnic || "—"}</span></div>
                    <div><span className="text-muted-foreground block">Witness Phone</span><span className="font-medium text-slate-200">{profileStaff.witness_phone || "—"}</span></div>
                  </div>
                </div>
              </div>

              {/* Salary History */}
              <div className="bg-slate-900/40 p-4 rounded-xl border border-border/20 space-y-3">
                <h4 className="text-sm font-semibold text-yellow-500 border-b border-border/20 pb-1.5">Salary History</h4>
                {payments.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">No salary payments processed yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-800 text-muted-foreground">
                        <tr>
                          <th className="text-left px-2 py-1.5 rounded-l">Period</th>
                          <th className="text-right px-2 py-1.5">Gross</th>
                          <th className="text-right px-2 py-1.5">Advance Deducted</th>
                          <th className="text-right px-2 py-1.5">Net Payout</th>
                          <th className="text-left px-2 py-1.5">Paid At</th>
                          <th className="px-2 rounded-r"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map(p => (
                          <tr key={p.id} className="border-b border-border/20 hover:bg-slate-800/40 transition">
                            <td className="px-2 py-2 font-medium">{format(new Date(p.period_month), "MMM yyyy")}</td>
                            <td className="px-2 py-2 text-right">PKR {Number(p.gross_salary).toLocaleString()}</td>
                            <td className="px-2 py-2 text-right text-yellow-500">PKR {Number(p.advance_deducted).toLocaleString()}</td>
                            <td className="px-2 py-2 text-right font-semibold text-emerald-400">PKR {Number(p.net_paid).toLocaleString()}</td>
                            <td className="px-2 py-2 text-muted-foreground">{format(new Date(p.paid_at), "dd MMM yyyy")}</td>
                            <td className="px-2 py-2 text-right">
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-yellow-500 hover:text-yellow-400" onClick={() => slipFor(profileStaff, p)} title="Download Salary Slip">
                                <FileText className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
