import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";

const Input = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(120),
  apartmentNo: z.string().min(1).max(20),
  phone: z.string().max(40).optional().default(""),
  role: z.enum(["resident", "staff", "admin", "partner"]).default("resident"),
});

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = "";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 12; i++) p += chars[arr[i] % chars.length];
  return p + "!9";
}

export const generateResidentCredentials = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
    if (!url || !serviceKey || !anonKey) throw new Error("Server not configured");

    // Require an authenticated admin caller.
    const authHeader = getRequestHeader("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Not authenticated");
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: u, error: uErr } = await userClient.auth.getUser();
    if (uErr || !u.user) throw new Error("Not authenticated");
    const { data: adminRoles } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id)
      .eq("role", "admin");
    if (!adminRoles || adminRoles.length === 0) throw new Error("Admin only");

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // IDEMPOTENT: if a user with this email already exists, reuse it instead
    // of creating a duplicate. Re-issue a fresh password and reuse client_id.
    let userId: string | null = null;
    let reused = false;
    try {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list?.users?.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
      if (existing) { userId = existing.id; reused = true; }
    } catch (e) {
      console.error("listUsers failed", e);
    }

    const password = genPassword();

    if (!userId) {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: data.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName, phone: data.phone },
      });
      if (cErr || !created.user) {
        const msg = (cErr?.message || "").toLowerCase();
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
          throw new Error("This email is already registered. Please use a different email.");
        }
        throw new Error(cErr?.message || "Could not create the user account.");
      }
      userId = created.user.id;
    } else {
      const { error: upErr } = await admin.auth.admin.updateUserById(userId, {
        password,
        user_metadata: { full_name: data.fullName, phone: data.phone },
      });
      if (upErr) throw new Error(`Could not reset password: ${upErr.message}`);
    }

    await admin.from("profiles").upsert({
      id: userId,
      full_name: data.fullName,
      phone: data.phone,
      apartment_no: data.apartmentNo,
    });

    if (data.role !== "resident") {
      await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "resident");
      const { data: existingRoles } = await admin
        .from("user_roles").select("role").eq("user_id", userId).eq("role", data.role);
      if (!existingRoles || existingRoles.length === 0) {
        await admin.from("user_roles").insert({ user_id: userId, role: data.role });
      }
    }

    const { data: profileRow } = await admin
      .from("profiles").select("client_id").eq("id", userId).maybeSingle();
    let clientId: string | null = profileRow?.client_id ?? null;
    if (!clientId) {
      const prefix =
        data.role === "admin" ? "ADM" :
        data.role === "staff" ? "STF" :
        data.role === "partner" ? "PRT" : "RES";
      const { data: cidData, error: cidErr } = await admin.rpc("generate_client_id", { _prefix: prefix });
      if (cidErr) throw new Error(`Could not generate client ID: ${cidErr.message}`);
      clientId = cidData as string;
      await admin.from("profiles").update({ client_id: clientId }).eq("id", userId);
    }

    return { email: data.email, password, userId, role: data.role, clientId, reused };
  });