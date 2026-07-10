import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { requireUserWithRedirect } from "@/lib/requireUser";
import { useAuth } from "@/hooks/useAuth";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/announcements")({
  component: AnnouncementsPage,
});

/* ─── Types ─────────────────────────────────────────────── */
type Announcement = {
  id: string;
  title: string;
  message: string;
  posted_by: string | null;
  created_at: string;
};

/* ─── Page ───────────────────────────────────────────────── */
function AnnouncementsPage() {
  const { isAdmin } = useAuth();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  /* ── Fetch ── */
  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      const mapped = (data || []).map((ann: any) => ({
        id: ann.id,
        title: ann.title,
        message: ann.body,
        posted_by: ann.created_by,
        created_at: ann.created_at,
      }));
      
      setRows(mapped);
    } catch (err) {
      console.error("Fetch error bypassed safely.");
    }
  };

  useEffect(() => { fetchAnnouncements(); }, []);

  /* ── Post ── */
  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setStatusMsg("🚨 Title aur Message dono hath se put karein ustad ge!");
      return;
    }
    setLoading(true);
    setStatusMsg("");
    try {
      const userId = await requireUserWithRedirect();
      if (!userId) { setLoading(false); return; }
      if (!isAdmin) { setStatusMsg("🚨 Admin access required."); setLoading(false); return; }

      const { error } = await supabase
        .from("announcements")
        .insert([{ title: title.trim(), body: message.trim(), created_by: "System Admin" }]);

      if (error) throw error;

      setStatusMsg("✅ Announcement posted and synced directly to Cloud!");
      setTitle("");
      setMessage("");
      fetchAnnouncements();
    } catch (err: any) {
      setStatusMsg(`🚨 Sync Error: ${err.message || "Communication block"}`);
    } finally {
      setLoading(false);
    }
  };

  /* ── Delete ── */
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    try {
      const userId = await requireUserWithRedirect();
      if (!userId) return;
      if (!isAdmin) { setStatusMsg("🚨 Admin access required."); return; }
      const { error } = await supabase
        .from("announcements")
        .delete()
        .eq("id", id);
      if (error) throw error;
      fetchAnnouncements();
    } catch (err: any) {
      setStatusMsg(`🚨 Delete Error: ${err.message}`);
    }
  };

  /* ─── Render ─────────────────────────────────────────── */
  return (
    <AdminLayout title="Announcements">

      {/* ── Header ── */}
      <div className="border-b border-slate-800 pb-4 mb-6">
        <h1 className="text-xl font-black text-yellow-500 tracking-wide">
          📢 TOWER BROADCAST & ANNOUNCEMENTS CONTROL
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Yahan se post kiya hua message direct resident portals par active show hoga.
        </p>
      </div>

      {/* ── Status Banner ── */}
      {statusMsg && (
        <div
          className={`mb-4 p-3 rounded-xl border text-xs font-bold font-mono ${
            statusMsg.includes("✅")
              ? "bg-emerald-950/50 border-emerald-500 text-emerald-400"
              : "bg-rose-950/50 border-rose-500 text-rose-400"
          }`}
        >
          {statusMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT: NEW ANNOUNCEMENT FORM ── */}
        <div className="bg-card border border-border/60 p-5 rounded-2xl space-y-4 h-fit shadow-sm">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            📢 New Announcement Layout
          </h3>

          <form onSubmit={handlePost} className="space-y-4 text-xs font-semibold">
            {/* Title */}
            <div>
              <label className="text-muted-foreground block mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-background border border-border rounded-xl p-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-yellow-500/40 transition"
                placeholder="e.g., Water Supply Maintenance Notice"
              />
            </div>

            {/* Message */}
            <div>
              <label className="text-muted-foreground block mb-1">Message</label>
              <textarea
                rows={6}
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full bg-background border border-border rounded-xl p-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-yellow-500/40 transition font-normal resize-none"
                placeholder="Write the announcement. Use new lines for bullet points."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-slate-950 font-black text-sm py-3.5 rounded-xl transition-colors shadow-md"
            >
              {loading ? "⏳ SYNCING TO CLOUD..." : "📤 Post Announcement"}
            </button>
          </form>
        </div>

        {/* ── RIGHT: POSTED ANNOUNCEMENTS LOG ── */}
        <div className="bg-card border border-border/60 p-5 rounded-2xl space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            📋 Posted Announcements Logs
          </h3>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {rows.length === 0 ? (
              <p className="text-xs text-muted-foreground font-medium font-mono">
                No announcements yet.
              </p>
            ) : (
              rows.map((ann) => (
                <div
                  key={ann.id}
                  className="bg-background border border-border/60 p-4 rounded-xl space-y-1.5 group hover:border-yellow-500/30 transition-colors"
                >
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="text-xs font-black text-yellow-500 uppercase flex-1">
                      {ann.title}
                    </h4>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(ann.created_at).toLocaleDateString("en-PK")}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(ann.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-red-400 p-0.5 rounded"
                          title="Delete announcement"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground font-normal whitespace-pre-wrap leading-relaxed">
                    {ann.message}
                  </p>
                  <div className="text-[10px] text-muted-foreground/60 font-mono">
                    Posted by: {ann.posted_by || "System Admin"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
