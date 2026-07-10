import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, FormEvent } from "react";
import { Building2, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiLogin, getApiBase, apiChangeInitialPassword } from "@/lib/api-client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "Admin Login — Margalla Gateway" }] }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [changePasswordState, setChangePasswordState] = useState<{ userId: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleForceReset = async () => {
    localStorage.removeItem("mgt_api_token");
    sessionStorage.clear();
    toast.success("Local auth cache cleared!");

    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/auth/reset-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || "Admin DB credentials restored successfully!");
      } else {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        toast.warning(`Server responded: ${err.error}`);
      }
    } catch (err) {
      console.error("Backend reset failed:", err);
      toast.error(
        "Failed to fetch! The backend API server is offline. Please make sure to run 'npm run dev:server' in a separate command prompt or terminal window, then try again.",
        { duration: 8000 }
      );
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      let cleanId = clientId.trim();
      cleanId = cleanId.replace(/^[;:\s]+/, "");
      cleanId = cleanId.replace(/^(id|client_id|username|user)\s*[;:\s]\s*/i, "");
      cleanId = cleanId.trim();

      const { user } = await apiLogin(cleanId, password, "admin");
      if (user.role !== "admin") {
        toast.error("Admin credentials required");
        return;
      }
      toast.success("Welcome, Admin");
      navigate({ to: "/admin" });
    } catch (err: any) {
      if (err.message === "REQUIRE_PASSWORD_CHANGE") {
        setChangePasswordState({ userId: err.user_id });
      } else {
        toast.error(err instanceof Error ? err.message : "Login failed");
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
      toast.success("Password updated successfully. Welcome Admin");
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setBusy(false);
    }
  };

  if (changePasswordState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-card to-background px-4">
        <div className="w-full max-w-md">
          <Link to="/welcome" className="flex items-center justify-center gap-2 mb-8">
            <Building2 className="h-8 w-8 text-primary" />
            <span className="font-display text-2xl">MARGALLA GATEWAY</span>
          </Link>
          <form onSubmit={handlePasswordChange} className="bg-card border border-border/60 rounded-xl p-8 shadow-elegant space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="font-display text-2xl">Set New Password</h1>
            </div>
            <p className="text-sm text-muted-foreground mb-4">You must change your temporary password.</p>
            <div>
              <Label>New Password</Label>
              <Input type="password" minLength={8} className="mt-1" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div>
              <Label>Confirm Password</Label>
              <Input type="password" minLength={8} className="mt-1" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-primary text-primary-foreground">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving…</> : "Update Password & Sign In"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-card to-background px-4">
      <div className="w-full max-w-md">
        <Link to="/welcome" className="flex items-center justify-center gap-2 mb-8">
          <Building2 className="h-8 w-8 text-primary" />
          <span className="font-display text-2xl">MARGALLA GATEWAY</span>
        </Link>
        <form onSubmit={submit} className="bg-card border border-border/60 rounded-xl p-8 shadow-elegant space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl">Admin Portal</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Secure login with admin ID and password.</p>
          <div>
            <Label htmlFor="clientId">Admin ID / Email</Label>
            <Input id="clientId" className="mt-1" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="ADMIN-001" required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" className="mt-1" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-primary text-primary-foreground">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Signing in…</> : "Sign In"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Default desktop admin: <span className="font-mono">ADMIN-001</span> / <span className="font-mono">MARGALLA@RAHMAN1112</span>
          </p>
          <div className="pt-2 border-t border-border/40 text-center">
            <button
              type="button"
              onClick={handleForceReset}
              className="text-[10px] text-muted-foreground hover:text-primary transition-colors underline cursor-pointer"
            >
              Force Reset Cache & Repair Admin Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
