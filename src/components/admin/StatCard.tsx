import { LucideIcon } from "lucide-react";

export function StatCard({ icon: Icon, label, value, accent = "primary" }: { icon: LucideIcon; label: string; value: string; accent?: "primary" | "success" | "destructive" | "secondary" }) {
  const map: Record<string, string> = {
    primary: "bg-primary/15 text-primary",
    success: "bg-success/15 text-success",
    destructive: "bg-destructive/15 text-destructive",
    secondary: "bg-secondary text-secondary-foreground",
  };
  return (
    <div className="bg-card border border-border/60 rounded-lg p-5 flex items-center gap-4">
      <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${map[accent]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
