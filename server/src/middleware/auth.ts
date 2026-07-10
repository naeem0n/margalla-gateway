import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { config } from "../config.js";
import type { UserRole } from "../db/types.js";
import { getDb } from "../db/index.js";

export interface AuthPayload {
  sub: string;
  client_id: string;
  role: UserRole;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "7d" });
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    req.user = jwt.verify(header.slice(7), config.jwtSecret) as AuthPayload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  };
}

export async function hasPermission(userId: string, permissionName: string): Promise<boolean> {
  const db = await getDb();
  const user = await db.queryOne<{ role: string; permissions_json: string }>(
    "SELECT role, permissions_json FROM users WHERE id = ?",
    [userId]
  );
  if (!user) return false;
  if (user.role === "admin") return true;
  try {
    const perms = JSON.parse(user.permissions_json || "{}");
    return !!perms[permissionName];
  } catch {
    return false;
  }
}

export function requirePermission(permissionName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const ok = await hasPermission(req.user.sub, permissionName);
    if (!ok) {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  };
}

export function stripUser<T extends Record<string, unknown>>(row: T) {
  const { password_hash, ...rest } = row as T & { password_hash?: string };
  return rest;
}

export const verifySuperAdminImpersonation = (req: any, res: any, next: any) => {
  const user_role = req.user?.user_role || req.user?.role;

  // Strict Protection: Agar user Super Admin ya System Admin ya admin nahi hai, toh instantly block karein
  if (user_role !== 'Super Admin' && user_role !== 'System Admin' && user_role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: "🚨 SECURITY BREACH: Aap ke paas is Ghost Mode ka access nahi hai!" 
    });
  }

  next(); // Agar Super Admin/System Admin/admin hai toh rasta saaf hai!
};

export const logUnauthorizedAccess = (req: Request, reason: string) => {
  try {
    const timestamp = new Date().toISOString();
    const userId = req.user?.sub || "Anonymous";
    const role = req.user?.role || "None";
    const endpoint = req.originalUrl || req.url;
    const ip = req.ip || req.connection.remoteAddress || "Unknown IP";
    
    const logMessage = `[SECURITY AUDIT] Timestamp: ${timestamp} | User ID: ${userId} | Role: ${role} | Endpoint: ${endpoint} | IP: ${ip} | Result: Access Denied (${reason})\n`;
    
    console.warn(logMessage.trim());
    
    const logFilePath = path.join(process.cwd(), "accounting_audit.log");
    fs.appendFileSync(logFilePath, logMessage, "utf8");
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
};

export const requireAccountingRole = (req: Request, res: Response, next: NextFunction) => {
  const role = (req.user?.role || req.user?.user_role || "").toLowerCase();
  
  if (
    role === "admin" ||
    role === "super admin" ||
    role === "system admin" ||
    role === "accountant"
  ) {
    return next();
  }
  
  logUnauthorizedAccess(req, "Missing accounting privileges");
  return res.status(403).json({ error: "Access denied. Only Super Admin, Admin, or Accountant can perform this action." });
};
