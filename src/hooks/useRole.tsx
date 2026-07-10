import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { getToken } from "@/lib/api-client";

export type AppRole = "admin" | "staff" | "resident" | "thirdparty";

export const ROLES = {
  SUPER_ADMIN: "admin" as const,   // Owner — sees Profit/Loss & full accounts
  MANAGER: "staff" as const,       // Accountant — manages rent/reports, no P&L
  RESIDENT: "resident" as const,   // Personal dashboard only
  THIRDPARTY: "thirdparty" as const, // Third-party partner
};

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

export function useRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) { setRoles([]); return; }

    // Check if SQLite desktop token exists
    const token = typeof window !== "undefined" ? getToken() : null;
    if (token) {
      const decoded = parseJwt(token);
      if (decoded && decoded.role) {
        setRoles([decoded.role as AppRole]);
        return;
      }
    }

    setLoading(true);
    supabase.from("user_roles").select("role").eq("user_id", user.id)
      .then(({ data }: any) => {
        setRoles((data ?? []).map((r: any) => r.role as AppRole));
        setLoading(false);
      });
  }, [user]);

  const isOwner = roles.includes("admin");
  const isManager = roles.includes("staff");
  const isResident = roles.includes("resident");
  const isThirdParty = roles.includes("thirdparty");
  const canSeeFinancials = isOwner; // Strictly Owner only
  const canManageRent = isOwner || isManager;

  return { roles, isOwner, isManager, isResident, isThirdParty, canSeeFinancials, canManageRent, loading };
}