import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getToken } from "./api-client";

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

export async function requireUserWithRedirect(): Promise<string | null> {
  try {
    // 1. Check if SQLite desktop token exists
    const token = getToken();
    if (token) {
      const decoded = parseJwt(token);
      if (decoded && decoded.sub) {
        return decoded.sub;
      }
    }

    // 2. Fall back to Supabase auth check
    const { data } = await supabase.auth.getUser();
    const user = data?.user ?? null;
    if (!user) {
      toast.error("Please sign in to continue");
      // Delay briefly to allow toast to show, then redirect
      setTimeout(() => { window.location.href = "#/auth"; }, 300);
      return null;
    }
    return user.id;
  } catch (e) {
    toast.error("Authentication check failed");
    return null;
  }
}
