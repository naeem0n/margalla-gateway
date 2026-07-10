import React, { useState } from "react";
import { Shield, User, ArrowRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginProps {
  onLogin: (user: { role: string; name: string; email: string }) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [role, setRole] = useState<"admin" | "resident">("admin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || (role === "admin" ? "Administrator" : "Resident Owner");
    const finalEmail = email.trim() || `${role}@margalla.com`;
    onLogin({ role, name: finalName, email: finalEmail });
  };

  const handleQuickLogin = (selectedRole: "admin" | "resident") => {
    const defaultNames = {
      admin: "Admin Director",
      resident: "Apt 402 - Bilal Ahmed",
    };
    onLogin({
      role: selectedRole,
      name: defaultNames[selectedRole],
      email: `${selectedRole}@margalla.com`
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 relative overflow-hidden font-sans">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-secondary/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-card/85 backdrop-blur-md border border-border/60 rounded-2xl p-8 space-y-6 shadow-elegant z-10 relative">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary mb-2">
            <Home className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-bold font-display tracking-tight text-foreground">Margalla Gateway</h2>
          <p className="text-sm text-muted-foreground">Select a portal or enter your credentials</p>
        </div>

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg border border-border/40">
          <button
            type="button"
            onClick={() => setRole("admin")}
            className={`py-2 text-xs font-semibold rounded-md transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
              role === "admin" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>Admin</span>
          </button>
          <button
            type="button"
            onClick={() => setRole("resident")}
            className={`py-2 text-xs font-semibold rounded-md transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
              role === "resident" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>Resident</span>
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name" className="text-xs">Full Name (Optional)</Label>
            <Input
              id="name"
              type="text"
              placeholder={role === "admin" ? "Administrator" : "Resident Owner"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background/50"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="email" className="text-xs">Email / ID</Label>
            <Input
              id="email"
              type="text"
              placeholder={`${role}@margalla.com`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background/50 font-mono text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="password" className="text-xs">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-background/50"
            />
          </div>

          <Button type="submit" className="w-full font-semibold mt-2 cursor-pointer">
            Access {role === "admin" ? "Admin" : "Resident"} Portal
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/40" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Quick Bypass / Testing</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleQuickLogin("admin")}
            className="text-[11px] h-9 px-2 hover:bg-primary/10 hover:text-primary cursor-pointer"
          >
            Admin Bypass
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleQuickLogin("resident")}
            className="text-[11px] h-9 px-2 hover:bg-primary/10 hover:text-primary cursor-pointer"
          >
            Resident Bypass
          </Button>
        </div>
      </div>
    </div>
  );
}
