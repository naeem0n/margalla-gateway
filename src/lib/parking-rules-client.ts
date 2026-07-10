import { apiFetch, isDesktopApp } from "./api-client";
import { supabase } from "@/integrations/supabase/client";

export interface ParkingRule {
  id: string;
  title: string;
  description: string;
  created_at?: string;
  updated_at?: string;
}

export async function getParkingRules(): Promise<ParkingRule[]> {
  if (isDesktopApp()) {
    try {
      const res = await apiFetch<{ success: boolean; rules: ParkingRule[] }>("/parking-rules");
      return res.rules || [];
    } catch (e) {
      console.error("Local rules fetch failed:", e);
      return [];
    }
  } else {
    const { data, error } = await (supabase as any)
      .from("parking_rules")
      .select("*")
      .order("created_at", { ascending: true });
    
    if (error) {
      console.error("Supabase rules fetch failed:", error);
      return [];
    }
    return (data as any[]) || [];
  }
}

export async function addParkingRule(title: string, description: string): Promise<boolean> {
  if (isDesktopApp()) {
    try {
      const res = await apiFetch<{ success: boolean }>("/parking-rules", {
        method: "POST",
        body: JSON.stringify({ title, description }),
      });
      return res.success;
    } catch (e) {
      console.error("Local rule addition failed:", e);
      return false;
    }
  } else {
    const { error } = await (supabase as any)
      .from("parking_rules")
      .insert([{ title, description }]);
    
    if (error) {
      console.error("Supabase rule addition failed:", error);
      return false;
    }
    return true;
  }
}

export async function updateParkingRule(id: string, title: string, description: string): Promise<boolean> {
  if (isDesktopApp()) {
    try {
      const res = await apiFetch<{ success: boolean }>(`/parking-rules/${id}`, {
        method: "PUT",
        body: JSON.stringify({ title, description }),
      });
      return res.success;
    } catch (e) {
      console.error("Local rule update failed:", e);
      return false;
    }
  } else {
    const { error } = await (supabase as any)
      .from("parking_rules")
      .update({ title, description, updated_at: new Date().toISOString() })
      .eq("id", id);
    
    if (error) {
      console.error("Supabase rule update failed:", error);
      return false;
    }
    return true;
  }
}

export async function deleteParkingRule(id: string): Promise<boolean> {
  if (isDesktopApp()) {
    try {
      const res = await apiFetch<{ success: boolean }>(`/parking-rules/${id}`, {
        method: "DELETE",
      });
      return res.success;
    } catch (e) {
      console.error("Local rule deletion failed:", e);
      return false;
    }
  } else {
    const { error } = await (supabase as any)
      .from("parking_rules")
      .delete()
      .eq("id", id);
    
    if (error) {
      console.error("Supabase rule deletion failed:", error);
      return false;
    }
    return true;
  }
}
