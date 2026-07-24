import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getToken } from "./api-client";
import { parseJwt } from "./jwt";

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
