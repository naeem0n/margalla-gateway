import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

async function requireStaffOrAdmin() {
  const url = process.env.SUPABASE_URL!;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const authHeader = getRequestHeader("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Not authenticated");
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: u, error: uErr } = await userClient.auth.getUser();
  if (uErr || !u.user) throw new Error("Not authenticated");
  const { data: roles } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);
  const ok = (roles ?? []).some((r) => r.role === "admin" || r.role === "staff");
  if (!ok) throw new Error("Forbidden");
}

/**
 * Notification abstraction layer.
 *
 * - WhatsApp via Meta Cloud API / 360dialog (WHATSAPP_API_TOKEN + WHATSAPP_PHONE_NUMBER_ID)
 * - SMS via Twilio (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER)
 * - MockProvider used automatically when credentials are missing — never crashes.
 *
 * Every send is persisted to public.notification_logs with status:
 *   sent | pending | failed   (provider field carries "mock" when in mock mode)
 */

type Channel = "whatsapp" | "sms";

interface SendArgs {
  channel: Channel;
  to: string;
  body: string;
  subject?: string;
}

interface ProviderResult {
  status: "sent" | "pending" | "failed";
  provider: string;
  providerMessageId?: string;
  error?: string;
  mock: boolean;
}

interface NotificationProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  send(args: SendArgs): Promise<ProviderResult>;
}

// ---------- Mock provider ----------
class MockProvider implements NotificationProvider {
  readonly name = "mock";
  readonly isConfigured = true;
  async send({ channel, to, body }: SendArgs): Promise<ProviderResult> {
    console.log(`[MOCK ${channel.toUpperCase()}] → ${to}\n${body}\n`);
    return {
      status: "sent",
      provider: "mock",
      providerMessageId: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      mock: true,
    };
  }
}

// ---------- WhatsApp (Meta Cloud / 360dialog) ----------
class WhatsAppProvider implements NotificationProvider {
  readonly name = "whatsapp-cloud";
  readonly isConfigured: boolean;
  private token: string;
  private phoneId: string;

  constructor() {
    this.token = process.env.WHATSAPP_API_TOKEN ?? "";
    this.phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
    this.isConfigured = Boolean(this.token && this.phoneId);
  }

  async send({ to, body }: SendArgs): Promise<ProviderResult> {
    if (!this.isConfigured) {
      return { status: "failed", provider: this.name, error: "Not configured", mock: false };
    }
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${this.phoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/[^\d+]/g, ""),
          type: "text",
          text: { body },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>;
        error?: { message?: string };
      };
      if (!res.ok) {
        return {
          status: "failed",
          provider: this.name,
          error: json?.error?.message ?? `HTTP ${res.status}`,
          mock: false,
        };
      }
      return {
        status: "sent",
        provider: this.name,
        providerMessageId: json?.messages?.[0]?.id,
        mock: false,
      };
    } catch (e) {
      return {
        status: "failed",
        provider: this.name,
        error: e instanceof Error ? e.message : String(e),
        mock: false,
      };
    }
  }
}

// ---------- SMS (Twilio) ----------
class SMSProvider implements NotificationProvider {
  readonly name = "twilio";
  readonly isConfigured: boolean;
  private sid: string;
  private token: string;
  private from: string;

  constructor() {
    this.sid = process.env.TWILIO_ACCOUNT_SID ?? "";
    this.token = process.env.TWILIO_AUTH_TOKEN ?? "";
    this.from = process.env.TWILIO_FROM_NUMBER ?? "";
    this.isConfigured = Boolean(this.sid && this.token && this.from);
  }

  async send({ to, body }: SendArgs): Promise<ProviderResult> {
    if (!this.isConfigured) {
      return { status: "failed", provider: this.name, error: "Not configured", mock: false };
    }
    try {
      const params = new URLSearchParams({ To: to, From: this.from, Body: body });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${this.sid}:${this.token}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        }
      );
      const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
      if (!res.ok) {
        return {
          status: "failed",
          provider: this.name,
          error: json?.message ?? `HTTP ${res.status}`,
          mock: false,
        };
      }
      return { status: "sent", provider: this.name, providerMessageId: json?.sid, mock: false };
    } catch (e) {
      return {
        status: "failed",
        provider: this.name,
        error: e instanceof Error ? e.message : String(e),
        mock: false,
      };
    }
  }
}

// ---------- Service ----------
function getProvider(channel: Channel): NotificationProvider {
  if (channel === "whatsapp") {
    const wa = new WhatsAppProvider();
    return wa.isConfigured ? wa : new MockProvider();
  }
  const sms = new SMSProvider();
  return sms.isConfigured ? sms : new MockProvider();
}

function renderTemplate(body: string, vars: Record<string, string | number> = {}): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{{${k}}}`
  );
}

function getServerSupabase() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// ---------- Server function: sendNotification ----------
const SendInput = z.object({
  channel: z.enum(["whatsapp", "sms"]),
  to: z.string().min(5).max(40),
  body: z.string().min(1).max(4000).optional(),
  templateKey: z.string().max(80).optional(),
  variables: z.record(z.union([z.string(), z.number()])).optional(),
  subject: z.string().max(200).optional(),
  recipientUserId: z.string().uuid().optional(),
  triggerType: z.string().max(60).optional(),
  referenceId: z.string().uuid().optional(),
});

const isDesktop = typeof window !== 'undefined' && (
  !!(window as any).margallaDesktop?.isDesktop || 
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1'
);

const serverSendNotification = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SendInput.parse(d))
  .handler(async ({ data }) => {
    await requireStaffOrAdmin();
    const supabase = getServerSupabase();

    // Resolve body: prefer explicit body, else look up template
    let finalBody = data.body ?? "";
    let finalSubject = data.subject;
    if (data.templateKey) {
      const { data: tpl } = await supabase
        .from("notification_templates")
        .select("body, subject, is_active")
        .eq("key", data.templateKey)
        .maybeSingle();
      if (tpl?.is_active) {
        if (!finalBody) finalBody = tpl.body;
        if (!finalSubject) finalSubject = tpl.subject ?? undefined;
      }
    }
    if (!finalBody) {
      return { ok: false, status: "failed" as const, mock: false, error: "Empty message body" };
    }
    finalBody = renderTemplate(finalBody, data.variables ?? {});

    const provider = getProvider(data.channel);
    const result = await provider.send({
      channel: data.channel,
      to: data.to,
      body: finalBody,
      subject: finalSubject,
    });

    // Persist log (never throw)
    try {
      await supabase.from("notification_logs").insert({
        channel: data.channel,
        template_key: data.templateKey ?? null,
        recipient_phone: data.to,
        recipient_user_id: data.recipientUserId ?? null,
        subject: finalSubject ?? null,
        body: finalBody,
        status: result.status,
        provider: result.provider,
        provider_message_id: result.providerMessageId ?? null,
        error_message: result.error ?? null,
        trigger_type: data.triggerType ?? null,
        reference_id: data.referenceId ?? null,
        sent_at: result.status === "sent" ? new Date().toISOString() : null,
      });
    } catch (e) {
      console.error("[notifications] log insert failed", e);
    }

    return {
      ok: result.status === "sent",
      status: result.status,
      mock: result.mock,
      provider: result.provider,
      error: result.error,
    };
  });

// ---------- Server function: providerStatus ----------
const serverGetNotificationProviderStatus = createServerFn({ method: "GET" }).handler(async () => {
  const wa = new WhatsAppProvider();
  const sms = new SMSProvider();
  return {
    whatsapp: {
      configured: wa.isConfigured,
      mode: wa.isConfigured ? "live" : "mock",
      provider: wa.isConfigured ? wa.name : "mock",
    },
    sms: {
      configured: sms.isConfigured,
      mode: sms.isConfigured ? "live" : "mock",
      provider: sms.isConfigured ? sms.name : "mock",
    },
  };
});

// ---------- Client Wrappers ----------
export const sendNotification = async (args: { data: any }) => {
  if (isDesktop) {
    const token = localStorage.getItem("mgt_api_token") || "";
    const apiBase = (window as any).margallaDesktop?.apiBase || "http://localhost:3847/api";
    const res = await fetch(`${apiBase}/notifications/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token ? `Bearer ${token}` : ""
      },
      body: JSON.stringify(args.data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to send notification");
    }
    return res.json();
  }
  return serverSendNotification(args);
};

export const getNotificationProviderStatus = async () => {
  if (isDesktop) {
    const token = localStorage.getItem("mgt_api_token") || "";
    const apiBase = (window as any).margallaDesktop?.apiBase || "http://localhost:3847/api";
    const res = await fetch(`${apiBase}/notifications/provider-status`, {
      method: "GET",
      headers: {
        "Authorization": token ? `Bearer ${token}` : ""
      }
    });
    if (!res.ok) return null;
    return res.json();
  }
  return serverGetNotificationProviderStatus();
};
