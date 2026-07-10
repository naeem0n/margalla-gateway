import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { KeyRound, RefreshCw, Plus, Pencil, Trash2, Upload, FileText, BookOpen, MessageCircle, Home, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch, getApiBase } from "@/lib/api-client";
import { requireUserWithRedirect } from "@/lib/requireUser";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { grantResidentAccess } from "@/lib/resident-gate";
import { downloadTenantsPDF } from "@/lib/pdf";
import { compressImage } from "@/lib/image-compress";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/tenants")({
  component: TenantsPage,
});

type Row = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  cnic: string | null;
  apartment_no: string | null;
  client_id: string | null;
  rent_amount: number;
  security_deposit: number;
  agreement_url: string | null;
  joining_date?: string | null;
  agreement_end_date?: string | null;
  daily_rent_rate?: number;
  apartment_type?: string | null;
  outstanding_balance?: number;
};

const apartmentCategories = [
  "Room",
  "Room Sharing",
  "Studio",
  "1 Bedroom",
  "2 Bedroom",
  "3 Bedroom (Small)",
  "3 Bedroom (Standard)",
  "Penthouse",
  "Parking"
];

type Doc = { id: string; title: string; doc_type: string | null; file_path: string; created_at: string };

const emptyForm = {
  full_name: "", phone: "", email: "", cnic: "", apartment_no: "",
  rent_amount: 0, security_deposit: 0,
  client_id: "", password: "",
  joining_date: "", agreement_end_date: "", daily_rent_rate: 0,
  apartment_type: "1 Bedroom",
  agreement_url: "",
};

// Day-Wise Extra Rent Calculation Core Engine
function calculateExtraDaysRent(tenantData: any, actualVacateDate: string) {
  if (!tenantData.agreement_end_date) {
    return { extraDays: 0, extraRentCharges: 0, message: "Agreement active / No extra days." };
  }
  const endDate = new Date(tenantData.agreement_end_date);
  const vacateDate = new Date(actualVacateDate); // Jis din woh chorr raha hai ya current date

  // Agar actual stay agreement date se zyada ho chuka hai
  if (vacateDate > endDate) {
    const timeDiff = vacateDate.getTime() - endDate.getTime();
    const extraDays = Math.ceil(timeDiff / (1000 * 3600 * 24)); // Total milliseconds to Days converter

    // Tenant ke profile se unique manual setting single day rate pick karein
    const dailyRate = tenantData.daily_rent_rate || (tenantData.monthly_rent / 30);
    const extraRentOwed = extraDays * dailyRate;

    return {
      extraDays: extraDays,
      extraRentCharges: Math.round(extraRentOwed),
      message: `Tenant stayed ${extraDays} extra days beyond agreement.`
    };
  }

  return { extraDays: 0, extraRentCharges: 0, message: "Agreement active / No extra days." };
}

function TenantsPage() {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [selectedCategory, setSelectedCategory] = useState("1 Bedroom");
  const [saving, setSaving] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [createdTenant, setCreatedTenant] = useState<any | null>(null);

  // WhatsApp Custom Sender Dialog State
  const [waDialogOpen, setWaDialogOpen] = useState(false);
  const [waRecipient, setWaRecipient] = useState<Row | null>(null);
  const [waSelectedTemplate, setWaSelectedTemplate] = useState<"credentials" | "arrears" | "custom">("arrears");
  const [waCustomText, setWaCustomText] = useState("");

  const getDraftedWhatsAppMessage = () => {
    if (!waRecipient) return "";
    if (waSelectedTemplate === "credentials") {
      let tenantPassword = "—";
      try {
        const keysJson = localStorage.getItem("margalla_access_keys");
        if (keysJson) {
          const keysList = JSON.parse(keysJson);
          const foundKey = keysList.find((k: any) => k.userId.toUpperCase() === waRecipient.client_id?.toUpperCase());
          if (foundKey) {
            tenantPassword = foundKey.passwordText;
          }
        }
      } catch (e) {
        console.error("Failed to parse access keys from localStorage", e);
      }
      return `Assalam o Alaikum ${waRecipient.full_name}, Margalla Gateway Resident Portal access credentials. Client ID: ${waRecipient.client_id} Password: ${tenantPassword} Thank you.`;
    }
    if (waSelectedTemplate === "arrears") {
      const balance = waRecipient.outstanding_balance || 0;
      return `Assalam o Alaikum ${waRecipient.full_name}, Margalla Gateway se aap ki rent outstanding balance ki yaad dahani hai. Outstanding Balance: PKR ${Number(balance).toLocaleString()}. Kindly pay at your earliest convenience to avoid services interruption. Shukria.`;
    }
    return waCustomText;
  };

  const handleSendWhatsApp = () => {
    if (!waRecipient) return;
    const msg = getDraftedWhatsAppMessage();
    let rawPhone = (waRecipient.phone || "").trim().replace(/[^0-9]/g, '');
    while (rawPhone.startsWith('0')) {
      rawPhone = rawPhone.substring(1);
    }
    const cleanPhoneNumber = rawPhone.startsWith('92') ? rawPhone : `92${rawPhone}`;
    const encodedMessage = encodeURIComponent(msg);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhoneNumber}&text=${encodedMessage}`;

    if ((window as any).require) {
      const { shell } = (window as any).require('electron');
      shell.openExternal(whatsappUrl);
    } else {
      window.open(whatsappUrl, '_blank');
    }
    setWaDialogOpen(false);
  };

  // =========================================================================
  // 🟢 WHATSAPP DYNAMIC NOTIFICATION DISPATCHER
  // =========================================================================
  const dispatchWhatsAppNotification = (tenant: any) => {
    // 1. Clean phone formatting for Pakistan context
    let rawPhone = tenant.phone.trim().replace(/[^0-9]/g, '');
    while (rawPhone.startsWith('0')) {
      rawPhone = rawPhone.substring(1);
    }
    const cleanPhoneNumber = rawPhone.startsWith('92') ? rawPhone : `92${rawPhone}`;

    // 2. Draft dynamic encoded layout string
    const tenantName = tenant.name;
    const clientId = tenant.clientId;
    const generatedPassword = tenant.password;
    const messageText = `Assalam o Alaikum ${tenantName}, Margalla Gateway Portal access has been created for you. Client ID: ${clientId} Password: ${generatedPassword} Thank you.`;
    const encodedMessage = encodeURIComponent(messageText);

    // 3. Generate secure external link
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhoneNumber}&text=${encodedMessage}`;

    // 4. Electron safe shell open to bypass sandbox blocks
    if ((window as any).require) {
      const { shell } = (window as any).require('electron');
      shell.openExternal(whatsappUrl);
    } else {
      window.open(whatsappUrl, '_blank');
    }
  };

  // =========================================================================
  // 🟢 INTERNAL CRM NOTES STATE & HANDLERS
  // =========================================================================
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesFor, setNotesFor] = useState<Row | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteIsWarning, setNewNoteIsWarning] = useState(false);
  const [addingNote, setAddingNote] = useState(false);

  const loadNotes = async (tenantId: string) => {
    setNotesLoading(true);
    try {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("entity_id", tenantId)
        .eq("entity_type", "tenant")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setNotes(data ?? []);
    } catch (err: any) {
      console.error("Load notes failed:", err);
      toast.error("Could not load internal notes");
    } finally {
      setNotesLoading(false);
    }
  };

  const openNotes = (tenant: Row) => {
    setNotesFor(tenant);
    setNotes([]);
    setNewNoteContent("");
    setNewNoteIsWarning(false);
    setNotesOpen(true);
    loadNotes(tenant.id);
  };

  const handleAddNote = async () => {
    if (!newNoteContent.trim() || !notesFor) return;
    setAddingNote(true);
    try {
      const nowStr = new Date().toISOString();
      const payload = {
        entity_type: "tenant",
        entity_id: notesFor.id,
        note_date: nowStr.split("T")[0],
        note_time: nowStr.split("T")[1].substring(0, 5),
        author_id: "admin",
        content: newNoteContent.trim(),
        is_warning: newNoteIsWarning ? 1 : 0,
        created_at: nowStr,
        updated_at: nowStr,
      };

      const { error } = await supabase.from("notes").insert(payload);
      if (error) throw error;
      
      toast.success("Internal note added");
      setNewNoteContent("");
      setNewNoteIsWarning(false);
      loadNotes(notesFor.id);
    } catch (err: any) {
      console.error("Add note failed:", err);
      toast.error("Could not add internal note");
    } finally {
      setAddingNote(false);
    }
  };

  const handleRemoveNote = async (noteId: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;
    try {
      const { error } = await supabase.from("notes").delete().eq("id", noteId);
      if (error) throw error;
      toast.success("Internal note deleted");
      if (notesFor) loadNotes(notesFor.id);
    } catch (err: any) {
      console.error("Delete note failed:", err);
      toast.error("Could not delete note");
    }
  };

  const [docsOpen, setDocsOpen] = useState(false);
  const [docsFor, setDocsFor] = useState<Row | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const localUsers = await apiFetch<{ users: any[] }>("/users");
      const mapped = (localUsers.users ?? []).map(u => ({
        id: u.id,
        full_name: u.full_name,
        phone: u.phone,
        email: u.email,
        cnic: u.cnic,
        apartment_no: u.apartment_no,
        client_id: u.client_id,
        rent_amount: Number(u.rent_amount) || 0,
        security_deposit: Number(u.security_deposit) || 0,
        agreement_url: u.agreement_url || null,
        joining_date: u.joining_date || null,
        agreement_end_date: u.agreement_end_date || null,
        daily_rent_rate: Number(u.daily_rent_rate) || 0,
        apartment_type: u.apartment_type || null,
        outstanding_balance: Number(u.outstanding_balance) || 0,
      }));
      setRows(mapped);
    } catch (err) {
      console.error("Local load failed:", err);
      toast.error("Could not load tenants locally");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setSelectedCategory("1 Bedroom");
    setGeneratedPassword("");
    setCreatedTenant(null);
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({
      full_name: r.full_name ?? "", phone: r.phone ?? "", email: r.email ?? "",
      cnic: r.cnic ?? "", apartment_no: r.apartment_no ?? "",
      rent_amount: Number(r.rent_amount) || 0,
      security_deposit: Number(r.security_deposit) || 0,
      client_id: r.client_id ?? "",
      password: "",
      agreement_url: r.agreement_url || "",
      joining_date: r.joining_date ?? "",
      agreement_end_date: r.agreement_end_date ?? "",
      daily_rent_rate: Number(r.daily_rent_rate) || 0,
      apartment_type: r.apartment_type ?? "1 Bedroom",
    });
    setSelectedCategory(r.apartment_type ?? "1 Bedroom");
    setGeneratedPassword("");
    setCreatedTenant(null);
    setOpen(true);
  };

  const handleGeneratePassword = () => {
    if (!form.full_name) {
      toast.error("Please enter a Full Name first");
      return;
    }
    
    const tenantName = form.full_name;
    const plainTextPassword = `${tenantName.trim().toLowerCase().split(' ')[0]}@123`;
    setGeneratedPassword(plainTextPassword);
    setForm(f => ({ ...f, password: plainTextPassword }));
  };

  const save = async () => {
    // 0. Frontend validations
    if (!form.full_name || !form.full_name.trim()) {
      toast.error("Full Name is required");
      return;
    }
    if (!form.phone || !form.phone.trim()) {
      toast.error("Phone number is required");
      return;
    }
    if (form.cnic && form.cnic.trim()) {
      const cleanCnic = form.cnic.replace(/[\s\-]/g, "");
      if (cleanCnic.length !== 13) {
        toast.error("CNIC must be exactly 13 digits");
        return;
      }
    }

    setSaving(true);
    try {
      const userId = await requireUserWithRedirect();
      if (!userId) { setSaving(false); return; }
      if (!isAdmin) { toast.error("Admin access required"); setSaving(false); return; }

      // 1. Phone duplicate check
      const targetPhone = form.phone.trim();
      if (targetPhone) {
        const cleanTarget = targetPhone.replace(/\D/g, "");
        const duplicate = rows.find(p => {
          if (!p.phone) return false;
          if (editing && p.id === editing.id) return false;
          return p.phone.replace(/\D/g, "") === cleanTarget;
        });
        if (duplicate) {
          toast.error(`A tenant portal already exists for this phone number: ${duplicate.full_name} (${duplicate.phone})`);
          setSaving(false);
          return;
        }
      }

      // 2. Validate/Use client_id
      let finalClientId = form.client_id.trim();
      if (!finalClientId) {
        const cleanPhone = form.phone.replace(/\D/g, "");
        const last4 = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : Math.floor(1000 + Math.random() * 9000).toString();
        const baseClientId = `RES-${last4}`.toUpperCase();
        finalClientId = baseClientId;
        let exists = true;
        let counter = 1;
        while (exists) {
          const duplicate = rows.find(p => p.client_id?.toUpperCase() === finalClientId?.toUpperCase());
          if (!duplicate) {
            exists = false;
          } else {
            counter++;
            finalClientId = `${baseClientId}-${counter}`;
          }
        }
      } else {
        const duplicate = rows.find(p => p.client_id?.toUpperCase() === finalClientId.toUpperCase() && (!editing || p.id !== editing.id));
        if (duplicate) {
          toast.error(`Client ID ${finalClientId} already exists`);
          setSaving(false);
          return;
        }
      }
 
      const getUuidFromClientId = (clientId: string) => {
        const clean = clientId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        return `00000000-0000-0000-0000-${clean.padEnd(12, "0").slice(0, 12)}`;
      };
 
      let finalPassword = form.password.trim();
      if (!finalPassword) {
        if (!editing) {
          if (generatedPassword) {
            finalPassword = generatedPassword;
          } else {
            const tenantName = form.full_name;
            finalPassword = `${tenantName.trim().toLowerCase().split(' ')[0]}@123`;
          }
        }
      }

      // Log generated credentials in local development console
      console.log("SUCCESSFULLY GENERATED ACCOUNT:", { 
        username: form.email || finalClientId || form.full_name, 
        password: finalPassword 
      });
 
      const profileId = editing ? editing.id : getUuidFromClientId(finalClientId);
 
      // Create or update local SQLite user account (which will auto-sync)
      await apiFetch("/users/create-tenant", {
        method: "POST",
        body: JSON.stringify({
          id: profileId,
          full_name: form.full_name,
          email: form.email || `${finalClientId.toLowerCase()}@margalla.local`,
          phone: form.phone,
          apartment_no: form.apartment_no,
          client_id: finalClientId,
          password: finalPassword || undefined,
          cnic: form.cnic,
          rent_amount: form.rent_amount,
          security_deposit: form.security_deposit,
          agreement_url: editing?.agreement_url || null,
          joining_date: form.joining_date || null,
          agreement_end_date: form.agreement_end_date || null,
          daily_rent_rate: Number(form.daily_rent_rate) || 0,
          apartment_type: selectedCategory,
        }),
      });

      // ============================================================
      // AUTO PAST MONTHS LEDGER - har mahine ki entry auto-create
      // ============================================================
      if (!editing && form.joining_date && form.rent_amount > 0) {
        try {
          const jDate = new Date(form.joining_date);
          const now = new Date();
          const totalM = (now.getFullYear() - jDate.getFullYear()) * 12 + (now.getMonth() - jDate.getMonth());
          if (totalM > 0) {
            toast.loading(`${totalM} mahine ki entries ban rahi hain...`, { id: "past-ent" });
            const mNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
            for (let i = 0; i < totalM; i++) {
              const d = new Date(jDate.getFullYear(), jDate.getMonth() + i, 1);
              await apiFetch("/ledger", { method: "POST", body: JSON.stringify({
                user_id: profileId,
                entry_date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`,
                entry_type: "rent",
                description: `Monthly Rent � ${mNames[d.getMonth()]} ${d.getFullYear()} (${form.apartment_no || "Unit"})`,
                debit: form.rent_amount, credit: 0,
              })});
            }
            toast.dismiss("past-ent");
            toast.success(`? ${totalM} mahine ki rent entries ledger mein daal di gayin!`, { duration: 7000 });
          }
        } catch(e2) { toast.warning("Past entries manually Central Console se dalein."); }
      }
 
      if (editing) {
        toast.success("Tenant updated successfully");
        setOpen(false);
      } else {
        toast.success(`Tenant added! Client ID: ${finalClientId}, Password: ${finalPassword}`, {
          duration: 10000,
        });
        setCreatedTenant({
          name: form.full_name,
          clientId: finalClientId,
          password: finalPassword,
          phone: form.phone
        });
      }
      await load();
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
    finally { setSaving(false); }
  };

  const remove = async (r: Row) => {
    if (!confirm(`Delete tenant ${r.full_name}? This cannot be undone.`)) return;
    try {
      const userId = await requireUserWithRedirect();
      if (!userId) return;
      if (!isAdmin) { toast.error("Admin access required"); return; }
      await apiFetch(`/users/${r.id}`, {
        method: "DELETE",
      });
      toast.success("Deleted");
      await load();
    } catch (e: any) {
      console.error("Delete tenant failed:", e);
      toast.error("Could not delete tenant — try again");
    }
  };

  const uploadAgreement = async (r: Row, file: File) => {
    try {
      const userId = await requireUserWithRedirect();
      if (!userId) return;
      if (!isAdmin) { toast.error("Admin access required"); return; }
      if (file.size > 2 * 1024 * 1024) throw new Error("File too large (max 2MB for local storage)");
      
      const reader = new FileReader();
      const promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const dataUrl = await promise;

      await apiFetch(`/users/create-tenant`, {
        method: "POST",
        body: JSON.stringify({
          id: r.id,
          full_name: r.full_name,
          email: r.email,
          phone: r.phone,
          apartment_no: r.apartment_no,
          client_id: r.client_id,
          agreement_url: dataUrl
        })
      });

      toast.success("Agreement uploaded locally");
      await load();
    } catch (e: any) { toast.error(e.message ?? "Upload failed"); }
  };

  const downloadAgreement = async (r: Row) => {
    if (!r.agreement_url) return;
    if (r.agreement_url.startsWith("data:")) {
      const a = document.createElement("a");
      a.href = r.agreement_url;
      a.download = `agreement-${r.full_name || "tenant"}.pdf`;
      a.click();
      return;
    }
    
    // Support local uploads
    if (r.agreement_url.includes("/uploads/") || r.agreement_url.includes("uploads/")) {
      window.open(r.agreement_url, "_blank");
      return;
    }

    const userId = await requireUserWithRedirect();
    if (!userId) return;
    if (!isAdmin) { toast.error("Admin access required"); return; }
    
    // Dynamic import to avoid static Supabase dependency
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(r.agreement_url, 300);
    if (error || !data) { toast.error(error?.message ?? "Failed"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const openDocs = async (r: Row) => {
    const userId = await requireUserWithRedirect();
    if (!userId) return;
    if (!isAdmin) { toast.error("Admin access required"); return; }
    setDocsFor(r);
    setDocsOpen(true);
    
    try {
      const res = await apiFetch<{ documents: Doc[] }>(`/documents?owner_type=tenant&owner_id=${r.id}`);
      setDocs(res.documents ?? []);
    } catch (e: any) {
      console.error("Failed to load documents:", e);
      toast.error("Could not load documents");
    }
  };

  const uploadDoc = async (file: File, docType: string) => {
    if (!docsFor) return;
    setUploading(true);
    const toastId = `upload-${Date.now()}`;
    toast.loading("Preparing file upload...", { id: toastId });

    try {
      const userId = await requireUserWithRedirect();
      if (!userId) {
        toast.dismiss(toastId);
        return;
      }
      if (!isAdmin) {
        toast.error("Admin access required", { id: toastId });
        return;
      }
      if (file.size > 20 * 1024 * 1024) throw new Error("File too large (max 20MB)");
      
      let uploadFile = file;
      if (file.type.startsWith("image/")) {
        toast.loading("Compressing image...", { id: toastId });
        uploadFile = await compressImage(file, 1600, 1600, 0.75);
      }

      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("title", uploadFile.name);
      fd.append("owner_type", "tenant");
      fd.append("owner_id", docsFor.id);
      fd.append("doc_type", docType);

      const token = localStorage.getItem("mgt_api_token");
      
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${getApiBase()}/documents`, true);
        if (token) {
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        }

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            toast.loading(`Uploading: ${percent}%...`, { id: toastId });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            toast.success("Document uploaded successfully!", { id: toastId });
            resolve();
          } else {
            reject(new Error(xhr.statusText || "Upload failed"));
          }
        };

        xhr.onerror = () => {
          reject(new Error("Network error during upload"));
        };

        xhr.send(fd);
      });

      await openDocs(docsFor);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed", { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const downloadDoc = async (d: Doc) => {
    const userId = await requireUserWithRedirect();
    if (!userId) return;
    if (!isAdmin) { toast.error("Admin access required"); return; }
    
    try {
      const token = localStorage.getItem("mgt_api_token");
      const response = await fetch(`${getApiBase()}/documents/${d.id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = d.title;
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (e: any) {
      toast.error(e.message || "Failed to download file");
    }
  };

  const removeDoc = async (d: Doc) => {
    if (!confirm("Delete this document?")) return;
    const userId = await requireUserWithRedirect();
    if (!userId) return;
    if (!isAdmin) { toast.error("Admin access required"); return; }
    
    try {
      await apiFetch(`/documents/${d.id}`, { method: "DELETE" });
      toast.success("Document deleted");
      if (docsFor) await openDocs(docsFor);
    } catch (e: any) {
      toast.error(e.message || "Failed to delete document");
    }
  };

  const impersonateResident = async (residentId: string) => {
    try {
      const res = await apiFetch<{ token: string; user: any }>("/auth/impersonate", {
        method: "POST",
        body: JSON.stringify({ user_id: residentId })
      });
      const adminToken = localStorage.getItem("mgt_api_token");
      if (adminToken) {
        localStorage.setItem("mgt_admin_token", adminToken);
      }
      localStorage.setItem("mgt_api_token", res.token);
      localStorage.setItem("mgt_impersonating", "true");
      localStorage.setItem("mgt_impersonate_target", "resident");
      grantResidentAccess();
      toast.success("Opening resident portal...");
      setTimeout(() => {
        window.location.href = "#/";
      }, 500);
    } catch (e: any) {
      toast.error(e.message || "Failed to open resident portal");
    }
  };

  return (
    <AdminLayout title={t("tenantsTitle")}>
      <div className="flex justify-between items-center mb-4 gap-2 flex-wrap">
        <p className="text-muted-foreground text-sm">{rows.length} {t("registeredAccounts")}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => downloadTenantsPDF(rows)} className="flex items-center gap-1"><Printer className="h-4 w-4" />Print PDF</Button>
          <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />{t("refresh")}</Button>
          <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) setCreatedTenant(null); }}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Tenant</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              {createdTenant ? (
                <div className="space-y-6 py-4 text-center">
                  <DialogHeader>
                    <DialogTitle className="text-center text-emerald-400 font-bold flex flex-col items-center gap-2">
                      <span className="text-3xl">🟢</span>
                      Share Credentials via WhatsApp
                    </DialogTitle>
                  </DialogHeader>
                  
                  <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-3 max-w-sm mx-auto text-left">
                    <div>
                      <span className="text-xs text-zinc-400 block font-semibold uppercase">Full Name</span>
                      <span className="text-sm text-white font-bold">{createdTenant.name}</span>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-400 block font-semibold uppercase">Client ID</span>
                      <span className="text-sm text-yellow-400 font-mono font-bold">{createdTenant.clientId}</span>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-400 block font-semibold uppercase">Password</span>
                      <span className="text-sm text-yellow-400 font-mono font-bold">{createdTenant.password}</span>
                    </div>
                    {createdTenant.phone && (
                      <div>
                        <span className="text-xs text-zinc-400 block font-semibold uppercase">Phone</span>
                        <span className="text-sm text-white font-semibold">{createdTenant.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 max-w-sm mx-auto">
                    {createdTenant.phone && (
                      <Button
                        onClick={() => dispatchWhatsAppNotification(createdTenant)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow-emerald cursor-pointer"
                      >
                        🟢 Share Credentials via WhatsApp
                      </Button>
                    )}
                    
                    <Button 
                      variant="outline" 
                      onClick={() => { setOpen(false); setCreatedTenant(null); }}
                      className="w-full h-11 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Done / Close
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <DialogHeader><DialogTitle>{editing ? "Edit Tenant" : "Add Tenant"}</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3 py-2">
                    <div className="col-span-2"><Label>Full Name *</Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
                    <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                    <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                    <div><Label>CNIC</Label><Input value={form.cnic} onChange={e => setForm(f => ({ ...f, cnic: e.target.value }))} placeholder="00000-0000000-0" /></div>
                    <div><Label>Apartment No</Label><Input value={form.apartment_no} onChange={e => setForm(f => ({ ...f, apartment_no: e.target.value }))} placeholder="A-101" /></div>
                    {/* Apartment Type Dropdown Menu Selection Block */}
                    <div className="flex flex-col gap-2 mb-4">
                      <label className="text-sm font-semibold text-gray-300">Apartment Type / Category *</label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 focus:outline-none focus:border-yellow-500 text-sm"
                      >
                        {apartmentCategories.map((cat, idx) => (
                          <option key={idx} value={cat} className="bg-slate-900 text-white">
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Monthly Rent (PKR)</Label>
                      <Input 
                        type="number" 
                        value={form.rent_amount} 
                        onChange={e => {
                          const rentVal = Number(e.target.value);
                          setForm(f => ({ 
                            ...f, 
                            rent_amount: rentVal, 
                            daily_rent_rate: Math.round(rentVal / 30) 
                          }));
                        }} 
                      />
                    </div>
                    <div><Label>Security Deposit (PKR)</Label><Input type="number" value={form.security_deposit} onChange={e => setForm(f => ({ ...f, security_deposit: Number(e.target.value) }))} /></div>
                    <div><Label>Joining Date</Label><Input type="date" value={form.joining_date} onChange={e => setForm(f => ({ ...f, joining_date: e.target.value }))} /></div>
                    <div><Label>Agreement End Date</Label><Input type="date" value={form.agreement_end_date} onChange={e => setForm(f => ({ ...f, agreement_end_date: e.target.value }))} /></div>
                    <div><Label>Daily Rent Rate (PKR)</Label><Input type="number" value={form.daily_rent_rate} onChange={e => setForm(f => ({ ...f, daily_rent_rate: Number(e.target.value) }))} /></div>
                    <div><Label>Client ID (Leave blank to auto-generate)</Label><Input value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} placeholder="RES-101" /></div>
                    <div><Label>{editing ? "New Password (Leave blank to keep current)" : "Password (Leave blank to auto-generate)"}</Label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" /></div>
                    
                    <div className="col-span-2 pt-2">
                      <Button 
                        type="button" 
                        onClick={handleGeneratePassword}
                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-bold py-2 rounded transition border border-zinc-700 text-xs tracking-wider uppercase"
                      >
                        Generate Plain-Text Password
                      </Button>
                    </div>

                    {generatedPassword && (
                      <div className="col-span-2 p-3 bg-black border border-amber-500/30 rounded text-center">
                        <span className="text-xs text-zinc-400 block">Generated Password (Raw Text):</span>
                        <code className="text-sm font-mono font-bold text-yellow-400">{generatedPassword}</code>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={save} disabled={saving}>{saving ? "Saving..." : (editing ? "Update" : "Add")}</Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-card border border-border/60 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">{t("name")}</th>
              <th className="px-4 py-3 text-left">{t("apartment")}</th>
              <th className="px-4 py-3 text-left">{t("phone")}</th>
              <th className="px-4 py-3 text-left">Rent</th>
              <th className="px-4 py-3 text-left">Security</th>
              <th className="px-4 py-3 text-left">{t("clientId")}</th>
              <th className="px-4 py-3 text-left">Agreement</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">{t("loading")}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">{t("noAccounts")}</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="border-t border-border/40">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.full_name || "—"}</div>
                  {r.agreement_end_date && (() => {
                    const extra = calculateExtraDaysRent({
                      agreement_end_date: r.agreement_end_date,
                      daily_rent_rate: r.daily_rent_rate,
                      monthly_rent: r.rent_amount
                    }, new Date().toISOString().split("T")[0]);
                    if (extra.extraDays > 0) {
                      return (
                        <div className="text-[10px] text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded inline-block font-semibold mt-1 border border-red-500/20">
                          Overstay: {extra.extraDays} days (Owed: PKR {extra.extraRentCharges.toLocaleString()})
                        </div>
                      );
                    }
                    return null;
                  })()}
                </td>
                <td className="px-4 py-3">
                  <div>{r.apartment_no || "—"}</div>
                  {r.apartment_type && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">{r.apartment_type}</div>
                  )}
                </td>
                <td className="px-4 py-3">{r.phone || "—"}</td>
                <td className="px-4 py-3">PKR {Number(r.rent_amount).toLocaleString()}</td>
                <td className="px-4 py-3">PKR {Number(r.security_deposit).toLocaleString()}</td>
                <td className="px-4 py-3">{r.client_id ? <span className="font-mono text-primary text-xs">{r.client_id}</span> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3">
                  {r.agreement_url ? (
                    <Button size="sm" variant="outline" onClick={() => downloadAgreement(r)}><FileText className="h-3 w-3 mr-1" />View</Button>
                  ) : (
                    <label className="inline-flex items-center gap-1 text-xs cursor-pointer text-primary hover:underline">
                      <Upload className="h-3 w-3" /> Upload
                      <input type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadAgreement(r, e.target.files[0])} />
                    </label>
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {r.phone && (
                    <Button size="sm" variant="outline" className="mr-1" title="WhatsApp Message Dispatcher" onClick={() => {
                      setWaRecipient(r);
                      setWaSelectedTemplate("arrears");
                      setWaDialogOpen(true);
                    }}><MessageCircle className="h-3 w-3 text-green-600" /></Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openNotes(r)} className="mr-1" title="Internal Notes"><BookOpen className="h-3 w-3 text-amber-500" /></Button>
                  <Button size="sm" variant="outline" onClick={() => impersonateResident(r.id)} className="mr-1" title="Open Residence Portal"><Home className="h-3 w-3 text-primary" /></Button>
                  <Button size="sm" variant="outline" onClick={() => openDocs(r)} className="mr-1" title="Documents"><FileText className="h-3 w-3" /></Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(r)} className="mr-1"><Pencil className="h-3 w-3" /></Button>
                  <Button size="sm" variant="outline" onClick={() => remove(r)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Documents dialog */}
      <Dialog open={docsOpen} onOpenChange={setDocsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Documents — {docsFor?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {["CNIC", "Agreement", "Report", "Receipt", "Other"].map(typ => (
                <label key={typ} className="cursor-pointer inline-flex items-center gap-1 text-xs px-3 py-2 bg-muted hover:bg-muted/70 rounded">
                  <Upload className="h-3 w-3" /> {typ}
                  <input type="file" className="hidden" disabled={uploading} onChange={e => e.target.files?.[0] && uploadDoc(e.target.files[0], typ.toLowerCase())} />
                </label>
              ))}
            </div>
            <div className="border rounded divide-y max-h-72 overflow-y-auto">
              {docs.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">No documents yet</p>
              ) : docs.map(d => (
                <div key={d.id} className="flex items-center justify-between p-2 text-sm">
                  <div>
                    <div className="font-medium">{d.title}</div>
                    <div className="text-xs text-muted-foreground">{d.doc_type} · {new Date(d.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => downloadDoc(d)}>View</Button>
                    <Button size="sm" variant="outline" onClick={() => removeDoc(d)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="max-w-xl bg-slate-950 border border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-yellow-500 flex items-center gap-2 font-bold">
              <BookOpen className="h-5 w-5" />
              Internal CRM Notes — {notesFor?.full_name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Notes List */}
            <div className="border border-slate-800 rounded-xl bg-slate-900/50 p-2 divide-y divide-slate-800 max-h-72 overflow-y-auto">
              {notesLoading ? (
                <p className="p-4 text-center text-sm text-zinc-400">Loading notes...</p>
              ) : notes.length === 0 ? (
                <p className="p-4 text-center text-sm text-zinc-400 font-semibold text-zinc-500">No internal notes for this resident.</p>
              ) : (
                notes.map((n) => (
                  <div key={n.id} className="p-3 space-y-1">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-400">
                          {n.note_date} {n.note_time}
                        </span>
                        {n.is_warning === 1 && (
                          <span className="text-[10px] bg-red-950/60 text-red-400 border border-red-900/60 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                            Warning Note
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 hover:bg-red-950/30 text-zinc-500 hover:text-red-400 cursor-pointer"
                        onClick={() => handleRemoveNote(n.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                      {n.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Add Note Form */}
            <div className="space-y-3 border-t border-slate-800 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="noteContent" className="text-zinc-300">Add Internal Note</Label>
                <Textarea
                  id="noteContent"
                  rows={3}
                  placeholder="Type internal remarks, warnings, or staff notes here..."
                  className="bg-slate-900 border-slate-700 text-white placeholder-zinc-500 focus:border-yellow-500 focus:ring-yellow-500"
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-yellow-500 rounded border-slate-700 bg-slate-900"
                    checked={newNoteIsWarning}
                    onChange={(e) => setNewNoteIsWarning(e.target.checked)}
                  />
                  Mark as Warning Note / Alert
                </label>
                <Button
                  onClick={handleAddNote}
                  disabled={addingNote || !newNoteContent.trim()}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold cursor-pointer"
                >
                  {addingNote ? "Adding..." : "Add Note"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Dispatcher Dialog */}
      <Dialog open={waDialogOpen} onOpenChange={setWaDialogOpen}>
        <DialogContent className="max-w-md bg-slate-950 border border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-emerald-400 flex items-center gap-2 font-bold text-lg">
              <span className="text-xl">🟢</span>
              WhatsApp Message Dispatcher
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <span className="text-xs text-zinc-400 block font-semibold uppercase">Recipient</span>
              <span className="text-sm font-bold">{waRecipient?.full_name} ({waRecipient?.phone})</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase block">Select Message Template</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setWaSelectedTemplate("arrears")}
                  className={`p-2.5 rounded-lg border text-xs font-bold transition-all text-center cursor-pointer ${
                    waSelectedTemplate === "arrears"
                      ? "bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-md"
                      : "bg-slate-900 border-slate-800 text-zinc-400 hover:border-slate-700"
                  }`}
                >
                  Arrears Reminder
                </button>
                <button
                  type="button"
                  onClick={() => setWaSelectedTemplate("credentials")}
                  className={`p-2.5 rounded-lg border text-xs font-bold transition-all text-center cursor-pointer ${
                    waSelectedTemplate === "credentials"
                      ? "bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-md"
                      : "bg-slate-900 border-slate-800 text-zinc-400 hover:border-slate-700"
                  }`}
                >
                  Portal Credentials
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWaSelectedTemplate("custom");
                    if (!waCustomText) {
                      setWaCustomText(`Assalam o Alaikum ${waRecipient?.full_name}, `);
                    }
                  }}
                  className={`p-2.5 rounded-lg border text-xs font-bold transition-all text-center cursor-pointer ${
                    waSelectedTemplate === "custom"
                      ? "bg-emerald-600/20 border-emerald-500 text-emerald-400 shadow-md"
                      : "bg-slate-900 border-slate-800 text-zinc-400 hover:border-slate-700"
                  }`}
                >
                  Custom Note
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase block">Message Preview</label>
              {waSelectedTemplate === "custom" ? (
                <Textarea
                  rows={4}
                  className="bg-slate-900 border-slate-700 text-white text-xs leading-relaxed focus:border-emerald-500 focus:ring-emerald-500"
                  value={waCustomText}
                  onChange={(e) => setWaCustomText(e.target.value)}
                />
              ) : (
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg text-xs leading-relaxed font-mono text-zinc-300 max-h-36 overflow-y-auto whitespace-pre-wrap select-all">
                  {getDraftedWhatsAppMessage()}
                </div>
              )}
            </div>

            {waSelectedTemplate === "credentials" && (
              <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[11px] rounded-lg">
                ⚠️ Make sure the Access Key for Client ID <strong>{waRecipient?.client_id}</strong> is active in the Access Control Credentials tab to look up its password text correctly.
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setWaDialogOpen(false)}
              className="flex-1 cursor-pointer border-slate-800 hover:bg-slate-900 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendWhatsApp}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer text-xs"
            >
              Send via WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
