import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const Input = z.object({
  clientId: z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/),
  password: z.string().min(1).max(200),
});

export const signInWithClientId = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY!;

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: prof } = await admin
      .from("profiles")
      .select("id")
      .eq("client_id", data.clientId.trim().toUpperCase())
      .maybeSingle();

    // Use a generic error to prevent client-ID enumeration
    const generic = "Invalid Client ID or password";
    if (!prof) throw new Error(generic);

    const { data: u } = await admin.auth.admin.getUserById(prof.id);
    const email = u?.user?.email;
    if (!email) throw new Error(generic);

    const anon = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: session, error } = await anon.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (error || !session.session) throw new Error(generic);

    return {
      access_token: session.session.access_token,
      refresh_token: session.session.refresh_token,
    };
  });
