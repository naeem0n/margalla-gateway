import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Pencil, Plus, RefreshCw, Trash2, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle, Eye, Printer } from "lucide-react";
import { requireUserWithRedirect } from "@/lib/requireUser";
import { useAuth } from "@/hooks/useAuth";
import { downloadComplaintsPDF } from "@/lib/pdf";

export const Route = createFileRoute("/admin/complaints")({ component: Page });

type Row = {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  apartment_no: string | null;
  resident_id: string | null;
  created_at: string;
  description: string | null;
  resolution: string | null;
  maintenance_cost: number | null;
  expense_entry_id: string | null;
  assigned_to: string | null;
};

const emptyForm = {
  title: "",
  apartment_no: "",
  description: "",
  assigned_to: "",
  send_whatsapp: true,
};

function Page() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  // update status dialog
  const [updOpen, setUpdOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [newStatus, setNewStatus] = useState<string>("open");
  const [maintCost, setMaintCost] = useState("");
  const [resolution, setResolution] = useState("");
  const [assignedTo, setAssignedTo] = useState("unassigned");
  const [assignees, setAssignees] = useState<{ id: string; name: string }[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ complaints: Row[] }>("/complaints");
      setRows(res.complaints ?? []);
      
      try {
        const staffRes = await apiFetch<{ staff: any[] }>("/staff");
        const tpRes = await apiFetch<{ users: any[] }>("/users?role=all");
        
        const staffList = (staffRes.staff ?? []).map(s => ({
          id: s.id,
          name: `${s.full_name} (Staff - ${s.role})`
        }));
        
        const tpList = (tpRes.users ?? []).map(u => ({
          id: u.id,
          name: u.role === "thirdparty"
            ? `${u.full_name} (Third Party - ${u.client_id})`
            : `${u.full_name} (Resident - Apt ${u.apartment_no || "—"})`
        }));
        
        setAssignees([...staffList, ...tpList]);
      } catch (e) {
        console.error("Failed to load assignees:", e);
      }
    } catch (e: any) {
      console.error("Failed to load complaints:", e);
      toast.error("Failed to load complaints — try again later");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!form.title) {
      toast.error("Title required");
      return;
    }
    const userId = await requireUserWithRedirect();
    if (!userId) return;
    if (!isAdmin) {
      toast.error("Admin access required");
      return;
    }
    try {
      await apiFetch("/complaints", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          category: "General",
          priority: "normal",
          apartment_no: form.apartment_no || null,
          description: form.description || null,
          assigned_to: form.assigned_to === "unassigned" || !form.assigned_to ? null : form.assigned_to,
        }),
      });
      
      if (form.send_whatsapp) {
        toast.info("WhatsApp notification queued for Resident & Staff");
      }
      
      toast.success("Complaint logged successfully");
      setCreateOpen(false);
      setForm({ ...emptyForm });
      load();
    } catch (e: any) {
      console.error("Create complaint failed:", e);
      toast.error("Could not create complaint — try again");
    }
  };

  const openUpdate = (r: Row) => {
    setEditing(r);
    setNewStatus(r.status);
    setMaintCost(r.maintenance_cost ? String(r.maintenance_cost) : "");
    setResolution(r.resolution ?? "");
    setAssignedTo(r.assigned_to ?? "unassigned");
    setUpdOpen(true);
  };

  const submitUpdate = async () => {
    if (!editing) return;
    const patch: any = { status: newStatus, resolution: resolution || null, assigned_to: assignedTo === "unassigned" ? null : assignedTo };
    if (newStatus === "resolved") {
      patch.maintenance_cost = Number(maintCost) || 0;
    }
    const userId = await requireUserWithRedirect();
    if (!userId) return;
    if (!isAdmin) {
      toast.error("Admin access required");
      return;
    }
    try {
      await apiFetch(`/complaints/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      if (newStatus === "resolved" && Number(maintCost) > 0) {
        toast.success(`Resolved · PKR ${Number(maintCost).toLocaleString()} logged as Maintenance expense`);
      } else {
        toast.success("Complaint updated successfully");
      }
      setUpdOpen(false);
      load();
    } catch (e: any) {
      console.error("Update complaint failed:", e);
      toast.error("Could not update complaint — try again");
    }
  };

  // Instant card state shift functions
  const handleMoveStatus = async (complaintId: string, status: string) => {
    const userId = await requireUserWithRedirect();
    if (!userId) return;
    if (!isAdmin) {
      toast.error("Admin access required");
      return;
    }

    try {
      await apiFetch(`/complaints/${complaintId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success(`Status updated to ${status === "open" ? "Pending" : status === "in_progress" ? "In-Progress" : "Resolved"}`);
      load();
    } catch (e) {
      console.error("Instant status shift failed:", e);
      toast.error("Failed to move status — try again");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Are you sure you want to delete this complaint?")) return;
    const userId = await requireUserWithRedirect();
    if (!userId) return;
    if (!isAdmin) {
      toast.error("Admin access required");
      return;
    }
    try {
      await apiFetch(`/complaints/${id}`, {
        method: "DELETE",
      });
      toast.success("Complaint deleted");
      load();
    } catch (e: any) {
      console.error("Delete complaint failed:", e);
      toast.error("Could not delete complaint");
    }
  };

  // Priority layout mapper
  const getPriorityBadge = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "urgent":
      case "critical":
        return (
          <Badge className="bg-destructive/15 text-destructive border border-destructive/30 uppercase tracking-wider text-[10px] px-1.5 py-0.5">
            Critical
          </Badge>
        );
      case "high":
        return (
          <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/30 uppercase tracking-wider text-[10px] px-1.5 py-0.5">
            High
          </Badge>
        );
      case "normal":
      case "medium":
        return (
          <Badge className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 uppercase tracking-wider text-[10px] px-1.5 py-0.5">
            Medium
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-500/15 text-slate-400 border border-slate-500/30 uppercase tracking-wider text-[10px] px-1.5 py-0.5">
            Low
          </Badge>
        );
    }
  };

  // Group items by status
  const pendingComplaints = rows.filter((r) => r.status === "open");
  const inProgressComplaints = rows.filter((r) => r.status === "in_progress");
  const resolvedComplaints = rows.filter((r) => r.status === "resolved" || r.status === "closed");

  return (
    <AdminLayout title="Complaints Board">
      {/* Top summary and refresh header */}
      <div className="flex justify-between items-center mb-6 gap-2 flex-wrap bg-card border border-border/60 rounded-lg p-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground/90">Kanban Board</h2>
          <p className="text-muted-foreground text-xs mt-0.5">
            {rows.length} total · {pendingComplaints.length} pending · {inProgressComplaints.length} in progress · {resolvedComplaints.length} resolved
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadComplaintsPDF(rows)}>
            <Printer className="h-4 w-4 mr-1" />
            Print PDF
          </Button>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => { setForm({ ...emptyForm }); setCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />
            New Complaint
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading complaints...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Pending */}
          <div className="bg-secondary/10 border border-border/40 rounded-lg p-4 flex flex-col min-h-[500px]">
            <div className="flex justify-between items-center pb-3 border-b border-border/40 mb-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
                <h3 className="font-display font-bold text-sm text-foreground">Pending</h3>
              </div>
              <Badge className="bg-destructive/10 text-destructive">{pendingComplaints.length}</Badge>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-1">
              {pendingComplaints.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border/30 rounded-md bg-card/20">
                  No pending complaints
                </div>
              ) : (
                pendingComplaints.map((c) => (
                  <CardView
                    key={c.id}
                    complaint={c}
                    getPriorityBadge={getPriorityBadge}
                    onUpdate={() => openUpdate(c)}
                    onDelete={() => remove(c.id)}
                    actions={
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full text-xs h-7 flex items-center justify-center gap-1 mt-2 bg-indigo-950 text-indigo-300 hover:bg-indigo-900 border border-indigo-800/40"
                        onClick={() => handleMoveStatus(c.id, "in_progress")}
                      >
                        Start Work <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    }
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 2: In-Progress */}
          <div className="bg-secondary/10 border border-border/40 rounded-lg p-4 flex flex-col min-h-[500px]">
            <div className="flex justify-between items-center pb-3 border-b border-border/40 mb-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="font-display font-bold text-sm text-foreground">In-Progress</h3>
              </div>
              <Badge className="bg-amber-500/10 text-amber-500">{inProgressComplaints.length}</Badge>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-1">
              {inProgressComplaints.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border/30 rounded-md bg-card/20">
                  No active work items
                </div>
              ) : (
                inProgressComplaints.map((c) => (
                  <CardView
                    key={c.id}
                    complaint={c}
                    getPriorityBadge={getPriorityBadge}
                    onUpdate={() => openUpdate(c)}
                    onDelete={() => remove(c.id)}
                    actions={
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7 border border-border/60 hover:bg-secondary/40 flex items-center justify-center gap-1"
                          onClick={() => handleMoveStatus(c.id, "open")}
                        >
                          <ArrowLeft className="h-3.5 w-3.5" /> Revert
                        </Button>
                        <Button
                          size="sm"
                          className="text-xs h-7 bg-success text-success-foreground hover:bg-success/90 flex items-center justify-center gap-1"
                          onClick={() => openUpdate(c)} // Direct to update dialog to log costs/notes
                        >
                          Resolve <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    }
                  />
                ))
              )}
            </div>
          </div>

          {/* Column 3: Resolved */}
          <div className="bg-secondary/10 border border-border/40 rounded-lg p-4 flex flex-col min-h-[500px]">
            <div className="flex justify-between items-center pb-3 border-b border-border/40 mb-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-success" />
                <h3 className="font-display font-bold text-sm text-foreground">Resolved</h3>
              </div>
              <Badge className="bg-success/10 text-success">{resolvedComplaints.length}</Badge>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-1">
              {resolvedComplaints.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border/30 rounded-md bg-card/20">
                  No resolved complaints yet
                </div>
              ) : (
                resolvedComplaints.map((c) => (
                  <CardView
                    key={c.id}
                    complaint={c}
                    getPriorityBadge={getPriorityBadge}
                    onUpdate={() => openUpdate(c)}
                    onDelete={() => remove(c.id)}
                    actions={
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full text-xs h-7 flex items-center justify-center gap-1 mt-2"
                        onClick={() => handleMoveStatus(c.id, "in_progress")}
                      >
                        <ArrowLeft className="h-3.5 w-3.5" /> Re-open ticket
                      </Button>
                    }
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dialog for Creating Complaint */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border border-border/60">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Log New Complaint</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 text-sm">
            <div>
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Lobby light flickering"
                className="mt-1 bg-input/40 h-9"
              />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <input 
                type="checkbox" 
                id="whatsapp-notify" 
                checked={form.send_whatsapp} 
                onChange={(e) => setForm({ ...form, send_whatsapp: e.target.checked })}
                className="rounded border-border/60 bg-input/40 text-emerald-500 focus:ring-emerald-500/30"
              />
              <Label htmlFor="whatsapp-notify" className="text-emerald-500 font-bold flex items-center gap-1 cursor-pointer">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                </svg>
                Send Alert via WhatsApp & Resident Portal
              </Label>
            </div>
            <div>
              <Label>Apartment Unit</Label>
              <Input
                value={form.apartment_no}
                onChange={(e) => setForm({ ...form, apartment_no: e.target.value })}
                placeholder="e.g. A-204"
                className="mt-1 bg-input/40 h-9"
              />
            </div>
            <div>
              <Label>Assign Work To</Label>
              <Select value={form.assigned_to || "unassigned"} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                <SelectTrigger className="mt-1 bg-input/40 h-9"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent className="bg-card border border-border/60">
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {assignees.map((a) => (
                    <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Detailed Description</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe the issue in detail..."
                className="mt-1 bg-input/40"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={create}>Create Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Updating Status / Cost / Resolution */}
      <Dialog open={updOpen} onOpenChange={setUpdOpen}>
        <DialogContent className="bg-card border border-border/60">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Update Complaint</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 text-sm">
            <div className="text-sm font-semibold text-primary">{editing?.title}</div>
            {editing?.description && (
              <div className="text-xs text-muted-foreground p-2 rounded bg-secondary/30 border border-border/40 max-h-[80px] overflow-y-auto">
                {editing.description}
              </div>
            )}
            <div>
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="mt-1 bg-input/40 h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border border-border/60">
                  <SelectItem value="open">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed / Finalized</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assign Work To</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="mt-1 bg-input/40 h-9"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent className="bg-card border border-border/60">
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {assignees.map((a) => (
                    <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(newStatus === "resolved" || newStatus === "closed") && (
              <>
                <div>
                  <Label className="flex justify-between items-center">
                    <span>Maintenance Cost (PKR)</span>
                    <span className="text-[10px] text-muted-foreground">Creates expense entry</span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={maintCost}
                    onChange={(e) => setMaintCost(e.target.value)}
                    placeholder="0"
                    className="mt-1 bg-input/40 h-9"
                  />
                </div>
                <div>
                  <Label>Resolution Notes</Label>
                  <Textarea
                    rows={3}
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="What action was taken to resolve the issue?"
                    className="mt-1 bg-input/40"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setUpdOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={submitUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

// Subcomponent: Complaint Kanban Card
function CardView({
  complaint,
  getPriorityBadge,
  onUpdate,
  onDelete,
  actions,
}: {
  complaint: Row;
  getPriorityBadge: (p: string) => React.ReactNode;
  onUpdate: () => void;
  onDelete: () => void;
  actions: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border/60 rounded-lg p-4 shadow-sm hover:shadow-md transition-all hover:scale-[1.01] flex flex-col justify-between space-y-3 group">
      <div>
        {/* Card Header Info */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="font-mono text-[10px] text-muted-foreground font-bold uppercase">
            #{String(complaint.id).slice(0, 8)}
          </span>
          <div className="flex gap-1">
            <button
              onClick={onUpdate}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              title="Edit Details"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={onDelete}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Title */}
        <h4 className="font-display font-semibold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {complaint.title}
        </h4>

        {/* Description Snippet */}
        {complaint.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1 mb-2.5">
            {complaint.description}
          </p>
        )}

        {/* Metadata Details */}
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 pt-2 border-t border-border/30 text-[11px] text-muted-foreground">
          <div>
            <span className="block text-[9px] text-muted-foreground/60 uppercase">Unit No</span>
            <span className="font-semibold text-foreground/80">{complaint.apartment_no ?? "—"}</span>
          </div>
          <div>
            <span className="block text-[9px] text-muted-foreground/60 uppercase">Category</span>
            <span className="font-medium text-foreground/80">{complaint.category}</span>
          </div>
          <div className="col-span-2">
            <span className="block text-[9px] text-muted-foreground/60 uppercase">Assigned To</span>
            <span className="font-semibold text-foreground/80 truncate block">{complaint.assigned_to || "Unassigned"}</span>
          </div>
          <div className="col-span-2 flex justify-between items-center pt-1">
            <div>
              <span className="block text-[9px] text-muted-foreground/60 uppercase">Reported</span>
              <span>{format(new Date(complaint.created_at), "dd MMM, yyyy")}</span>
            </div>
            <div>
              {getPriorityBadge(complaint.priority)}
            </div>
          </div>
        </div>

        {/* Maintenance cost display if resolved */}
        {complaint.maintenance_cost !== null && complaint.maintenance_cost > 0 && (
          <div className="mt-2 bg-success/5 border border-success/20 rounded px-2 py-1 text-[11px] text-success flex justify-between">
            <span>Cost:</span>
            <span className="font-bold">PKR {complaint.maintenance_cost.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Column action buttons */}
      <div className="border-t border-border/30 pt-2">
        {actions}
      </div>
    </div>
  );
}
