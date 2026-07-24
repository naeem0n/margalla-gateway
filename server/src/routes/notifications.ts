import { Router, Request, Response } from "express";
import https from "node:https";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = Router();

// ============================================================
// 🛡️ PAKISTAN SMS GATEWAY ENGINE
// POST /api/notifications/send-real-sms
// ============================================================
router.post("/notifications/send-real-sms", authRequired, requireRole("admin"), (req: Request, res: Response) => {
  try {
    const { phone_number, message_content } = req.body ?? {};

    if (!phone_number || !message_content) {
      return res.json({
        success: false,
        message: "Phone aur Message missing hain ustad ge!",
      });
    }

    // 📝 Clean & format for Pakistan: 03001234567 → 923001234567
    let cleanNumber = String(phone_number).replace(/[^0-9]/g, "");
    if (cleanNumber.startsWith("0")) {
      cleanNumber = "92" + cleanNumber.substring(1);
    }

    // ── Gateway credentials (set via .env) ──────────────────
    const apiKey   = process.env.SMS_API_KEY   ?? "";
    const maskName = process.env.SMS_MASK_NAME ?? "MARGALLA";

    if (!apiKey) {
      console.warn("[SMS] SMS_API_KEY not set in environment — skipping gateway call.");
      return res.json({
        success: false,
        message: "SMS_API_KEY is not configured on the server. Set it in your .env file.",
      });
    }

    const gatewayUrl =
      `https://api.smsprovider.pk/v3/sendsms` +
      `?api_key=${encodeURIComponent(apiKey)}` +
      `&to=${cleanNumber}` +
      `&mask=${encodeURIComponent(maskName)}` +
      `&message=${encodeURIComponent(message_content)}`;

    // ── Fire request to SMS provider ─────────────────────────
    https
      .get(gatewayUrl, (apiRes) => {
        let data = "";
        apiRes.on("data", (chunk) => { data += chunk; });
        apiRes.on("end", () => {
          console.log(`[SMS] Sent to ${cleanNumber} — gateway: ${data}`);
          res.json({
            success: true,
            message: `Message pushed to network path successfully for ${cleanNumber}!`,
            gateway_response: data,
          });
        });
      })
      .on("error", (err) => {
        console.error("[SMS] Gateway connection error:", err.message);
        res.json({
          success: false,
          message: "Gateway connection failed at provider endpoint.",
          error: err.message,
        });
      });

  } catch (e: any) {
    console.error("[SMS] Unexpected error:", e.message);
    res.json({ success: false, message: "Unexpected server error in SMS handler." });
  }
});

export default router;
