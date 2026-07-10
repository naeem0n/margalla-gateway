import { createFileRoute } from "@tanstack/react-router";
import { ResidentLayout } from "@/components/resident/ResidentLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Inbox } from "lucide-react";

export const Route = createFileRoute("/resident/notices")({ component: Page });

/* ─── Types ─────────────────────────────────────────────── */
type Announcement = {
  id: string;
  title: string;
  message: string;
  posted_by: string | null;
  created_at: string;
};

/* ─── Page ───────────────────────────────────────────────── */
function Page() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const streamAnnouncements = async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5); // Sirf top 5 fresh updates show karein
      
      const mapped = (data || []).map((ann: any) => ({
        id: ann.id,
        title: ann.title,
        message: ann.body,
        posted_by: ann.created_by,
        created_at: ann.created_at,
      }));

      setAnnouncements(mapped);
      setLoading(false);
    };
    streamAnnouncements();
  }, []);

  return (
    <ResidentLayout title="Notices">
      <div className="max-w-3xl space-y-4">

        {/* ── Header Card ── */}
        <div className="bg-card border border-border/60 p-5 rounded-2xl space-y-4">
          <h3 className="text-sm font-black text-yellow-500 uppercase tracking-wider">
            📢 BUILDING BROADCASTS & NOTICES
          </h3>

          <div className="space-y-3">
            {loading ? (
              <p className="text-xs text-muted-foreground font-mono animate-pulse">
                Loading announcements…
              </p>
            ) : announcements.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center gap-3">
                <Inbox className="h-10 w-10 text-muted-foreground" />
                <p className="text-xs text-muted-foreground font-mono">
                  No active announcements from management office.
                </p>
              </div>
            ) : (
              announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="bg-background border border-border/60 p-4 rounded-xl space-y-1 hover:border-yellow-500/30 transition-colors"
                >
                  {/* Meta row */}
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                    <span>🔔 {ann.posted_by || "System Admin"}</span>
                    <span>
                      {new Date(ann.created_at).toLocaleDateString("en-PK")}
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className="text-xs font-bold text-foreground mt-1">
                    {ann.title}
                  </h4>

                  {/* Message */}
                  <p className="text-xs text-muted-foreground font-normal mt-0.5 whitespace-pre-wrap leading-relaxed">
                    {ann.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </ResidentLayout>
  );
}
