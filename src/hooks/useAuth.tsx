import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { getToken } from "@/lib/api-client";

export type AppRole = "admin" | "staff" | "resident" | "thirdparty";

function parseJwt(token: string) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check if SQLite desktop token exists
    const localToken = typeof window !== "undefined" ? getToken() : null;
    if (localToken) {
      const decoded = parseJwt(localToken);
      if (decoded && decoded.sub) {
        setUser({
          id: decoded.sub,
          email: decoded.email,
          user_metadata: {},
          app_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString(),
        } as any);
        setRoles([decoded.role as AppRole]);
        setLoading(false);
        return; // Bypass Supabase session queries
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_e: any, s: any) => {
      // If we are logged in locally, bypass Supabase changes
      if (getToken()) return;

      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(async () => {
          const { data } = await supabase.from("user_roles").select("role").eq("user_id", s.user!.id);
          setRoles((data ?? []).map((r: any) => r.role as AppRole));
        }, 0);
      } else {
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data }: any) => {
      if (getToken()) return;

      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.clear();
    }
    await supabase.auth.signOut();
    window.location.href = "#/admin/login";
  };

  const isAdmin = roles.includes("admin");
  const isResident = roles.includes("resident");
  const isThirdParty = roles.includes("thirdparty");
  return { session, user, roles, loading, signOut, isAdmin, isResident, isThirdParty };
}