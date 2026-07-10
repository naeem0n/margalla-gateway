import { ResidentSidebar } from "./ResidentSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";

export function ResidentLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex w-full bg-background">
      <ResidentSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar title={title} />
        <main className="flex-1 p-6 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
