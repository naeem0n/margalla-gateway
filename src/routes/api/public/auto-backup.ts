import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Public auto-backup endpoint called by pg_cron (and optionally external schedulers).
 * Auth: caller must send the project anon key as `apikey` header.
 * Snapshots every relevant table to JSON, uploads to the `documents` bucket,
 * and records a row in `public.documents` (owner_type='backup') so the admin
 * Backup & Restore page lists it automatically.
 */

const TABLES = [
  "profiles", "user_roles", "apartments", "parking_slots", "staff",
  "complaints", "visitors", "announcements", "documents",
  "finance_entries", "ledger_entries", "payment_requests",
  "daily_bookings", "notification_templates", "notification_logs",
  "site_content", "audit_logs",
] as const;

const BodySchema = z.object({ trigger: z.string().max(60).optional() }).optional();

export const Route = createFileRoute("/api/public/auto-backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-backup-secret");
        const expected = process.env.BACKUP_SECRET;
        if (!expected || !secret || secret !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const raw = await request.text();
          BodySchema.parse(raw ? JSON.parse(raw) : undefined);
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const snapshot: Record<string, unknown> = {
          _meta: { generated_at: new Date().toISOString(), version: 1, trigger: "auto" },
        };
        for (const t of TABLES) {
          const { data, error } = await supabaseAdmin.from(t as never).select("*").limit(50000);
          snapshot[t] = error ? { error: error.message } : (data ?? []);
        }

        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        const filename = `mgt-auto-${stamp}.json`;
        const path = `backups/${filename}`;
        const json = JSON.stringify(snapshot);
        const bytes = new TextEncoder().encode(json);

        const { error: upErr } = await supabaseAdmin.storage
          .from("documents")
          .upload(path, bytes, { contentType: "application/json", upsert: false });
        if (upErr) {
          return new Response(JSON.stringify({ ok: false, error: upErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        await supabaseAdmin.from("documents").insert({
          owner_type: "backup",
          title: filename,
          doc_type: "json",
          file_path: path,
          file_size: bytes.byteLength,
          mime_type: "application/json",
        });

        return new Response(
          JSON.stringify({ ok: true, file: filename, size: bytes.byteLength }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
