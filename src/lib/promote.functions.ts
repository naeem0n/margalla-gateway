import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";

const Input = z.object({ email: z.string().email() });

export const promoteToAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY!;

    const authHeader = getRequestHeader("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Not authenticated");

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) throw new Error("Not authenticated");
    const { data: rows } = await userClient
      .from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin");
    if (!rows || rows.length === 0) throw new Error("Admin only");

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find user by email via admin listUsers
    let target: { id: string; email?: string } | null = null;
    let page = 1;
    while (page < 20) {
      const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      const found = list.users.find((x) => (x.email || "").toLowerCase() === data.email.toLowerCase());
      if (found) { target = { id: found.id, email: found.email ?? undefined }; break; }
      if (list.users.length < 200) break;
      page++;
    }
    if (!target) throw new Error(`No user found for ${data.email}`);

    const { error: insErr } = await admin
      .from("user_roles")
      .upsert({ user_id: target.id, role: "admin" }, { onConflict: "user_id,role" });
    if (insErr) throw new Error(insErr.message);

    await admin.from("profiles").update({ is_approved: true }).eq("id", target.id);
    return { userId: target.id, email: target.email };
  });
