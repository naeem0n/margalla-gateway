import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, FormEvent } from "react";
import { Building2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiLogin, setToken } from "@/lib/api-client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/resident/login")({
  head: () => ({ meta: [{ title: "Resident Login — Margalla Gateway" }] }),
  component: ResidentLoginPage,
});

function ResidentLoginPage() {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [clientId, setClientId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      let cleanId = clientId.trim();
      const { user, token } = await apiLogin(cleanId, password, "resident");
      
      if (user.role !== "resident" && user.role !== "admin") {
        toast.error(lang === "ur" ? "Sirf residents login kar sakte hain." : "Only residents can login.");
        return;
      }

      setToken(token);
      toast.success(lang === "ur" ? `Khush Aamdeed, ${user.full_name}` : `Welcome back, ${user.full_name}`);
      
      sessionStorage.setItem("mgt_resident_gate", "1");
      navigate({ to: "/resident" });
      
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : (lang === "ur" ? "Login fail ho gaya" : "Login failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elegant">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-2xl">
            {lang === "ur" ? "Resident Portal" : "Resident Portal"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {lang === "ur" ? "Apna ID aur password darj karein" : "Enter your resident ID and password"}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="clientId">{lang === "ur" ? "Resident ID ya Email" : "Resident ID / Email"}</Label>
            <Input 
              id="clientId" 
              className="mt-1" 
              value={clientId} 
              onChange={(e) => setClientId(e.target.value)} 
              placeholder="e.g. APT-101" 
              required 
              disabled={busy}
            />
          </div>
          <div>
            <Label htmlFor="password">{lang === "ur" ? "Password" : "Password"}</Label>
            <Input 
              id="password" 
              type="password" 
              className="mt-1" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              disabled={busy}
            />
          </div>

          <Button type="submit" className="mt-4 w-full" size="lg" disabled={busy}>
            {busy ? (lang === "ur" ? "Wait karein..." : "Signing in...") : (lang === "ur" ? "Login Karein" : "Sign In")}
          </Button>
        </form>
      </div>
    </div>
  );
}
