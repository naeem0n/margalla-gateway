import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { KeyRound, Copy, Shield, ShieldAlert, Sparkles, Trash2, Eye, EyeOff, ClipboardCheck } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/credentials")({
  component: CredentialsPage,
});

interface AccessKey {
  id: string; // Token ID
  userId: string;
  passwordText: string;
  scope: "Resident Hub" | "Third-Party Hidden Vault";
  createdAt: string;
  status: "Active" | "Revoked";
}

const INITIAL_KEYS: AccessKey[] = [
  {
    id: "mk_res_9c28ea73b50a",
    userId: "RES-104",
    passwordText: "xP@ss9921_dr",
    scope: "Resident Hub",
    createdAt: "2026-05-18",
    status: "Active",
  },
  {
    id: "mk_vault_d83e29f0acb1",
    userId: "VND-402",
    passwordText: "K9!f#z8P*qA2",
    scope: "Third-Party Hidden Vault",
    createdAt: "2026-06-01",
    status: "Active",
  },
  {
    id: "mk_res_bf0e183fa892",
    userId: "RES-110",
    passwordText: "vL@ck8804_ch",
    scope: "Resident Hub",
    createdAt: "2026-06-10",
    status: "Active",
  },
];

function CredentialsPage() {
  const [keys, setKeys] = useState<AccessKey[]>([]);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [scope, setScope] = useState<"Resident Hub" | "Third-Party Hidden Vault">("Resident Hub");
  const [permissions, setPermissions] = useState({
    canViewInventory: true,
    canEditInventory: false,
    canViewComplaints: true,
    canResolveComplaints: false,
  });
  
  // Show/Hide password toggle per row index
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const [editingKey, setEditingKey] = useState<AccessKey | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [updatingKey, setUpdatingKey] = useState(false);

  const [residents, setResidents] = useState<any[]>([]);

  // Load keys and residents on mount
  useEffect(() => {
    const saved = localStorage.getItem("margalla_access_keys");
    if (saved) {
      try {
        setKeys(JSON.parse(saved));
      } catch (e) {
        setKeys(INITIAL_KEYS);
      }
    } else {
      setKeys(INITIAL_KEYS);
    }

    // Load residents for dropdown
    apiFetch<any>("/query-bridge", {
      method: "POST",
      body: JSON.stringify({
        table: "users",
        action: "select",
        filters: [{ column: "role", value: "resident" }]
      })
    }).then(res => {
      setResidents(Array.isArray(res.data) ? res.data : []);
    }).catch(err => {
      console.error("Failed to load residents for credentials:", err);
    });
  }, []);

  const saveKeys = (newKeys: AccessKey[]) => {
    setKeys(newKeys);
    localStorage.setItem("margalla_access_keys", JSON.stringify(newKeys));
  };

  // Helper generators
  const handleGenerateUserId = () => {
    const prefix = scope === "Resident Hub" ? "RES-" : "TP-";
    const rand = Math.floor(100 + Math.random() * 900);
    setUserId(`${prefix}${rand}`);
    toast.success("Random User ID generated");
  };

  // =========================================================================
  // ✅ NEW SMART PASSWORD GENERATOR (Username + @ + 4 Random Digits)
  // =========================================================================
  const handleGeneratePassword = (currentUsername: string) => {
    // Agar username khali ho toh default string pakray, warna space khatam karke lowercase kare
    const cleanName = currentUsername.trim() ? currentUsername.trim().toLowerCase() : 'user';
    
    // 4 random secure digits generate karega (e.g., 5824)
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    
    // Final Premium Output Format: naeem@5824
    const finalSmartPassword = `${cleanName}@${randomDigits}`;
    
    // Is state ko apne password input state variable mein set kar dein
    setPassword(finalSmartPassword);
    toast.success("Smart password generated");
  };

  // Provision key
  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUserId = userId.trim();
    if (!cleanUserId) {
      toast.error("User ID is required");
      return;
    }
    if (!password.trim()) {
      toast.error("Password is required");
      return;
    }

    const upperUserId = cleanUserId.toUpperCase();
    const mockEmail = `${upperUserId.toLowerCase()}@margalla.local`;
    const mockName = `${upperUserId} User`;

    try {
      // Register in backend SQLite database
      await apiFetch("/users/create-tenant", {
        method: "POST",
        body: JSON.stringify({
          client_id: upperUserId,
          email: mockEmail,
          full_name: mockName,
          password: password,
          role: scope === "Resident Hub" ? "resident" : "thirdparty",
          permissions_json: JSON.stringify(scope === "Resident Hub" ? {} : permissions)
        }),
      });

      const randToken = Math.random().toString(16).substring(2, 14);
      const prefix = scope === "Resident Hub" ? "mk_res_" : "mk_vault_";
      const token = `${prefix}${randToken}`;

      const newKey: AccessKey = {
        id: token,
        userId: cleanUserId,
        passwordText: password,
        scope,
        createdAt: new Date().toISOString().split("T")[0],
        status: "Active",
      };

      saveKeys([newKey, ...keys]);
      toast.success(`Access Key registered in database for ${upperUserId}`);

      // Clear form
      setUserId("");
      setPassword("");
    } catch (err: any) {
      console.error("API error during credentials provision:", err);
      toast.error(`Database Sync Error: ${err.message || "Could not register credentials in database"}`);
    }
  };

  // Revoke key
  const handleRevoke = (tokenId: string, user: string) => {
    if (window.confirm(`Are you sure you want to revoke the access key for user: ${user}? This cannot be undone.`)) {
      const updated = keys.filter((k) => k.id !== tokenId);
      saveKeys(updated);
      toast.warning(`Access key revoked for ${user}`);
    }
  };

  // Copy details clipboard
  const handleCopyDetails = (key: AccessKey) => {
    const details = `--- Margalla Gateway Access Key ---
User ID: ${key.userId}
Password: ${key.passwordText}
Scope: ${key.scope}
Access Key Token: ${key.id}
Generated At: ${key.createdAt}
Status: ${key.status}
-----------------------------------`;

    navigator.clipboard.writeText(details);
    toast.success(`Account details for ${key.userId} copied to clipboard!`, {
      icon: <ClipboardCheck className="h-4 w-4 text-success" />,
    });
  };

  const togglePasswordVisibility = (tokenId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [tokenId]: !prev[tokenId],
    }));
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKey) return;
    if (!editPassword.trim()) {
      toast.error("Password is required");
      return;
    }
    
    setUpdatingKey(true);
    const upperUserId = editingKey.userId.toUpperCase();
    const mockEmail = `${upperUserId.toLowerCase()}@margalla.local`;
    const mockName = `${upperUserId} User`;

    try {
      // Register/Update in backend SQLite database
      await apiFetch("/users/create-tenant", {
        method: "POST",
        body: JSON.stringify({
          client_id: upperUserId,
          email: mockEmail,
          full_name: mockName,
          password: editPassword,
          role: editingKey.scope === "Resident Hub" ? "resident" : "thirdparty",
          permissions_json: JSON.stringify(editingKey.scope === "Resident Hub" ? {} : permissions)
        }),
      });

      const updated = keys.map((k) =>
        k.id === editingKey.id ? { ...k, passwordText: editPassword } : k
      );
      saveKeys(updated);
      toast.success(`Password updated successfully in database for ${upperUserId}`);
      setEditOpen(false);
      setEditingKey(null);
    } catch (err: any) {
      console.error("API error during password reset:", err);
      toast.error(`Database Reset Error: ${err.message || "Could not reset password in database"}`);
    } finally {
      setUpdatingKey(false);
    }
  };

  return (
    <AdminLayout title="Access Key Provisioning Center">
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Left: Provisioning Form */}
        <div>
          <Card className="bg-card border border-border/60 shadow-elegant">
            <CardHeader>
              <CardTitle className="font-display text-xl flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" /> Provision Key
              </CardTitle>
              <CardDescription>
                Create new API credentials & access authorization profiles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProvision} className="space-y-4">
                
                {/* Scope Selection */}
                <div className="space-y-2">
                  <Label>Access Scope Profile</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setScope("Resident Hub")}
                      className={`p-3 rounded-lg border text-left flex flex-col transition-all cursor-pointer ${
                        scope === "Resident Hub"
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border/60 hover:bg-secondary/30"
                      }`}
                    >
                      <span className="text-xs font-bold text-foreground">Resident Hub</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">App access & dues portal</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setScope("Third-Party Hidden Vault")}
                      className={`p-3 rounded-lg border text-left flex flex-col transition-all cursor-pointer ${
                        scope === "Third-Party Hidden Vault"
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border/60 hover:bg-secondary/30"
                      }`}
                    >
                      <span className="text-xs font-bold text-foreground">Third-Party Vault</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">Hardware integration & logs</span>
                    </button>
                  </div>
                </div>

                {/* Resident Selection Dropdown (Only for Resident Hub) */}
                {scope === "Resident Hub" && (
                  <div className="space-y-2">
                    <Label>Select Resident Profile</Label>
                    <select
                      onChange={(e) => {
                        const res = residents.find(r => r.id === e.target.value);
                        if (res) {
                          setUserId(res.client_id || "");
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">-- Choose Resident --</option>
                      {residents.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.full_name} {r.apartment_no ? `(Apt: ${r.apartment_no})` : ""} - ID: {r.client_id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* User ID */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="userId">User ID / Username</Label>
                    <button
                      type="button"
                      onClick={handleGenerateUserId}
                      className="text-[10px] text-primary hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Sparkles className="h-3 w-3" /> Auto-Gen
                    </button>
                  </div>
                  <Input
                    id="userId"
                    placeholder="e.g. res_durrani_402"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="bg-input/40 h-9"
                    required
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password">Security Password</Label>
                    <button 
                      type="button"
                      onClick={() => handleGeneratePassword(userId)} 
                      className="bg-amber-500 text-slate-950 px-2 py-1 rounded font-bold text-xs"
                    >
                      ✨ Generate Strong
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="text"
                    placeholder="Enter or generate password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-input/40 h-9 font-mono"
                    required
                  />
                </div>

                {scope === "Third-Party Hidden Vault" && (
                  <div className="space-y-3 pt-2 border-t border-border/40">
                    <Label className="text-xs text-primary">Third-Party Permissions</Label>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-1 rounded hover:bg-secondary/30 transition-colors">
                        <Label htmlFor="canViewInventory" className="text-muted-foreground cursor-pointer flex-1">View Apartments Inventory</Label>
                        <input
                          id="canViewInventory"
                          type="checkbox"
                          checked={permissions.canViewInventory}
                          onChange={(e) => setPermissions({ ...permissions, canViewInventory: e.target.checked })}
                          className="h-4 w-4 rounded border-border bg-input/40 text-primary focus:ring-primary focus:ring-offset-background"
                        />
                      </div>
                      <div className="flex items-center justify-between p-1 rounded hover:bg-secondary/30 transition-colors">
                        <Label htmlFor="canEditInventory" className="text-muted-foreground cursor-pointer flex-1">Manage Inventory Status</Label>
                        <input
                          id="canEditInventory"
                          type="checkbox"
                          checked={permissions.canEditInventory}
                          onChange={(e) => setPermissions({ ...permissions, canEditInventory: e.target.checked })}
                          className="h-4 w-4 rounded border-border bg-input/40 text-primary focus:ring-primary focus:ring-offset-background"
                        />
                      </div>
                      <div className="flex items-center justify-between p-1 rounded hover:bg-secondary/30 transition-colors">
                        <Label htmlFor="canViewComplaints" className="text-muted-foreground cursor-pointer flex-1">View Assigned Complaints</Label>
                        <input
                          id="canViewComplaints"
                          type="checkbox"
                          checked={permissions.canViewComplaints}
                          onChange={(e) => setPermissions({ ...permissions, canViewComplaints: e.target.checked })}
                          className="h-4 w-4 rounded border-border bg-input/40 text-primary focus:ring-primary focus:ring-offset-background"
                        />
                      </div>
                      <div className="flex items-center justify-between p-1 rounded hover:bg-secondary/30 transition-colors">
                        <Label htmlFor="canResolveComplaints" className="text-muted-foreground cursor-pointer flex-1">Resolve Assigned Complaints</Label>
                        <input
                          id="canResolveComplaints"
                          type="checkbox"
                          checked={permissions.canResolveComplaints}
                          onChange={(e) => setPermissions({ ...permissions, canResolveComplaints: e.target.checked })}
                          className="h-4 w-4 rounded border-border bg-input/40 text-primary focus:ring-primary focus:ring-offset-background"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full text-xs font-semibold h-10 mt-2">
                  Provision Access Key
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right: Active Keys Registry */}
        <div className="lg:col-span-2">
          <Card className="bg-card border border-border/60 shadow-elegant h-full flex flex-col">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="font-display text-xl flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" /> Active Key Registry
                  </CardTitle>
                  <CardDescription>
                    Currently active access keys. Copy details to hand over to residents or partners.
                  </CardDescription>
                </div>
                <Badge className="bg-primary/15 text-primary border border-primary/30">
                  {keys.length} Keys
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-x-auto">
              {keys.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  No active keys provisioned. Generate one on the left.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-secondary/40 border-b border-border/40 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">User ID</th>
                      <th className="px-4 py-3">Scope / Profile</th>
                      <th className="px-4 py-3">Key Token</th>
                      <th className="px-4 py-3">Password</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 bg-card">
                    {keys.map((k) => {
                      const isPwdVisible = !!visiblePasswords[k.id];
                      return (
                        <tr key={k.id} className="hover:bg-secondary/20 transition-colors">
                          
                          {/* User ID */}
                          <td className="px-4 py-3 font-mono font-bold text-foreground">
                            {k.userId}
                          </td>
                          
                          {/* Scope */}
                          <td className="px-4 py-3">
                            <Badge
                              className={`text-[9px] px-1.5 py-0.5 border ${
                                k.scope === "Resident Hub"
                                  ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                                  : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                              }`}
                            >
                              {k.scope}
                            </Badge>
                          </td>
                          
                          {/* Key Token */}
                          <td className="px-4 py-3 font-mono text-muted-foreground text-[10px] max-w-[150px] truncate" title={k.id}>
                            {k.id}
                          </td>
                          
                          {/* Password */}
                          <td className="px-4 py-3 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span>{isPwdVisible ? k.passwordText : "••••••••"}</span>
                              <button
                                onClick={() => togglePasswordVisibility(k.id)}
                                className="text-muted-foreground hover:text-foreground p-0.5 transition-colors"
                              >
                                {isPwdVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </button>
                            </div>
                          </td>
                          
                          {/* Created */}
                          <td className="px-4 py-3 text-muted-foreground">
                            {k.createdAt}
                          </td>
                          
                          {/* Actions */}
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCopyDetails(k)}
                                className="h-7 text-[10px] px-2 flex items-center gap-1 hover:bg-primary hover:text-primary-foreground transition-all"
                                title="Copy Account Details"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Copy Details
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingKey(k);
                                  setEditPassword(k.passwordText);
                                  setEditOpen(true);
                                }}
                                className="h-7 text-[10px] px-2 flex items-center gap-1 hover:bg-amber-500 hover:text-slate-950 transition-all border-amber-500/30"
                                title="Change Password / Reset"
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                                Reset Pwd
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRevoke(k.id, k.userId)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title="Revoke Key"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Reset Password Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Reset Authorization Password
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdatePassword} className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">User ID / Client ID</Label>
              <Input value={editingKey?.userId || ""} disabled className="bg-muted font-mono mt-1" />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="editPassword">New Security Password</Label>
                <button
                  type="button"
                  onClick={() => {
                    const cleanName = editingKey?.userId.trim() ? editingKey.userId.trim().toLowerCase() : 'user';
                    const randomDigits = Math.floor(1000 + Math.random() * 9000);
                    setEditPassword(`${cleanName}@${randomDigits}`);
                    toast.success("Generated smart password");
                  }}
                  className="bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-bold text-[10px]"
                >
                  ✨ Generate Smart
                </button>
              </div>
              <Input
                id="editPassword"
                type="text"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                className="bg-input/40 mt-1 font-mono font-bold"
                required
              />
            </div>
            
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updatingKey}>
                {updatingKey ? "Saving..." : "Save Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}