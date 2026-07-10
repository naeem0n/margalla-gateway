import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Search, ShieldCheck, Loader2, Crown, KeyRound, Copy, Home } from "lucide-react";
import { toast } from "sonner";
import { requireUserWithRedirect } from "@/lib/requireUser";
import { useAuth } from "@/hooks/useAuth";
import { promoteToAdmin } from "@/lib/promote.functions";
import { apiFetch } from "@/lib/api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { grantResidentAccess } from "@/lib/resident-gate";

export const Route = createFileRoute("/admin/access-control")({
  head: () => ({ meta: [{ title: "Access Control — Admin" }] }),
  component: AccessControlPage,
});

type ResidentRow = {
  id: string;
  full_name: string | null;
  apartment_no: string | null;
  client_id: string | null;
  is_approved: boolean;
  created_at: string;
  email?: string | null;
  phone?: string | null;
  permissions_json?: string;
};

const formatWhatsAppPhone = (phone: string) => {
  let cleaned = phone.replace(/\D/g, ""); // remove non-digits
  if (cleaned.startsWith("0")) {
    cleaned = "92" + cleaned.slice(1);
  } else if (cleaned.length === 10) {
    cleaned = "92" + cleaned;
  }
  return cleaned;
};

function AccessControlPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<ResidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Dialog & Permissions State
  const [selectedResident, setSelectedResident] = useState<ResidentRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [genPassword, setGenPassword] = useState("");
  const [perms, setPerms] = useState({
    canManageUtilities: false,
    canCreateAnnouncements: false,
    canResolveComplaints: false,
  });
  const [savingPerms, setSavingPerms] = useState(false);

  const load = async () => {
    setLoading(true);
    // Get all profiles whose user has resident role
    const { data: residentRoles, error: roleError } = await supabase
      .from("user_roles").select("user_id").eq("role", "resident");
    const ids = (residentRoles ?? []).map((r: any) => r.user_id);
    
    let profiles: any[] = [];
    if (ids.length > 0 && !roleError) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, apartment_no, client_id, is_approved, created_at, phone")
        .in("id", ids)
        .order("created_at", { ascending: false });
      if (!error && data) profiles = data;
    }

    // Fallback to local SQLite users API in desktop/local environment
    if (profiles.length === 0) {
      try {
        const localUsers = await apiFetch<{ users: any[] }>("/users");
        if (localUsers && localUsers.users) {
          profiles = localUsers.users.map(u => ({
            id: u.id,
            full_name: u.full_name,
            apartment_no: u.apartment_no,
            client_id: u.client_id,
            phone: u.phone,
            is_approved: u.is_active === 1,
            created_at: u.created_at || new Date().toISOString(),
            permissions_json: u.permissions_json,
          }));
        }
      } catch (e) {
        console.error("Local users fetch failed:", e);
      }
    }
    setRows(profiles as ResidentRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.apartment_no ?? "").toLowerCase().includes(q) ||
      (r.full_name ?? "").toLowerCase().includes(q) ||
      (r.client_id ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const toggleApproval = async (row: ResidentRow, next: boolean) => {
    setBusyId(row.id);
    try {
      const userId = await requireUserWithRedirect();
      if (!userId) return;
      if (!isAdmin) { toast.error("Admin access required"); return; }
      
      // Update local API first if in desktop/local mode
      try {
        await apiFetch(`/users/${row.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            is_active: next ? 1 : 0,
            client_id: row.client_id,
            full_name: row.full_name,
            apartment_no: row.apartment_no,
            phone: row.phone,
          })
        });
      } catch (e) {
        console.error("Local active status update failed:", e);
      }

      const { error } = await supabase
        .from("profiles").update({ is_approved: next }).eq("id", row.id);
      if (error) { toast.error(error.message); return; }
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, is_approved: next } : r));
      toast.success(next ? "Access granted" : "Access revoked");
    } catch (e: any) {
      console.error("Toggle approval failed:", e);
      toast.error("Could not update approval status");
    } finally {
      setBusyId(null);
    }
  };

  const bulkApprove = async () => {
    const pending = filtered.filter(r => !r.is_approved).map(r => r.id);
    if (pending.length === 0) { toast.info("No pending residents"); return; }
    setBulkBusy(true);
    try {
      const userId = await requireUserWithRedirect();
      if (!userId) return;
      if (!isAdmin) { toast.error("Admin access required"); return; }
      
      // Bulk update locally
      for (const pid of pending) {
        const row = filtered.find(r => r.id === pid);
        try {
          await apiFetch(`/users/${pid}`, {
            method: "PATCH",
            body: JSON.stringify({
              is_active: 1,
              client_id: row?.client_id,
              full_name: row?.full_name,
              apartment_no: row?.apartment_no,
              phone: row?.phone,
            })
          });
        } catch (e) {
          console.error(e);
        }
      }

      const { error } = await supabase
        .from("profiles").update({ is_approved: true }).in("id", pending);
      if (error) { toast.error(error.message); return; }
      setRows(prev => prev.map(r => pending.includes(r.id) ? { ...r, is_approved: true } : r));
      toast.success(`Approved ${pending.length} resident${pending.length > 1 ? "s" : ""}`);
    } catch (e: any) {
      console.error("Bulk approve failed:", e);
      toast.error("Could not complete bulk approval");
    } finally {
      setBulkBusy(false);
    }
  };

  const openManageDialog = (r: ResidentRow) => {
    setSelectedResident(r);
    setGenPassword("");
    let parsedPerms = {
      canManageUtilities: false,
      canCreateAnnouncements: false,
      canResolveComplaints: false,
    };
    if (r.permissions_json) {
      try {
        const parsed = typeof r.permissions_json === "string" ? JSON.parse(r.permissions_json) : r.permissions_json;
        parsedPerms = {
          canManageUtilities: !!parsed.canManageUtilities,
          canCreateAnnouncements: !!parsed.canCreateAnnouncements,
          canResolveComplaints: !!parsed.canResolveComplaints,
        };
      } catch (e) {
        console.error("Failed to parse permissions_json", e);
      }
    }
    setPerms(parsedPerms);
    setDialogOpen(true);
  };

  const handleGeneratePassword = async () => {
    if (!selectedResident) return;
    try {
      const res = await apiFetch<{ password: string }>(`/users/${selectedResident.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({
          client_id: selectedResident.client_id,
          full_name: selectedResident.full_name,
          apartment_no: selectedResident.apartment_no,
          phone: selectedResident.phone,
        })
      });
      setGenPassword(res.password);
      toast.success("Password generated successfully");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to generate password");
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedResident) return;
    setSavingPerms(true);
    try {
      await apiFetch(`/users/${selectedResident.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          permissions: perms,
          client_id: selectedResident.client_id,
          full_name: selectedResident.full_name,
          apartment_no: selectedResident.apartment_no,
          phone: selectedResident.phone,
        })
      });
      toast.success("Permissions updated successfully");
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to update permissions");
    } finally {
      setSavingPerms(false);
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <AdminLayout title="Authorize Resident Access">
      <PromoteAdminCard />
      <div className="bg-card border border-border/60 rounded-lg p-6">
        <div className="flex flex-wrap gap-3 items-center mb-5">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by flat, name or client ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={bulkApprove} disabled={bulkBusy}>
            {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Bulk Approve Visible
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-muted-foreground text-xs">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Resident</th>
                <th className="text-left px-4 py-3 font-medium">Flat</th>
                <th className="text-left px-4 py-3 font-medium">Client ID</th>
                <th className="text-left px-4 py-3 font-medium">Date Joined</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Access</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No residents found.</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="border-t border-border/40 hover:bg-secondary/30">
                  <td className="px-4 py-3">{r.full_name ?? "—"}</td>
                  <td className="px-4 py-3">{r.apartment_no ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs flex items-center gap-1.5 py-4">
                    <span>{r.client_id ?? "—"}</span>
                    {r.client_id && (
                      <button onClick={() => copyToClipboard(r.client_id!, "Client ID")} className="text-muted-foreground hover:text-primary p-0.5" title="Copy Client ID">
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {r.is_approved ? (
                      <span className="text-xs px-2 py-1 rounded bg-success/20 text-success">Active</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded bg-destructive/20 text-destructive">Access Denied</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={r.is_approved}
                        disabled={busyId === r.id}
                        onCheckedChange={(v) => toggleApproval(r, v)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {r.is_approved ? "Revoke" : "Approve"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openManageDialog(r)}
                      className="h-8 text-xs flex items-center gap-1 ml-auto hover:bg-primary hover:text-primary-foreground"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Manage Access
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Access and Permissions Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#111] border border-[#d4af37]/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2 text-[#d4af37]">
              <KeyRound className="h-5 w-5" /> Manage Resident Access
            </DialogTitle>
          </DialogHeader>
          {selectedResident && (
            <div className="space-y-6 py-4">
              {/* Resident Info Summary */}
              <div className="p-3 bg-white/5 rounded border border-white/10 text-xs space-y-1 text-gray-300">
                <div><span className="text-gray-500">Name:</span> <strong className="text-white">{selectedResident.full_name || "—"}</strong></div>
                <div><span className="text-gray-500">Flat:</span> <strong className="text-white">{selectedResident.apartment_no || "—"}</strong></div>
                <div className="pt-2">
                  <Button
                    size="sm"
                    onClick={() => impersonateResident(selectedResident.id)}
                    className="w-full bg-[#d4af37] text-black hover:bg-[#b8962e] font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Home className="h-4 w-4" /> Open Residence Portal
                  </Button>
                </div>
              </div>

              {/* ID & Password Section */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase tracking-wider text-[#d4af37] font-semibold border-b border-white/10 pb-1">Resident Login Credentials</h4>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Resident ID / Client ID</label>
                    <div className="flex gap-2">
                      <Input value={selectedResident.client_id || ""} readOnly className="bg-black/50 border-white/10 font-mono text-sm h-9 flex-1" />
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(selectedResident.client_id || "", "Resident ID")} className="h-9 px-2 hover:bg-[#d4af37] hover:text-black">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Generate Security Password</label>
                    <div className="flex gap-2">
                      <Input value={genPassword || "••••••••"} readOnly className="bg-black/50 border-white/10 font-mono text-sm h-9 flex-1" />
                      {genPassword ? (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => copyToClipboard(genPassword, "Password")} className="h-9 px-2 hover:bg-[#d4af37] hover:text-black" title="Copy Password">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (!selectedResident.phone) {
                                toast.error("No phone number registered for this resident!");
                                return;
                              }
                              const formattedPhone = formatWhatsAppPhone(selectedResident.phone);
                              const text = encodeURIComponent(
                                `Salaam! Margalla Gateway Resident Portal login details:\n\n` +
                                `Resident ID: ${selectedResident.client_id}\n` +
                                `Password: ${genPassword}\n\n` +
                                `Portal Link: ${window.location.origin}`
                              );
                              window.open(`https://wa.me/${formattedPhone}?text=${text}`, "_blank");
                            }}
                            className="h-9 px-2 bg-green-600 hover:bg-green-700 text-white border-none flex items-center gap-1.5"
                            title="Send via WhatsApp"
                          >
                            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.66.986 3.284 1.48 4.937 1.482 5.425.002 9.837-4.407 9.84-9.84.002-2.63-1.023-5.101-2.887-6.967C16.636 1.963 14.163 1.04 11.53 1.04c-5.437 0-9.852 4.414-9.855 9.852-.001 1.76.47 3.468 1.363 5.018l-1.02 3.723 3.829-1.003zm13.143-6.924c-.305-.153-1.803-.889-2.083-.99-.28-.102-.485-.153-.687.153-.202.306-.78.99-.956 1.193-.176.202-.352.228-.657.076-.305-.153-1.288-.475-2.455-1.517-.908-.81-1.52-1.81-1.698-2.115-.178-.305-.019-.47.134-.622.137-.137.305-.356.457-.534.153-.178.204-.305.306-.51.102-.204.051-.381-.026-.534-.076-.153-.687-1.654-.94-2.264-.247-.595-.5-515-.687-.525-.178-.01-.381-.01-.584-.01-.203 0-.534.076-.813.381-.28.305-1.067 1.042-1.067 2.542 0 1.5 1.092 2.946 1.244 3.15.153.204 2.149 3.282 5.207 4.601.727.314 1.295.5 1.739.642.73.232 1.393.199 1.918.12.585-.087 1.804-.737 2.058-1.45.253-.713.253-1.323.178-1.45-.076-.127-.28-.203-.585-.356z"/>
                            </svg>
                            <span>WhatsApp</span>
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" onClick={handleGeneratePassword} className="h-9 bg-[#d4af37] text-black hover:bg-[#b8962e]">
                          Generate
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Permissions Section */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase tracking-wider text-[#d4af37] font-semibold border-b border-white/10 pb-1">Delegated Duties (Admin Duties)</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-white">Manage Utilities & Dues</div>
                      <div className="text-[10px] text-gray-400">Enter daily rent/kharcha and utility readings.</div>
                    </div>
                    <Switch
                      checked={perms.canManageUtilities}
                      onCheckedChange={(checked) => setPerms(prev => ({ ...prev, canManageUtilities: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-white">Post Announcements</div>
                      <div className="text-[10px] text-gray-400">Write and publish announcements to all residents.</div>
                    </div>
                    <Switch
                      checked={perms.canCreateAnnouncements}
                      onCheckedChange={(checked) => setPerms(prev => ({ ...prev, canCreateAnnouncements: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-white">Resolve Complaints</div>
                      <div className="text-[10px] text-gray-400">View and mark repair complaints as resolved.</div>
                    </div>
                    <Switch
                      checked={perms.canResolveComplaints}
                      onCheckedChange={(checked) => setPerms(prev => ({ ...prev, canResolveComplaints: checked }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-9 hover:bg-white/5">Cancel</Button>
            <Button onClick={handleSavePermissions} disabled={savingPerms} className="h-9 bg-[#d4af37] text-black hover:bg-[#b8962e] font-semibold">
              {savingPerms ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function PromoteAdminCard() {
  const promote = useServerFn(promoteToAdmin);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const r = await promote({ data: { email: email.trim() } });
      toast.success(`Promoted ${r.email ?? email} to admin`);
      setEmail("");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to promote");
    } finally { setBusy(false); }
  };
  return (
    <div className="bg-card border border-border/60 rounded-lg p-6 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Crown className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg">Promote user to admin</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Enter the email of an existing user. They must have signed up at /auth first.
      </p>
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <Input
          type="email"
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 min-w-[240px]"
          required
        />
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
          Promote
        </Button>
      </form>
    </div>
  );
}