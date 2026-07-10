import { createFileRoute } from "@tanstack/react-router";
import { ResidentLayout } from "@/components/resident/ResidentLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SimpleTable } from "@/components/admin/SimpleTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { requireUserWithRedirect } from "@/lib/requireUser";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api-client";

export const Route = createFileRoute("/resident/complaints")({ component: Page });

type Row = { id: string; title: string; category: string; status: string; created_at: string };

function Page() {
  const { user, isResident } = useAuth();
  const { profile } = useProfile();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("maintenance");
  const [priority, setPriority] = useState("normal");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      if (!user) return;
      const { data, error } = await supabase
        .from("complaints")
        .select("id,title,category,status,created_at")
        .eq("resident_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows((data ?? []) as Row[]);
    } catch (e: any) {
      console.error("Load resident complaints failed, trying local fallback:", e);
      try {
        const res = await apiFetch<{ complaints: any[] }>("/complaints");
        if (res && res.complaints) {
          setRows(res.complaints.map((c) => ({
            id: c.id,
            title: c.title,
            category: c.category,
            status: c.status,
            created_at: c.created_at,
          })));
        }
      } catch (localErr) {
        console.error("Local complaints load failed:", localErr);
        toast.error("Could not load complaints — try again later");
      }
    }
  };
  useEffect(() => {
    load();
    if (!user) return;

    const channel = supabase
      .channel("complaints-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "complaints", filter: `resident_id=eq.${user.id}` },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const submit = async () => {
    const userId = await requireUserWithRedirect();
    if (!userId) return;
    if (!isResident) { toast.error("Resident role required"); return; }
    if (!title.trim()) return toast.error("Title is required");
    setSaving(true);
    try {
      try {
        const { error } = await supabase.from("complaints").insert({
          resident_id: userId,
          apartment_no: profile?.apartment_no ?? null,
          title: title.trim(),
          category,
          priority,
          description: description.trim() || null,
          status: "open",
        });
        if (error) throw error;
      } catch (dbErr) {
        console.warn("Database insert failed, trying local fallback:", dbErr);
        await apiFetch("/complaints", {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            category,
            priority,
            description: description.trim() || null,
          }),
        });
      }
      setSaving(false);
      toast.success("Complaint submitted");
      setTitle(""); setDescription(""); setCategory("maintenance"); setPriority("normal");
      load();
    } catch (e: any) {
      console.error("Submit complaint failed:", e);
      toast.error("Could not submit complaint — try again");
      setSaving(false);
    }
  };

  return (
    <ResidentLayout title="My Complaints">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-card border border-border/60 rounded-lg p-6">
          <h3 className="font-display text-xl mb-4">New Complaint</h3>
          <div className="space-y-3">
            <div><Label>Title</Label><Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="cleaning">Cleaning</SelectItem>
                  <SelectItem value="parking">Parking</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Textarea rows={4} className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <Button className="w-full bg-primary text-primary-foreground" onClick={submit} disabled={saving}>
              {saving ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </div>
        <div className="lg:col-span-2">
          {rows.length === 0 ? (
            <div className="bg-card border border-border/60 rounded-lg p-10 text-center text-sm text-muted-foreground">
              You haven't submitted any complaints yet.
            </div>
          ) : (
            <SimpleTable
              rows={rows.map((r) => ({
                id: String(r.id).slice(0, 8).toUpperCase(),
                title: r.title,
                category: r.category,
                date: format(new Date(r.created_at), "dd MMM"),
                status: r.status,
              }))}
              columns={[
                { key: "id", label: "Ticket" },
                { key: "title", label: "Issue" },
                { key: "category", label: "Category" },
                { key: "date", label: "Date" },
                { key: "status", label: "Status" },
              ]}
            />
          )}
        </div>
      </div>
    </ResidentLayout>
  );
}
