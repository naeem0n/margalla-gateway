import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

const router = Router();

router.post("/report-error", async (req, res) => {
  const { errorName, errorMessage, errorStack, context } = req.body ?? {};
  
  const logMessage = `\n--- ERROR REPORTED AT ${new Date().toISOString()} ---\n` +
                     `Type: ${errorName || "Error"}\n` +
                     `Message: ${errorMessage || ""}\n` +
                     `Stack: ${errorStack || ""}\n` +
                     `Context: ${JSON.stringify(context || {}, null, 2)}\n` +
                     `-------------------------------------------\n`;
  
  // 1. Write to local server.log file
  try {
    const sqliteDir = path.dirname(config.sqlitePath);
    const logPath = path.join(sqliteDir, "server.log");
    fs.appendFileSync(logPath, logMessage, "utf-8");
  } catch (err) {
    console.error("Failed to append to server.log:", err);
  }
  
  // 2. Forward to online portal
  try {
    const targetUrl = "https://margallagateaway.com/api/errors/report";
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: "margalla-gateway-suite",
        errorName,
        errorMessage,
        errorStack,
        context,
        timestamp: new Date().toISOString()
      }),
    });
    
    if (!response.ok) {
      console.warn("Failed to forward error to margallagateaway.com:", await response.text());
    }
  } catch (e) {
    console.warn("Error forwarding to support server:", e);
  }

  res.json({ success: true, message: "Error report submitted to support team" });
});

export default router;
