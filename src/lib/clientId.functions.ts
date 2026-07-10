import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";

const Input = z.object({
  userId: z.string().uuid(),
  prefix: z.enum(["RES", "STF", "ADM", "PRT"]).default("RES"),
});

export const assignClientId = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY!;

    const authHeader = getRequestHeader("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Not authenticated");

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) throw new Error("Not authenticated");
    const { data: rows } = await userClient.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin");
    if (!rows || rows.length === 0) throw new Error("Admin only");

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // Fetch the user's apartment_no to build a flat-based client ID
    const { data: prof, error: profErr } = await admin
      .from("profiles").select("apartment_no").eq("id", data.userId).maybeSingle();
    if (profErr) throw new Error(profErr.message);
    const flat = (prof?.apartment_no ?? "").toString().trim().toUpperCase().replace(/\s+/g, "");
    if (!flat) throw new Error("Set apartment number first, then assign Client ID");

    const clientId = `${data.prefix}-${flat}`;

    // Ensure uniqueness — if collision with a different user, suffix a counter
    let finalId = clientId;
    for (let i = 2; i < 50; i++) {
      const { data: existing } = await admin
        .from("profiles").select("id").eq("client_id", finalId).maybeSingle();
      if (!existing || existing.id === data.userId) break;
      finalId = `${clientId}-${i}`;
    }

    const { error: upErr } = await admin.from("profiles").update({ client_id: finalId }).eq("id", data.userId);
    if (upErr) throw new Error(upErr.message);
    return { clientId: finalId };
  });
