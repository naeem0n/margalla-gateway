import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { Cloud, Wifi, WifiOff, RefreshCw } from "lucide-react";

function SettingsPage() {
  const [syncCloudUrl, setSyncCloudUrl] = useState("");
  const [syncApiKey, setSyncApiKey] = useState("");
  const [syncApiKeySet, setSyncApiKeySet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ pendingCount: number; errorCount: number; isOnline: boolean } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const configData = await apiFetch<{ syncCloudUrl: string; syncApiKeySet: boolean }>("/sync/config");
        setSyncCloudUrl(configData.syncCloudUrl || "");
        setSyncApiKeySet(Boolean(configData.syncApiKeySet));
        setSyncApiKey("");
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    }
    async function checkStatus() {
      try {
        const statusData = await apiFetch<{ pendingCount: number; errorCount: number; isOnline: boolean }>("/sync/client-status");
        setStatus(statusData);
      } catch (err) {
        console.error("Failed to load sync status:", err);
      }
    }
    loadSettings();
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveSync = async () => {
    setLoading(true);
    try {
      await apiFetch("/sync/config", {
        method: "POST",
        // Only send the key when the admin actually entered a new one; an
        // empty field leaves the stored key unchanged.
        body: JSON.stringify(syncApiKey.trim() ? { syncCloudUrl, syncApiKey } : { syncCloudUrl }),
      });
      if (syncApiKey.trim()) {
        setSyncApiKeySet(true);
        setSyncApiKey("");
      }
      toast.success("Synchronization settings saved successfully!");
      
      // Request an immediate sync push
      try {
        const res = await apiFetch<{ pushed: number }>("/sync/push", { method: "POST" });
        if (res.pushed > 0) {
          toast.success(`Successfully pushed ${res.pushed} pending records to cloud!`);
        }
      } catch (e) {
        console.warn("Immediate push failed:", e);
      }
      
      // Update status
      const statusData = await apiFetch<{ pendingCount: number; errorCount: number; isOnline: boolean }>("/sync/client-status");
      setStatus(statusData);
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerPush = async () => {
    try {
      toast.loading("Syncing database tables...", { id: "sync-toast" });
      const res = await apiFetch<{ pushed: number }>("/sync/push", { method: "POST" });
      toast.dismiss("sync-toast");
      toast.success(`Sync process complete. Pushed ${res.pushed} entries to online portal.`);
      const statusData = await apiFetch<{ pendingCount: number; errorCount: number; isOnline: boolean }>("/sync/client-status");
      setStatus(statusData);
    } catch (err: any) {
      toast.dismiss("sync-toast");
      toast.error(err.message || "Sync execution failed");
    }
  };

  return (
    <AdminLayout title="Settings">
      <div className="grid lg:grid-cols-2 gap-6 max-w-5xl">
        {/* Building Info Card */}
        <div className="bg-card border border-border/60 rounded-lg p-6 space-y-4 shadow-md hover:shadow-lg transition">
          <h3 className="font-display text-xl flex items-center gap-2">🏢 Building Info</h3>
          <div>
            <Label>Building Name</Label>
            <Input className="mt-1" defaultValue="Margalla Gateway" />
          </div>
          <div>
            <Label>Address</Label>
            <Input className="mt-1" defaultValue="E-11/4, Street No 26-A, Islamabad" />
          </div>
          <div>
            <Label>Contact</Label>
            <Input className="mt-1" defaultValue="+92 300 1234567" />
          </div>
          <Button className="bg-primary text-primary-foreground font-semibold" onClick={() => toast.success("Building details updated!")}>Save</Button>
        </div>

        {/* Dynamic Cloud Sync Card */}
        <div className="bg-card border border-border/60 rounded-lg p-6 space-y-4 shadow-md hover:shadow-lg transition">
          <h3 className="font-display text-xl flex items-center gap-2">☁️ Website Cloud Sync</h3>
          
          <div className="flex items-center gap-3 p-3.5 rounded bg-muted/30 border border-border/40 text-xs">
            {status?.isOnline ? (
              <Wifi className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <WifiOff className="h-5 w-5 text-zinc-400 shrink-0" />
            )}
            <div>
              <div className="font-semibold text-slate-200">
                Connection Status: {status?.isOnline ? "Connected" : "Offline"}
              </div>
              <div className="text-muted-foreground mt-0.5">
                {status?.pendingCount ?? 0} updates pending in queue. {status?.errorCount ?? 0} errors reported.
              </div>
            </div>
            {status && status.pendingCount > 0 && status.isOnline && (
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-auto text-[10px] h-7 px-2 flex items-center gap-1 border-slate-700 bg-slate-800"
                onClick={handleTriggerPush}
              >
                <RefreshCw className="h-3 w-3" /> Sync Now
              </Button>
            )}
          </div>

          <div>
            <Label>Website Base API URL</Label>
            <Input 
              className="mt-1 font-mono text-sm" 
              placeholder="e.g. https://margalla-gateway.com" 
              value={syncCloudUrl}
              onChange={(e) => setSyncCloudUrl(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground mt-1">Provide the URL where your online Resident Portal website is hosted.</p>
          </div>
          <div>
            <Label>Sync Authorization Key</Label>
            <Input 
              type="password" 
              className="mt-1 font-mono text-sm" 
              placeholder={syncApiKeySet ? "•••••••••• (key set — leave blank to keep)" : "Enter secure synchronization API key"} 
              value={syncApiKey}
              onChange={(e) => setSyncApiKey(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground mt-1">Secret key shared with the server to authenticate requests. For security it is never displayed; leave blank to keep the existing key.</p>
          </div>
          <Button 
            className="bg-[#cca43b] text-slate-950 hover:bg-[#b08c2d] font-semibold"
            onClick={handleSaveSync}
            disabled={loading}
          >
            {loading ? "Saving Settings..." : "Save Sync Config"}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});
