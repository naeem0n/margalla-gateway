import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Building2, Clock, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pending-approval")({
  head: () => ({ meta: [{ title: "Pending Approval — Margalla Apartments" }] }),
  component: PendingApprovalPage,
});

function PendingApprovalPage() {
  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "#/auth";
  };
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background to-card">
      <div className="w-full max-w-xl bg-card border border-border/60 rounded-xl p-10 shadow-elegant text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
          <Clock className="h-8 w-8 text-primary" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-primary" />
          <span className="font-display text-lg">MARGALLA GATEWAY</span>
        </div>
        <h1 className="font-display text-3xl mb-3">Account Pending Approval</h1>
        <p className="text-muted-foreground mb-4">
          Please contact the Margalla Gateway management to activate your portal access.
        </p>
        <p
          className="text-lg mb-8"
          dir="rtl"
          style={{ fontFamily: "'Noto Naskh Arabic','Noto Sans Arabic',Inter,sans-serif" }}
        >
          آپ کا اکاؤنٹ ابھی فعال نہیں ہے۔ پورٹل تک رسائی کے لیے انتظامیہ سے رابطہ کریں۔
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button variant="outline" asChild>
            <Link to="/">Back to Home</Link>
          </Button>
          <Button onClick={signOut} variant="destructive">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}