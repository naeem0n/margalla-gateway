import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import React, { useState, useEffect, FormEvent } from "react";
import { Building2, Shield, Search, Loader2, LogOut, MessageSquare, ClipboardList, CheckCircle2, ShieldAlert, KeyRound, ArrowLeft, Home, RefreshCw, Lock } from "lucide-react";
import { apiLogin, apiMe, apiFetch, getToken, isDesktopApp, apiChangeInitialPassword } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/thirdparty")({
  beforeLoad: () => {
    if (!isDesktopApp()) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({ meta: [{ title: "Third-Party Portal — Margalla Gateway" }] }),
  component: ApartmentManager,
});

type InventoryItem = {
  name: string;
  present: boolean;
};

type ApartmentData = {
  id: string;
  unit: string;
  tenant: string;
  status: string;
  inventory: InventoryItem[];
};

export function ApartmentManager() {
  // Authentication states
  const [authed, setAuthed] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [apiUser, setApiUser] = useState<any>(null);

  // Login form states
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [changePasswordState, setChangePasswordState] = useState<{ userId: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Portal states
  const [apartments, setApartments] = useState<ApartmentData[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"inventory" | "complaints">("inventory");

  // Permissions state
  const [perms, setPerms] = useState({
    canViewInventory: false,
    canEditInventory: false,
    canViewComplaints: false,
    canResolveComplaints: false,
  });

  // Complaint resolving states
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolvingComplaint, setResolvingComplaint] = useState<any>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [submittingResolution, setSubmittingResolution] = useState(false);

  const checkAuth = async () => {
    setCheckingAuth(true);
    const token = getToken();
    if (token) {
      try {
        const { user } = await apiMe();
        if (user && user.role === "thirdparty") {
          handleAuthSuccess(user);
        } else {
          setAuthed(false);
        }
      } catch (err) {
        console.error("Session verification failed:", err);
        setAuthed(false);
      }
    } else {
      setAuthed(false);
    }
    setCheckingAuth(false);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleAuthSuccess = (user: any) => {
    setApiUser(user);
    setAuthed(true);
    
    let parsedPerms = {
      canViewInventory: false,
      canEditInventory: false,
      canViewComplaints: false,
      canResolveComplaints: false,
    };

    if (user.permissions_json) {
      try {
        const parsed = typeof user.permissions_json === "string" ? JSON.parse(user.permissions_json) : user.permissions_json;
        parsedPerms = {
          canViewInventory: !!parsed.canViewInventory,
          canEditInventory: !!parsed.canEditInventory,
          canViewComplaints: !!parsed.canViewComplaints,
          canResolveComplaints: !!parsed.canResolveComplaints,
        };
      } catch (e) {
        console.error("Failed to parse permissions", e);
      }
    } else {
      // Fallback/Default if no permissions json is stored
      parsedPerms = {
        canViewInventory: true,
        canEditInventory: true,
        canViewComplaints: true,
        canResolveComplaints: true,
      };
    }

    setPerms(parsedPerms);
    if (!parsedPerms.canViewInventory && parsedPerms.canViewComplaints) {
      setActiveTab("complaints");
    } else {
      setActiveTab("inventory");
    }
  };

  // Trigger loading based on tab selection & authorization
  useEffect(() => {
    if (!authed) return;
    if (activeTab === "inventory" && perms.canViewInventory) {
      loadApartments();
    } else if (activeTab === "complaints" && perms.canViewComplaints) {
      loadComplaints();
    }
  }, [authed, activeTab, perms]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !password.trim()) {
      toast.error("Please enter credentials");
      return;
    }
    setBusy(true);
    try {
      const { user } = await apiLogin(loginId.trim(), password, "thirdparty");
      if (user.role !== "thirdparty") {
        toast.error("Invalid portal credentials");
        return;
      }
      toast.success("Connected to Margalla Gateway Vault");
      setAuthed(true);
    } catch (err: any) {
      if (err.message === "REQUIRE_PASSWORD_CHANGE") {
        setChangePasswordState({ userId: err.user_id });
      } else {
        toast.error(err instanceof Error ? err.message : "Authentication failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      await apiChangeInitialPassword(changePasswordState!.userId, password, newPassword);
      toast.success("Password updated successfully.");
      setAuthed(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("mgt_api_token");
    setAuthed(false);
    setApiUser(null);
    setApartments([]);
    setComplaints([]);
    toast.success("Logged out successfully");
  };

  const loadApartments = async () => {
    setLoading(true);
    try {
      // Fetch from direct fetch/Express endpoint
      const apiBase = (window as any).margallaDesktop?.apiBase || "http://localhost:3847/api";
      const token = getToken();
      const res = await fetch(`${apiBase}/thirdparty/apartments`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setApartments(data || []);
      }
    } catch (err) {
      console.error("Failed to load apartments:", err);
      toast.error("Could not load apartments list");
    } finally {
      setLoading(false);
    }
  };

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ complaints: any[] }>("/complaints");
      setComplaints(res.complaints ?? []);
    } catch (err) {
      console.error("Failed to load complaints:", err);
      toast.error("Could not load assigned complaints");
    } finally {
      setLoading(false);
    }
  };

  const toggleInventoryItem = (aptId: string, itemIdx: number) => {
    if (!perms.canEditInventory) {
      toast.error("You do not have permission to modify inventory");
      return;
    }
    setApartments(prev => prev.map(apt => {
      if (apt.id === aptId) {
        const updatedInv = [...apt.inventory];
        updatedInv[itemIdx] = { ...updatedInv[itemIdx], present: !updatedInv[itemIdx].present };
        toast.info(`Updated asset: ${updatedInv[itemIdx].name} -> ${updatedInv[itemIdx].present ? "Present" : "Missing"}`);
        return { ...apt, inventory: updatedInv };
      }
      return apt;
    }));
  };

  const openResolveDialog = (complaint: any) => {
    setResolvingComplaint(complaint);
    setResolutionNotes("");
    setResolveOpen(true);
  };

  const handleResolve = async () => {
    if (!resolvingComplaint) return;
    setSubmittingResolution(true);
    try {
      await apiFetch(`/complaints/${resolvingComplaint.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "resolved",
          resolution: resolutionNotes || "Resolved by third-party partner.",
        })
      });
      toast.success("Complaint resolved successfully");
      setResolveOpen(false);
      loadComplaints();
    } catch (e: any) {
      toast.error(e.message || "Failed to update complaint");
    } finally {
      setSubmittingResolution(false);
    }
  };

  // Filtering apartments
  const filteredData = apartments.filter((apt) => {
    const matchesSearch =
      (apt.unit || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (apt.tenant || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === "All" || apt.status === filter;
    return matchesSearch && matchesFilter;
  });

  // Render checking auth loader
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="text-sm text-gray-400">Verifying partner portal credentials...</p>
      </div>
    );
  }

  if (changePasswordState) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-6 shadow-2xl relative z-10">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Set New Password</h1>
            <p className="text-sm text-gray-400">Please change your temporary password.</p>
          </div>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-300">New Password</Label>
              <Input type="password" minLength={8} className="bg-gray-950 border-gray-800 focus:border-amber-500/50" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-300">Confirm Password</Label>
              <Input type="password" minLength={8} className="bg-gray-950 border-gray-800 focus:border-amber-500/50" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-amber-500 hover:bg-amber-600 text-gray-950 font-semibold h-11 rounded-lg">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : "Update Password & Login"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Render Login Card if not authenticated
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4 relative overflow-hidden font-sans">
        <Link to="/" className="absolute top-4 left-4 inline-flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 z-10 cursor-pointer">
          <ArrowLeft className="h-3.5 w-3.5 text-amber-500" />
          <span>Back to Home</span>
        </Link>

        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-6 shadow-2xl relative z-10">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 mb-2">
              <KeyRound className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-wide text-white">MARGALLA GATEWAY</h2>
            <p className="text-xs text-amber-500 uppercase tracking-widest font-bold">Third-Party Partner Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="loginId" className="text-xs text-gray-400">Partner ID / Client ID</Label>
              <Input
                id="loginId"
                type="text"
                placeholder="e.g. TP-001"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="bg-gray-950 border-gray-800 focus:border-amber-500 text-white font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs text-gray-400">Portal Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-gray-950 border-gray-800 focus:border-amber-500 text-white"
                required
              />
            </div>

            <Button type="submit" disabled={busy} className="w-full bg-amber-500 hover:bg-amber-600 text-gray-950 font-semibold h-11">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Connecting...</> : "Open Portal"}
            </Button>
            
            <Link to="/" className="w-full inline-flex items-center justify-center gap-2 border border-gray-800 bg-gray-950 text-gray-400 hover:text-white hover:bg-gray-900 font-semibold rounded-lg h-11 text-sm transition-colors cursor-pointer">
              <Home className="h-4 w-4 text-amber-500" />
              <span>Go Back to Home Page</span>
            </Link>
          </form>

          <p className="text-center text-[10px] text-gray-500">
            Please request login credentials from the Margalla Gateway Administration center.
          </p>
        </div>
      </div>
    );
  }

  // Main Dashboard Render
  return (
    <div className="p-6 bg-gray-950 text-white min-h-screen font-sans">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 pb-4 border-b border-gray-800 gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-amber-500" />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-wide">MARGALLA GATEWAY</h1>
            <p className="text-xs text-amber-500 font-semibold tracking-widest uppercase">Third-Party Partner Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="text-right">
            <div className="text-sm font-semibold">{apiUser?.full_name || "Partner Client"}</div>
            <div className="text-[10px] text-gray-400 font-mono">{apiUser?.client_id}</div>
          </div>
          <button
            onClick={handleLogout}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-800 bg-gray-900 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs selector */}
      <div className="flex border-b border-gray-800 mb-6 gap-2">
        {perms.canViewInventory && (
          <button
            onClick={() => setActiveTab("inventory")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "inventory" ? "border-amber-500 text-amber-500" : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Apartments Inventory
          </button>
        )}
        {perms.canViewComplaints && (
          <button
            onClick={() => setActiveTab("complaints")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "complaints" ? "border-amber-500 text-amber-500" : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Assigned Work Orders
          </button>
        )}
      </div>

      {/* RENDER ACTIVE TAB */}

      {/* 1. Apartments Inventory Tab */}
      {activeTab === "inventory" && perms.canViewInventory && (
        <>
          {/* Search/Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-gray-900 p-4 rounded-lg mb-6 border border-gray-800">
            <div className="flex-1 relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search unit, tenant, or assets..."
                className="w-full bg-gray-950 border border-gray-800 pl-10 pr-4 py-2 rounded focus:outline-none focus:border-amber-500 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex bg-gray-950 p-1 rounded border border-gray-800 self-start sm:self-auto">
              {["All", "Available", "Occupied"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-1 text-xs font-semibold rounded transition-all cursor-pointer ${
                    filter === status ? "bg-amber-500 text-black shadow" : "text-gray-400 hover:text-white"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Grid list */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <p className="text-sm text-gray-400">Loading apartments inventory...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-gray-800 rounded-lg">
              <p className="text-gray-500 text-sm">No apartments found matching search or filter criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredData.map((apt) => (
                <div key={apt.id} className="bg-gray-900 p-5 rounded-lg border border-gray-800 hover:border-amber-500/30 transition-all duration-300">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-gray-100">Unit: {apt.unit}</h3>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      apt.status === "Occupied" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"
                    }`}>
                      {apt.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">Tenant: <span className="text-gray-300 font-semibold">{apt.tenant}</span></p>

                  {/* Inventory List */}
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <h4 className="text-xs text-amber-500 uppercase tracking-wider mb-2 font-semibold">Inventory Assets</h4>
                    <ul className="text-sm space-y-1">
                      {apt.inventory.map((item, idx) => (
                        <li key={idx} className="flex justify-between items-center py-2 border-b border-gray-800/40 last:border-b-0">
                          <span className="text-gray-300">{item.name}</span>
                          {perms.canEditInventory ? (
                            <button
                              onClick={() => toggleInventoryItem(apt.id, idx)}
                              className={`text-xs font-semibold px-2 py-1 rounded transition-colors cursor-pointer ${
                                item.present 
                                  ? "bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20" 
                                  : "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                              }`}
                            >
                              {item.present ? "✓ Present" : "✗ Missing"}
                            </button>
                          ) : (
                            <span className={`font-semibold ${item.present ? "text-green-500" : "text-red-500"}`}>
                              {item.present ? "✓ Present" : "✗ Missing"}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 2. Complaints Board Tab */}
      {activeTab === "complaints" && perms.canViewComplaints && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold">Assigned Complaints</h2>
              <p className="text-xs text-gray-400">Total: {complaints.length} tickets assigned to your organization</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadComplaints} className="border-gray-800 hover:bg-gray-800 hover:text-white cursor-pointer">
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin mr-2 text-amber-500" />
              Loading work orders...
            </div>
          ) : complaints.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-800 rounded text-gray-500">
              No active work orders assigned to you.
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-800 rounded">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-950 text-xs text-gray-400 uppercase">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Task Details</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 bg-gray-900/50">
                  {complaints.map(c => (
                    <tr key={c.id} className="hover:bg-gray-800/40">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">#{String(c.id).slice(0, 8)}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-200">{c.title}</div>
                        {c.description && <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{c.description}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{c.category}</td>
                      <td className="px-4 py-3 text-gray-300">{c.apartment_no || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          c.priority === "urgent" || c.priority === "high"
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-gray-800 text-gray-400"
                        }`}>
                          {c.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          c.status === "resolved" 
                            ? "bg-green-500/10 text-green-400" 
                            : c.status === "in_progress" 
                            ? "bg-blue-500/10 text-blue-400" 
                            : "bg-yellow-500/10 text-yellow-400"
                        }`}>
                          {c.status === "open" ? "Pending" : c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.status !== "resolved" && c.status !== "closed" ? (
                          perms.canResolveComplaints ? (
                            <Button
                              size="sm"
                              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold h-8 cursor-pointer"
                              onClick={() => openResolveDialog(c)}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Resolve
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-500">No permission to edit</span>
                          )
                        ) : (
                          <span className="text-xs text-green-500 flex items-center justify-end gap-1 font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* RESOLUTION DIALOG */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="bg-gray-900 border border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-amber-500" /> Resolve Complaint
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <div className="text-xs text-gray-400 uppercase">Complaint</div>
              <div className="font-semibold text-sm text-gray-200">{resolvingComplaint?.title}</div>
              {resolvingComplaint?.description && <p className="text-xs text-gray-400 mt-1">{resolvingComplaint.description}</p>}
            </div>
            <div>
              <Label className="text-xs text-gray-400 block mb-1">Resolution Action / Notes *</Label>
              <Textarea
                rows={3}
                placeholder="Describe what repair actions were taken..."
                value={resolutionNotes}
                onChange={e => setResolutionNotes(e.target.value)}
                className="bg-gray-950 border-gray-800 focus:border-amber-500"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)} className="border-gray-800 text-white hover:bg-gray-800 hover:text-white cursor-pointer">Cancel</Button>
            <Button onClick={handleResolve} disabled={submittingResolution || !resolutionNotes.trim()} className="bg-amber-500 text-black hover:bg-amber-600 font-bold cursor-pointer">
              {submittingResolution ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark Resolved"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
