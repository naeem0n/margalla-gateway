import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";
import { CentralEntryPanel } from "./CentralEntryPanel";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getToken } from "@/lib/api-client";
import { Link } from "@tanstack/react-router";

export function AdminLayout({ title, children, bypassAuth = false }: { title: string; children: React.ReactNode; bypassAuth?: boolean }) {
  const { user } = useAuth();
  const token = typeof window !== "undefined" ? getToken() : null;
  const isAuthorized = !!user || !!token || bypassAuth;

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md text-center p-8 bg-card border border-border/60 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Admin area requires sign-in</h3>
          <p className="text-sm text-muted-foreground mb-4">This section is restricted to authenticated users. Please sign in to continue.</p>
          <div className="flex justify-center gap-2">
            <Link to="/admin/login"><Button>Sign in</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar title={title} />
        <main className="flex-1 p-6 overflow-x-auto">{children}</main>
      </div>
      <CentralEntryPanel />
    </div>
  );
}
