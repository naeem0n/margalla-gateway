import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Download, CloudUpload, Database, Trash2, FileJson, HardDrive, Upload, RefreshCw, AlertTriangle, ShieldAlert } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { requireUserWithRedirect } from "@/lib/requireUser";
import { useAuth } from "@/hooks/useAuth";
import { 
  downloadDbBackup, 
  restoreDbBackup, 
  downloadJsonBackup, 
  restoreJsonBackup, 
  getBackupLogs, 
  clearDbBackup, 
  isDesktopApp 
} from "@/lib/api-client";

export const Route = createFileRoute("/admin/backup")({ component: BackupPage });

type Backup = { id: string; title: string; file_path: string; created_at: string; file_size: number | null };
type BackupLog = {
  id: string;
  action: string;
  file_name: string | null;
  file_size: number | null;
  status: string;
  details: string;
  performed_by: string;
  created_at: string;
};

function BackupPage() {
  const { isAdmin } = useAuth();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [backups, setBackups] = useState<Backup[]>([]);
  const [logs, setLogs] = useState<BackupLog[]>([]);
  
  const restoreRef = useRef<HTMLInputElement>(null);
  const importJsonRef = useRef<HTMLInputElement>(null);
  const desktop = isDesktopApp();

  const loadCloudBackups = async () => {
    try {
      const { data } = await supabase
        .from("documents")
        .select("id,title,file_path,created_at,file_size")
        .eq("owner_type", "backup")
        .order("created_at", { ascending: false });
      setBackups((data ?? []) as Backup[]);
    } catch (e) {
      console.warn("Could not load cloud backups (Supabase offline/not configured):", e);
    }
  };

  const loadHistoryLogs = async () => {
    try {
      const res = await getBackupLogs();
      if (res && res.logs) {
        setLogs(res.logs);
      }
    } catch (e) {
      console.error("Failed to load backup logs:", e);
    }
  };

  const loadAll = async () => {
    setBusy(true);
    await Promise.all([loadCloudBackups(), loadHistoryLogs()]);
    setBusy(false);
  };

  useEffect(() => { loadAll(); }, []);

  // 1. Download Local SQLite Database
  const downloadDb = async () => {
    setBusy(true);
    try {
      await downloadDbBackup();
      toast.success("SQLite .db file downloaded successfully");
      await loadHistoryLogs();
    } catch (e: any) {
      toast.error(e.message ?? "Download failed");
    } finally {
      setBusy(false);
    }
  };

  // 2. Restore Local SQLite Database
  const restoreDb = async (file: File) => {
    if (!confirm("Restoring will replace the current active database file. This cannot be undone. Continue?")) return;
    setBusy(true);
    try {
      await restoreDbBackup(file);
      toast.success("Database restored successfully — please restart the application server.");
      await loadHistoryLogs();
    } catch (e: any) {
      toast.error(e.message ?? "Restore failed");
    } finally {
      setBusy(false);
    }
  };

  // 3. Export JSON Snapshot File
  const handleExportJson = async () => {
    setBusy(true);
    try {
      await downloadJsonBackup();
      toast.success("JSON Database snapshot exported successfully");
      await loadHistoryLogs();
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    } finally {
      setBusy(false);
    }
  };

  // 4. Import JSON Snapshot File
  const handleImportJson = async (file: File) => {
    if (!confirm("Importing JSON snapshot will overwrite existing database records in all main tables. Continue?")) return;
    setBusy(true);
    try {
      const res = await restoreJsonBackup(file);
      toast.success(res?.message || "JSON database snapshot imported successfully.");
      await loadHistoryLogs();
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
    } finally {
      setBusy(false);
    }
  };

  // 5. Database Clear & Reset
  const handleClearDb = async () => {
    if (!confirm("WARNING: This will drop all database tables, wipe all ERP records, and reset the database to a fresh installation. This cannot be undone! Are you absolutely sure?")) return;
    setBusy(true);
    try {
      const res = await clearDbBackup();
      if (res && res.ok) {
        toast.success(res.message || "Database successfully cleared and reset.");
      } else {
        toast.error("Database clear failed.");
      }
      await loadAll();
    } catch (e: any) {
      toast.error(e.message ?? "Clear operation failed");
    } finally {
      setBusy(false);
    }
  };

  // Cloud backup methods
  const downloadCloudBackup = async (b: Backup) => {
    const userId = await requireUserWithRedirect();
    if (!userId) return;
    if (!isAdmin) { toast.error("Admin access required"); return; }
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(b.file_path, 300);
    if (error || !data) return toast.error(error?.message ?? "Failed to fetch cloud download link");
    window.open(data.signedUrl, "_blank");
  };

  const removeCloudBackup = async (b: Backup) => {
    if (!confirm(`Delete backup "${b.title}"?`)) return;
    const userId = await requireUserWithRedirect();
    if (!userId) return;
    if (!isAdmin) { toast.error("Admin access required"); return; }
    await supabase.storage.from("documents").remove([b.file_path]);
    await supabase.from("documents").delete().eq("id", b.id);
    toast.success("Cloud backup deleted");
    loadCloudBackups();
  };

  return (
    <AdminLayout title="System Maintenance & Backups">
      <div className="w-full space-y-6">
        
        {/* Busy Loader */}
        {busy && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs rounded-xl flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Processing database operation... Please do not close this window.</span>
          </div>
        )}

        {/* Database Management Controls */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* SQLite DB File Backup/Restore */}
          <div className="bg-card border border-border/60 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <HardDrive className="h-6 w-6 text-amber-500" />
              <div>
                <h3 className="font-display text-base font-bold text-foreground">SQLite Offline Database Backups</h3>
                <p className="text-xs text-muted-foreground">Download or restore the physical raw database file (.db).</p>
              </div>
            </div>
            
            <hr className="border-border/60" />

            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button onClick={downloadDb} disabled={busy} className="h-10 text-xs">
                <Download className="h-4 w-4 mr-2" /> Export .db File
              </Button>

              <input 
                ref={restoreRef} 
                type="file" 
                accept=".db" 
                className="hidden" 
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) restoreDb(f);
                  e.target.value = "";
                }} 
              />
              <Button variant="outline" onClick={() => restoreRef.current?.click()} disabled={busy} className="h-10 text-xs border-border/60">
                <Upload className="h-4 w-4 mr-2" /> Import & Restore .db
              </Button>
            </div>
          </div>

          {/* JSON Snapshot Backup/Restore */}
          <div className="bg-card border border-border/60 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <FileJson className="h-6 w-6 text-amber-500" />
              <div>
                <h3 className="font-display text-base font-bold text-foreground">JSON Database Snapshots</h3>
                <p className="text-xs text-muted-foreground">Export or import standard JSON data dumps containing all ERP records.</p>
              </div>
            </div>
            
            <hr className="border-border/60" />

            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button onClick={handleExportJson} disabled={busy} className="h-10 text-xs">
                <Download className="h-4 w-4 mr-2" /> Export JSON
              </Button>

              <input 
                ref={importJsonRef} 
                type="file" 
                accept=".json" 
                className="hidden" 
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportJson(f);
                  e.target.value = "";
                }} 
              />
              <Button variant="outline" onClick={() => importJsonRef.current?.click()} disabled={busy} className="h-10 text-xs border-border/60">
                <Upload className="h-4 w-4 mr-2" /> Import JSON
              </Button>
            </div>
          </div>
        </div>

        {/* Database Clear & Reset */}
        <div className="bg-card border border-red-500/20 rounded-xl p-5 shadow-sm space-y-4 bg-red-500/5">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-red-500" />
            <div>
              <h3 className="font-display text-base font-bold text-red-500">Database Clear & Reset</h3>
              <p className="text-xs text-red-500/80">Wipes all tables, resets SQLite schemas, and recreates the default admin credentials.</p>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button onClick={handleClearDb} disabled={busy} variant="destructive" className="h-10 text-xs uppercase font-black tracking-wider bg-red-600 hover:bg-red-700">
              <Trash2 className="h-4 w-4 mr-2" /> Clear & Reset Database
            </Button>
          </div>
        </div>

        {/* Backup History Log Table */}
        <div className="bg-card border border-border/60 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h3 className="font-display text-base font-bold text-foreground">Backup & Maintenance History Logs</h3>
              <p className="text-xs text-muted-foreground">Historical records of backup, restore, export, and system clear actions.</p>
            </div>
            <Button onClick={loadHistoryLogs} size="sm" variant="outline" className="h-8 text-xs border-border/60">
              <RefreshCw className="h-3 w-3 mr-1.5" /> Refresh
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-muted text-muted-foreground border-b border-border/60 uppercase text-[9px] font-bold">
                  <th className="p-2 border-r border-border/60">Timestamp</th>
                  <th className="p-2 border-r border-border/60">Operation</th>
                  <th className="p-2 border-r border-border/60">File Name</th>
                  <th className="p-2 border-r border-border/60">Size</th>
                  <th className="p-2 border-r border-border/60">Status</th>
                  <th className="p-2 border-r border-border/60">Details</th>
                  <th className="p-2">Admin / System</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground font-sans text-xs">
                      No system backup logs found in the database registry.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b border-border/60 hover:bg-muted/20">
                      <td className="p-2 border-r border-border/60 text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="p-2 border-r border-border/60 font-semibold text-foreground">
                        {log.action}
                      </td>
                      <td className="p-2 border-r border-border/60 font-bold text-amber-500">
                        {log.file_name || "—"}
                      </td>
                      <td className="p-2 border-r border-border/60">
                        {log.file_size ? `${(log.file_size / 1024).toFixed(1)} KB` : "—"}
                      </td>
                      <td className="p-2 border-r border-border/60">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-sans ${
                          log.status === "Success" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="p-2 border-r border-border/60 font-sans max-w-sm truncate text-muted-foreground" title={log.details}>
                        {log.details}
                      </td>
                      <td className="p-2 font-semibold">
                        {log.performed_by || "system"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cloud Backups (Supabase/S3 Storage Log) */}
        <div className="bg-card border border-border/60 rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <h3 className="font-display text-base font-bold text-foreground">Supabase Cloud JSON Archives</h3>
            <p className="text-xs text-muted-foreground">JSON backups stored in the Supabase Cloud Storage bucket.</p>
          </div>
          <div className="divide-y border border-border/60 rounded-xl overflow-hidden bg-background">
            {backups.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground font-sans">No active Supabase cloud backups found.</p>
            ) : backups.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 text-xs bg-card hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <FileJson className="h-5 w-5 text-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold truncate text-foreground">{b.title}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(b.created_at).toLocaleString()}
                      {b.file_size ? ` · ${(b.file_size / 1024).toFixed(1)} KB` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="h-8 text-xs border-border/60" onClick={() => downloadCloudBackup(b)}>Download</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs border-red-500/20 hover:bg-red-500/10 hover:text-red-400" onClick={() => removeCloudBackup(b)}>
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
