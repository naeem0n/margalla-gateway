import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Upload, Download, Trash2, FileText, Plus, Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { requireUserWithRedirect } from "@/lib/requireUser";
import { toast } from "sonner";
import { format } from "date-fns";
import { apiFetch, isDesktopApp, getApiBase } from "@/lib/api-client";
import { compressImage } from "@/lib/image-compress";

type Tenant = { id: string; full_name: string | null; apartment_no: string | null };
type Doc = {
  id: string; title: string; doc_type: string | null; file_path: string;
  file_size: number | null; mime_type: string | null; created_at: string;
  owner_type: string; owner_id: string | null;
};

const DOC_TYPES = ["Photo", "CNIC Copy", "Appointment Letter", "Agreement", "CNIC", "Receipt", "Report", "Notice", "Other"];

export const Route = createFileRoute("/admin/documents")({ component: Page });

function Page() {
  const { isAdmin } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "", doc_type: "Agreement", owner_id: "", file: null as File | null,
  });
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!form.file) {
      setFilePreview(null);
      return;
    }
    if (form.file.type.startsWith("image/")) {
      const url = URL.createObjectURL(form.file);
      setFilePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setFilePreview("pdf");
    }
  }, [form.file]);

  const load = async () => {
    setLoading(true);
    try {
      // 1. Fetch tenants/residents
      let tenantsList: Tenant[] = [];
      try {
        const res = await apiFetch<{ users: any[] }>("/users");
        if (res && res.users) {
          tenantsList = res.users
            .filter((u: any) => u.role === "resident")
            .map((u: any) => ({ id: u.id, full_name: u.full_name, apartment_no: u.apartment_no }));
        }
      } catch (err) {
        console.warn("Failed to load local users, falling back to Supabase:", err);
        const { data } = await supabase.from("profiles").select("id,full_name,apartment_no").order("apartment_no");
        tenantsList = (data ?? []) as Tenant[];
      }
      setTenants(tenantsList);

      // 2. Fetch documents
      let docsList: Doc[] = [];
      try {
        const res = await apiFetch<{ documents: any[] }>("/documents");
        if (res && res.documents) {
          docsList = res.documents as Doc[];
        }
      } catch (err) {
        console.warn("Failed to load local docs, falling back to Supabase:", err);
        const { data } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
        docsList = (data ?? []) as Doc[];
      }
      setDocs(docsList);
    } catch (e: any) {
      toast.error(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.file) return toast.error("Pick a file");
    if (!form.owner_id) return toast.error("Pick a tenant");
    if (!form.title) return toast.error("Title required");
    setBusy(true);
    try {
      const userId = await requireUserWithRedirect();
      if (!userId) return;
      if (!isAdmin) { toast.error("Admin access required"); setBusy(false); return; }

      // Compress images before upload if it is an image (now WebP formatted)
      const uploadFile = await compressImage(form.file);
      const fileExt = uploadFile.name.split(".").pop()?.toLowerCase();
      if (uploadFile.size > 5 * 1024 * 1024) {
        throw new Error("File too large (max 5MB limit). Please compress your PDF before uploading.");
      }
      const allowedExts = ["pdf", "jpg", "jpeg", "png", "webp"];
      if (!allowedExts.includes(fileExt || "")) {
        throw new Error("Only PDF, JPG, JPEG, and PNG files are allowed");
      }

      // 1. Prepare FormData for local Express upload
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("title", form.title || uploadFile.name);
      fd.append("owner_type", "tenant");
      fd.append("owner_id", form.owner_id);
      fd.append("doc_type", form.doc_type);

      // 2. Perform local upload
      const token = localStorage.getItem("mgt_api_token");
      const res = await fetch(`${getApiBase()}/documents`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd
      });
      
      if (!res.ok) {
        throw new Error("Local API upload failed");
      }
      
      toast.success("Document uploaded successfully locally!");
      setOpen(false);
      setForm({ title: "", doc_type: "Agreement", owner_id: "", file: null });
      load();
    } catch (e: any) {
      console.warn("Local upload failed, falling back to Supabase:", e);
      try {
        const uploadFile = await compressImage(form.file);
        const fileExt = uploadFile.name.split(".").pop()?.toLowerCase();
        const path = `tenant/${form.owner_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        
        const up = await supabase.storage.from("documents").upload(path, uploadFile, { 
          upsert: false,
          onUploadProgress: (progress) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            setUploadProgress(percent);
          }
        });
        if (up.error) throw up.error;
        
        const ins = await supabase.from("documents").insert({
          title: form.title, doc_type: form.doc_type,
          owner_type: "tenant", owner_id: form.owner_id,
          file_path: path, file_size: uploadFile.size, mime_type: uploadFile.type,
          uploaded_by: "system",
        });
        if (ins.error) throw ins.error;
        
        toast.success("Document uploaded successfully to Supabase Cloud");
        setOpen(false);
        setForm({ title: "", doc_type: "Agreement", owner_id: "", file: null });
        load();
      } catch (cloudErr: any) {
        console.error("Cloud upload failed too:", cloudErr);
        toast.error(cloudErr.message || "Could not upload document — try again");
      }
    } finally { 
      setBusy(false); 
      setUploadProgress(null);
    }
  };

  const download = async (d: Doc) => {
    const userId = await requireUserWithRedirect();
    if (!userId) return;
    if (!isAdmin) { toast.error("Admin access required"); return; }
    
    // If local file (relative name)
    if (!d.file_path.includes("/")) {
      const token = localStorage.getItem("mgt_api_token");
      const url = `${getApiBase()}/documents/${d.id}/download${token ? `?token=${token}` : ""}`;
      window.open(url, "_blank");
      return;
    }
    
    // Cloud fallback
    try {
      const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.file_path, 60);
      if (error || !data?.signedUrl) return toast.error(error?.message ?? "Failed");
      window.open(data.signedUrl, "_blank");
    } catch (e) {
      toast.error("Could not download cloud document");
    }
  };

  const handlePreview = async (d: Doc) => {
    const userId = await requireUserWithRedirect();
    if (!userId) return;
    if (!isAdmin) { toast.error("Admin access required"); return; }
    
    // If local file (relative name)
    if (!d.file_path.includes("/")) {
      const apiHost = getApiBase().replace(/\/api$/, "");
      const localUrl = `${apiHost}/uploads/${d.file_path}`;
      setPreviewUrl(localUrl);
      setPreviewTitle(d.title);
      setPreviewType(d.mime_type || (d.file_path.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg"));
      setPreviewOpen(true);
      return;
    }
    
    // Cloud fallback
    try {
      const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.file_path, 3600);
      if (error || !data?.signedUrl) return toast.error(error?.message ?? "Failed to load document preview");
      setPreviewUrl(data.signedUrl);
      setPreviewTitle(d.title);
      setPreviewType(d.mime_type || (d.file_path.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg"));
      setPreviewOpen(true);
    } catch (e) {
      toast.error("Could not load cloud document preview");
    }
  };

  const remove = async (d: Doc) => {
    if (!confirm(`Delete "${d.title}"?`)) return;
    try {
      const userId = await requireUserWithRedirect();
      if (!userId) return;
      if (!isAdmin) { toast.error("Admin access required"); return; }
      
      // 1. Delete locally first
      try {
        await apiFetch(`/documents/${d.id}`, { method: "DELETE" });
        toast.success("Deleted locally");
        load();
        return;
      } catch (err) {
        console.warn("Local delete failed, falling back to Supabase deletion:", err);
      }

      // 2. Cloud fallback
      await supabase.storage.from("documents").remove([d.file_path]);
      const { error } = await supabase.from("documents").delete().eq("id", d.id);
      if (error) throw error;
      toast.success("Deleted");
      load();
    } catch (e: any) {
      console.error("Delete document failed:", e);
      toast.error("Could not delete document — try again");
    }
  };

  const tenantLabel = (id: string | null) => {
    if (!id) return "—";
    const t = tenants.find(x => x.id === id);
    return t ? `${t.full_name ?? "Tenant"}${t.apartment_no ? ` · ${t.apartment_no}` : ""}` : id.slice(0,8);
  };

  const list = filter === "all" ? docs : docs.filter(d => d.owner_id === filter);

  return (
    <AdminLayout title="Documents">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div className="flex gap-3 items-end">
          <div>
            <Label className="text-xs">Filter by tenant</Label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tenants</SelectItem>
                {tenants.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.full_name ?? "—"} {t.apartment_no ? `· ${t.apartment_no}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground pb-2">{list.length} document{list.length !== 1 ? "s" : ""}</div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Upload Document</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload Document for Tenant</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Tenant</Label>
                <Select value={form.owner_id} onValueChange={(v) => setForm({ ...form, owner_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose tenant" /></SelectTrigger>
                  <SelectContent>
                    {tenants.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.full_name ?? "—"} {t.apartment_no ? `· ${t.apartment_no}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. May 2026 Rent Receipt" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.doc_type} onValueChange={(v) => setForm({ ...form, doc_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>File</Label>
                <Input type="file" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} accept=".pdf,.jpg,.jpeg,.png" />
                {filePreview && (
                  <div className="mt-2 p-2 border border-border/40 rounded-lg flex items-center gap-3 bg-muted/20">
                    {filePreview === "pdf" ? (
                      <div className="h-10 w-10 flex items-center justify-center bg-red-950/20 text-red-500 rounded border border-red-900/30 font-bold text-xs">PDF</div>
                    ) : (
                      <img src={filePreview} className="h-12 w-12 object-cover rounded border border-border" alt="Preview" />
                    )}
                    <div className="text-[10px] truncate max-w-xs">
                      <p className="font-bold text-foreground truncate">{form.file?.name}</p>
                      <p className="text-muted-foreground">{(form.file!.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                )}
              </div>
              {uploadProgress !== null && (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground font-semibold">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-primary h-full transition-all duration-300 rounded-full" 
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={busy}>
                <Upload className="h-4 w-4 mr-1" /> {busy ? "Uploading..." : "Upload"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border/60 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="text-left px-4 py-3">Title</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Tenant</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-right px-4 py-3">Size</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Loading...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />No documents yet
              </td></tr>
            ) : list.map(d => (
              <tr key={d.id} className="border-t border-border/40 hover:bg-secondary/20">
                <td className="px-4 py-2 font-medium">{d.title}</td>
                <td className="px-4 py-2">{d.doc_type ?? "—"}</td>
                <td className="px-4 py-2 text-xs">{tenantLabel(d.owner_id)}</td>
                <td className="px-4 py-2 text-xs">{format(new Date(d.created_at), "dd MMM yyyy")}</td>
                <td className="px-4 py-2 text-right text-xs">{d.file_size ? `${Math.round(d.file_size/1024)} KB` : "—"}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => handlePreview(d)} title="Preview"><Eye className="h-4 w-4 text-blue-400" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => download(d)} title="Download"><Download className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(d)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl bg-slate-950 border border-slate-800 text-white rounded-2xl p-6 font-sans">
          <DialogHeader className="border-b border-slate-800 pb-2">
            <DialogTitle className="text-sm font-bold tracking-wider text-slate-200">
              👁️ Document Preview: {previewTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center py-4 bg-black/40 rounded-xl border border-slate-900">
            {previewUrl ? (
              previewType?.startsWith("image/") ? (
                <img src={previewUrl} className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-elegant border border-slate-800" alt="Document Preview" />
              ) : (
                <iframe src={previewUrl} className="w-full h-[70vh] border-0 rounded-lg" title="PDF Preview" />
              )
            ) : (
              <p className="text-slate-500 text-xs">Loading preview...</p>
            )}
          </div>
          <DialogFooter className="pt-2 border-t border-slate-900">
            <Button variant="outline" className="text-xs bg-slate-900 border-slate-800 hover:bg-slate-800 text-white" onClick={() => setPreviewOpen(false)}>Close</Button>
            {previewUrl && (
              <Button className="text-xs bg-blue-600 hover:bg-blue-500 text-white" onClick={() => window.open(previewUrl, "_blank")}>
                Open In New Tab
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
