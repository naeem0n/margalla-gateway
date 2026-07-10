import { createFileRoute } from "@tanstack/react-router";
import { ResidentLayout } from "@/components/resident/ResidentLayout";
import { FileText, Download, Inbox, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { requireUserWithRedirect } from "@/lib/requireUser";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getApiBase } from "@/lib/api-client";

type Doc = {
  id: string;
  title: string;
  doc_type: string | null;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
};

export const Route = createFileRoute("/resident/documents")({ component: Page });

function Page() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select("id,title,doc_type,file_path,file_size,mime_type,created_at")
      .eq("owner_type", "tenant")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setDocs((data ?? []) as Doc[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const download = async (d: Doc) => {
    const userId = await requireUserWithRedirect();
    if (!userId) return;
    
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
      if (error || !data?.signedUrl) return toast.error(error?.message ?? "Could not get file");
      window.open(data.signedUrl, "_blank");
    } catch (e) {
      toast.error("Could not download cloud document");
    }
  };

  const handlePreview = async (d: Doc) => {
    const userId = await requireUserWithRedirect();
    if (!userId) return;
    
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

  return (
    <ResidentLayout title="Documents">
      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Loading...</div>
      ) : docs.length === 0 ? (
        <div className="text-center py-16 bg-card border border-dashed border-border rounded-lg">
          <Inbox className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No documents shared with you yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Your agreement, receipts and reports will appear here.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
          {docs.map((d) => (
            <div key={d.id} className="bg-card border border-border/60 rounded-lg p-5 flex items-start gap-3">
              <FileText className="h-7 w-7 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{d.title}</div>
                <div className="text-xs text-muted-foreground mb-3">
                  {d.doc_type ?? "Document"} · {d.file_size ? `${Math.round(d.file_size/1024)} KB · ` : ""}{format(new Date(d.created_at), "dd MMM yyyy")}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="bg-transparent" onClick={() => download(d)}>
                    <Download className="h-3 w-3 mr-1" />Download
                  </Button>
                  <Button size="sm" variant="ghost" className="text-[#d4af37] hover:bg-slate-800" onClick={() => handlePreview(d)}>
                    <Eye className="h-3.5 w-3.5 mr-1" />Preview
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
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
    </ResidentLayout>
  );
}
