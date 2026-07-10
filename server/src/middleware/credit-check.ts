import { Request, Response, NextFunction } from "express";
import { getDb } from "../db/index.js";

/**
 * Credit Management Middleware
 * Checks if system has remaining credits before allowing certain operations
 */

interface CreditSettings {
  total_credits: number;
  used_credits: number;
  expiry_date: string | null;
  is_active: boolean;
}

const DEFAULT_CREDITS = 1000000; // 10 lakh entries allowed by default

export async function checkCredits(req: Request, res: Response, next: NextFunction) {
  try {
    const db = await getDb();
    
    // Get or create credit settings
    let settings = await db.queryOne<CreditSettings>(
      "SELECT * FROM system_settings WHERE setting_key = 'credits'",
      []
    );

    if (!settings) {
      // Initialize credit system
      const ts = new Date().toISOString();
      await db.run(
        `INSERT INTO system_settings (id, setting_key, setting_value, created_at, updated_at) 
         VALUES (?, 'credits', ?, ?, ?)`,
        [
          crypto.randomUUID ? crypto.randomUUID() : `setting-${Date.now()}`,
          JSON.stringify({
            total_credits: DEFAULT_CREDITS,
            used_credits: 0,
            expiry_date: null,
            is_active: true
          }),
          ts,
          ts
        ]
      );
      
      // Allow first request after initialization
      return next();
    }

    const creditData = JSON.parse(settings.setting_value || "{}");
    const totalCredits = creditData.total_credits || DEFAULT_CREDITS;
    const usedCredits = creditData.used_credits || 0;
    const remainingCredits = totalCredits - usedCredits;
    const isActive = creditData.is_active !== false;

    // Check if credits are exhausted
    if (!isActive || remainingCredits <= 0) {
      return res.status(402).json({ 
        error: "Credit limit reached. Please contact support to upgrade your plan.",
        remaining: 0,
        total: totalCredits,
        used: usedCredits
      });
    }

    // Check expiry date if set
    if (creditData.expiry_date) {
      const expiryDate = new Date(creditData.expiry_date);
      if (expiryDate < new Date()) {
        return res.status(402).json({ 
          error: "Your subscription has expired. Please renew to continue.",
          expiry_date: creditData.expiry_date
        });
      }
    }

    // Increment used credits for write operations
    if (req.method === "POST" || req.method === "PUT" || req.method === "DELETE") {
      creditData.used_credits = usedCredits + 1;
      const ts = new Date().toISOString();
      
      await db.run(
        `UPDATE system_settings 
         SET setting_value = ?, updated_at = ? 
         WHERE setting_key = 'credits'`,
        [JSON.stringify(creditData), ts]
      );
    }

    // Attach credit info to request for monitoring
    (req as any).creditInfo = {
      remaining: remainingCredits - 1,
      total: totalCredits,
      used: usedCredits + 1
    };

    next();
  } catch (e) {
    console.error("Credit check middleware error:", e);
    // Don't block on middleware errors - log and continue
    next();
  }
}

/**
 * Get current credit status
 */
export async function getCreditStatus(): Promise<{
  total: number;
  used: number;
  remaining: number;
  percentage: number;
  expiry_date: string | null;
  is_active: boolean;
}> {
  try {
    const db = await getDb();
    const settings = await db.queryOne<{ setting_value: string }>(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'credits'",
      []
    );

    if (!settings) {
      return {
        total: DEFAULT_CREDITS,
        used: 0,
        remaining: DEFAULT_CREDITS,
        percentage: 100,
        expiry_date: null,
        is_active: true
      };
    }

    const creditData = JSON.parse(settings.setting_value || "{}");
    const total = creditData.total_credits || DEFAULT_CREDITS;
    const used = creditData.used_credits || 0;
    const remaining = total - used;
    const percentage = (remaining / total) * 100;

    return {
      total,
      used,
      remaining,
      percentage,
      expiry_date: creditData.expiry_date || null,
      is_active: creditData.is_active !== false
    };
  } catch (e) {
    console.error("Get credit status error:", e);
    return {
      total: DEFAULT_CREDITS,
      used: 0,
      remaining: DEFAULT_CREDITS,
      percentage: 100,
      expiry_date: null,
      is_active: true
    };
  }
}

/**
 * Reset or update credits (admin only)
 */
export async function updateCredits(
  totalCredits: number,
  expiryDate: string | null = null,
  isActive: boolean = true
): Promise<void> {
  const db = await getDb();
  const ts = new Date().toISOString();
  
  const creditData = {
    total_credits: totalCredits,
    used_credits: 0, // Reset used credits
    expiry_date: expiryDate,
    is_active: isActive
  };

  await db.run(
    `INSERT INTO system_settings (id, setting_key, setting_value, created_at, updated_at)
     VALUES (?, 'credits', ?, ?, ?)
     ON CONFLICT(setting_key) 
     DO UPDATE SET setting_value = ?, updated_at = ?`,
    [
      crypto.randomUUID ? crypto.randomUUID() : `setting-${Date.now()}`,
      JSON.stringify(creditData),
      ts,
      ts,
      JSON.stringify(creditData),
      ts
    ]
  );
}
