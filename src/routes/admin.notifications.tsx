// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Send, MessageCircle, Smartphone, CheckCircle2, AlertCircle, Beaker, Pencil } from "lucide-react";
import { requireUserWithRedirect } from "@/lib/requireUser";
import { useAuth } from "@/hooks/useAuth";
import { sendNotification, getNotificationProviderStatus } from "@/lib/notifications.functions";

type Template = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  channel: "whatsapp" | "sms" | "both";
  subject: string | null;
  body: string;
  variables: string[];
  is_active: boolean;
};

type Log = {
  id: string;
  channel: "whatsapp" | "sms";
  template_key: string | null;
  recipient_phone: string;
  body: string;
  status: "pending" | "sent" | "failed" | "delivered" | "read";
  provider: string | null;
  error_message: string | null;
  created_at: string;
};

type ProviderStatus = {
  whatsapp: { configured: boolean; mode: string; provider: string };
  sms: { configured: boolean; mode: string; provider: string };
};

export const Route = createFileRoute("/admin/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [testOpen, setTestOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [tplRes, logRes, statusRes] = await Promise.all([
      supabase.from("notification_templates").select("*").order("name"),
      supabase.from("notification_logs").select("*").order("created_at", { ascending: false }).limit(100),
      getNotificationProviderStatus().catch(() => null),
    ]);
    setTemplates((tplRes.data ?? []) as Template[]);
    setLogs((logRes.data ?? []) as Log[]);
    if (statusRes) setStatus(statusRes);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <AdminLayout title="Notifications">
      <div className="space-y-6">
        {/* Provider status banner */}
        <div className="grid md:grid-cols-2 gap-4">
          <ProviderCard
            icon={<MessageCircle className="h-5 w-5" />}
            label="WhatsApp"
            status={status?.whatsapp}
          />
          <ProviderCard
            icon={<Smartphone className="h-5 w-5" />}
            label="SMS"
            status={status?.sms}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={() => setTestOpen(true)}>
            <Send className="h-4 w-4 mr-2" /> Send test
          </Button>
        </div>

        <Tabs defaultValue="templates">
          <TabsList>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="logs">Delivery Logs</TabsTrigger>
            <TabsTrigger value="sms-transmitter">⚡ SMS Transmitter</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && templates.length === 0 && (
              <p className="text-sm text-muted-foreground">No templates yet.</p>
            )}
            <div className="grid gap-3">
              {templates.map((t) => (
                <Card key={t.id}>
                  <CardContent className="pt-6 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{t.name}</h3>
                        <Badge variant="secondary" className="text-xs">{t.key}</Badge>
                        <Badge variant="outline" className="text-xs uppercase">{t.channel}</Badge>
                        {!t.is_active && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                      </div>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                      )}
                      <pre className="mt-2 text-xs bg-muted/50 rounded p-2 whitespace-pre-wrap font-sans">
                        {t.body}
                      </pre>
                      {t.variables.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {t.variables.map((v) => (
                            <Badge key={v} variant="outline" className="text-[10px] font-mono">{`{{${v}}}`}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ── SMS TRANSMITTER TAB ── */}
          <TabsContent value="sms-transmitter">
            <SmsTransmitter />
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader><CardTitle>Recent deliveries</CardTitle></CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No notifications sent yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground border-b">
                        <tr>
                          <th className="text-left py-2">When</th>
                          <th className="text-left">Channel</th>
                          <th className="text-left">To</th>
                          <th className="text-left">Status</th>
                          <th className="text-left">Provider</th>
                          <th className="text-left">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((l) => (
                          <tr key={l.id} className="border-b last:border-0">
                            <td className="py-2 whitespace-nowrap text-xs">
                              {new Date(l.created_at).toLocaleString()}
                            </td>
                            <td className="text-xs uppercase">{l.channel}</td>
                            <td className="font-mono text-xs">{l.recipient_phone}</td>
                            <td><StatusBadge status={l.status} provider={l.provider} /></td>
                            <td className="text-xs text-muted-foreground">{l.provider ?? "—"}</td>
                            <td className="text-xs max-w-md truncate" title={l.body}>
                              {l.error_message ? <span className="text-destructive">{l.error_message}</span> : l.body}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {editing && (
        <TemplateEditor template={editing} onClose={() => { setEditing(null); load(); }} />
      )}
      {testOpen && (
        <TestSendDialog templates={templates} onClose={() => { setTestOpen(false); load(); }} />
      )}
    </AdminLayout>
  );
}

function ProviderCard({ icon, label, status }: {
  icon: React.ReactNode;
  label: string;
  status?: { configured: boolean; mode: string; provider: string };
}) {
  const isMock = !status?.configured;
  return (
    <Card>
      <CardContent className="pt-6 flex items-center gap-4">
        <div className={`p-3 rounded-lg ${isMock ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"}`}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{label}</span>
            {isMock ? (
              <Badge variant="outline" className="text-amber-600 border-amber-600/30">
                <Beaker className="h-3 w-3 mr-1" /> Mock Mode
              </Badge>
            ) : (
              <Badge variant="outline" className="text-emerald-600 border-emerald-600/30">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Live
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Provider: {status?.provider ?? "mock"} · Mode: {status?.mode ?? "mock"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, provider }: { status: Log["status"]; provider: string | null }) {
  if (provider === "mock") {
    return <Badge variant="outline" className="text-amber-600 border-amber-600/30">Mock</Badge>;
  }
  const map: Record<Log["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    sent: { label: "Sent", variant: "default" },
    delivered: { label: "Delivered", variant: "default" },
    read: { label: "Read", variant: "default" },
    pending: { label: "Pending", variant: "secondary" },
    failed: { label: "Failed", variant: "destructive" },
  };
  const m = map[status];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function TemplateEditor({ template, onClose }: { template: Template; onClose: () => void }) {
  const { isAdmin } = useAuth();
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [body, setBody] = useState(template.body);
  const [channel, setChannel] = useState(template.channel);
  const [isActive, setIsActive] = useState(template.is_active);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const userId = await requireUserWithRedirect();
      if (!userId) return;
      if (!isAdmin) { toast.error("Admin access required"); return; }
      const { error } = await supabase
        .from("notification_templates")
        .update({ name, description, body, channel, is_active: isActive })
        .eq("id", template.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Template saved");
      onClose();
    } catch (e: any) {
      console.error("Save notification template failed:", e);
      toast.error("Could not save template — try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Edit template · {template.key}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Channel</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as Template["channel"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">
              Use {`{{variable}}`} placeholders. Available: {template.variables.map((v) => `{{${v}}}`).join(", ") || "none"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TestSendDialog({ templates, onClose }: { templates: Template[]; onClose: () => void }) {
  const { isAdmin } = useAuth();
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [to, setTo] = useState("");
  const [templateKey, setTemplateKey] = useState<string>("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ status: string; mock: boolean; provider?: string; error?: string } | null>(null);

  const send = async () => {
    if (!to.trim()) { toast.error("Recipient phone required"); return; }
    if (!templateKey && !body.trim()) { toast.error("Pick a template or write a body"); return; }
    setSending(true);
    try {
      const userId = await requireUserWithRedirect();
      if (!userId) return;
      if (!isAdmin) { toast.error("Admin access required"); return; }
      const res = await apiFetch<any>("/notifications/test", {
        method: "POST",
        body: JSON.stringify({
          channel,
          to: to.trim(),
          templateKey: templateKey || undefined,
          body: body.trim() || undefined,
          triggerType: "manual_test",
        }),
      });
      setLastResult(res);
      if (res.ok) toast.success(res.mock ? "Sent (Mock Mode — check console)" : "Sent");
      else toast.error(res.error ?? "Failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Send test notification</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Channel</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as "whatsapp" | "sms")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To (E.164 phone)</Label>
              <Input placeholder="+923329787438" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Template (optional)</Label>
            <Select value={templateKey} onValueChange={setTemplateKey}>
              <SelectTrigger><SelectValue placeholder="Pick a template or leave empty" /></SelectTrigger>
              <SelectContent>
                {templates.filter((t) => t.channel === channel || t.channel === "both").map((t) => (
                  <SelectItem key={t.id} value={t.key}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Body (used if no template)</Label>
            <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Custom message…" />
          </div>
          {lastResult && (
            <div className={`text-sm p-3 rounded border ${lastResult.status === "sent" ? "bg-emerald-500/5 border-emerald-500/20" : "bg-destructive/5 border-destructive/20"}`}>
              <div className="flex items-center gap-2">
                {lastResult.status === "sent" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-destructive" />}
                <span className="font-medium capitalize">{lastResult.status}</span>
                {lastResult.mock && <Badge variant="outline" className="text-amber-600 border-amber-600/30 text-xs"><Beaker className="h-3 w-3 mr-1" />Mock Mode</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Provider: {lastResult.provider} {lastResult.error && `· Error: ${lastResult.error}`}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={send} disabled={sending}>
            <Send className="h-4 w-4 mr-2" />{sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────────
   ⚡ SMS TRANSMITTER — Real Pakistan GSM Gateway Trigger Panel
   ───────────────────────────────────────────────────────────── */
function SmsTransmitter() {
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState(
    "Dear Resident, your utility statement for Margalla Gateway has been generated."
  );
  const [smsStatus, setSmsStatus] = useState("");
  const [sending, setSending] = useState(false);

  const triggerLiveSmsNotification = async () => {
    if (!testPhone.trim()) {
      setSmsStatus("🚨 Pehle mobile nambar likhein ustad ge!");
      return;
    }
    setSending(true);
    setSmsStatus("");
    try {
      // Uses relative URL — works in both Vite dev proxy and Electron desktop
      const response = await fetch("/api/notifications/send-real-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: testPhone.trim(),
          message_content: testMessage,
        }),
      });
      const resData = await response.json();
      if (resData.success) {
        setSmsStatus(`✅ Success! Message sent to ${testPhone}. Status: LIVE`);
      } else {
        setSmsStatus(`🚨 Error: ${resData.message}`);
      }
    } catch (err) {
      setSmsStatus("🚨 Local network connection to API gateway is blocked.");
    } finally {
      setSending(false);
    }
  };

  const isSuccess = smsStatus.includes("✅");

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="border-b border-border pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-yellow-500">
            ⚡ LIVE SMS & NOTIFICATION TRANSMITTER
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Switching production pipeline from Mock Mode to real GSM gateway channels.
          </p>
        </div>
        <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800 text-xs px-3 py-1 rounded-full font-bold font-mono">
          ● PRODUCTION GATEWAY ACTIVE
        </span>
      </div>

      {/* ── Transmitter Panel ── */}
      <div className="max-w-xl bg-card border border-border/60 p-6 rounded-2xl shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
          🚀 Send Real Live Notification Trigger
        </h3>

        {/* Status banner */}
        {smsStatus && (
          <div
            className={`p-3 rounded-xl border text-xs font-bold font-mono ${
              isSuccess
                ? "bg-emerald-950/50 border-emerald-500 text-emerald-400"
                : "bg-rose-950/50 border-rose-500 text-rose-400"
            }`}
          >
            {smsStatus}
          </div>
        )}

        <div className="space-y-3 text-xs">
          {/* Phone */}
          <div>
            <label className="text-muted-foreground block mb-1 font-medium">
              Target Phone Number (Pakistan Format)
            </label>
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="w-full bg-background border border-border rounded-xl p-3 text-emerald-400 font-bold font-mono text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/40 transition"
              placeholder="e.g., 03001234567"
            />
          </div>

          {/* Message */}
          <div>
            <label className="text-muted-foreground block mb-1 font-medium">
              Message Body / Template Wrapper Content
            </label>
            <textarea
              rows={4}
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              className="w-full bg-background border border-border rounded-xl p-3 text-foreground font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition leading-relaxed resize-none"
            />
          </div>

          {/* Fire button */}
          <button
            onClick={triggerLiveSmsNotification}
            disabled={sending}
            className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-black py-4 px-6 rounded-xl transition-all shadow-md text-sm tracking-wide uppercase mt-2"
          >
            {sending
              ? "⏳ TRANSMITTING TO GSM NETWORK..."
              : "⚡ Send Real Notification Text"}
          </button>
        </div>
      </div>
    </div>
  );
}
