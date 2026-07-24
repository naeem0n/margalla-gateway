import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type DbMode = "sqlite" | "postgres";

// If process.env.APP_IS_PACKAGED is true, or if we are executing from within the dist-electron path, it's production.
const isPackaged = process.env.APP_IS_PACKAGED === 'true' || __dirname.includes('dist-electron') || process.cwd().includes('dist-electron') || __dirname.includes('app.asar');
const isDev = !isPackaged && (!process.env.PORT || fs.existsSync(path.join(process.cwd(), "package.json")) || fs.existsSync(path.join(process.cwd(), "..", "package.json")));

const defaultSqlitePath =
  process.env.SQLITE_PATH ??
  (isDev
    ? path.join(
        fs.existsSync(path.join(process.cwd(), "package.json"))
          ? process.cwd()
          : path.join(process.cwd(), ".."),
        "margalla.db"
      )
    : path.join(
        process.env.APPDATA 
          ? path.join(process.env.APPDATA, "margalla-gateway") 
          : path.join(os.homedir(), "margalla-gateway"),
        "data",
        "margalla.db"
      ));

const sqliteDir = path.dirname(defaultSqlitePath);

let initialSyncCloudUrl = process.env.SYNC_CLOUD_URL ?? "";
let initialSyncApiKey = process.env.SYNC_API_KEY ?? "";

try {
  if (!fs.existsSync(sqliteDir)) {
    fs.mkdirSync(sqliteDir, { recursive: true });
  }
  const syncConfigPath = path.join(sqliteDir, "sync_config.json");
  if (fs.existsSync(syncConfigPath)) {
    const raw = fs.readFileSync(syncConfigPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.syncCloudUrl) initialSyncCloudUrl = parsed.syncCloudUrl;
    if (parsed.syncApiKey) initialSyncApiKey = parsed.syncApiKey;
  }
} catch (e) {
  console.error("[SQLite Config] Failed to load sync_config.json:", e);
}

function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv;
  }
  // In any non-development context (packaged desktop build or a real
  // deployment) a missing JWT secret is fatal: falling back to a shared,
  // publicly-known string would let anyone forge authentication tokens.
  if (isPackaged || process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET is not set. Refusing to start with an insecure default secret. " +
        "Set a strong, unique JWT_SECRET in the environment."
    );
  }
  console.warn(
    "[config] JWT_SECRET is not set — using an insecure development-only secret. " +
      "Set JWT_SECRET before deploying."
  );
  return "margalla-dev-secret-change-in-production";
}

export const config = {
  port: Number(process.env.PORT ?? 3847),
  dbMode: (process.env.DB_MODE ?? "sqlite") as DbMode,
  jwtSecret: resolveJwtSecret(),
  sqlitePath: defaultSqlitePath,
  
  // Writable directories (use path next to sqlite database in desktop/sqlite mode)
  uploadsDir:
    process.env.DB_MODE === "postgres"
      ? path.join(process.cwd(), "server", "uploads")
      : path.join(sqliteDir, "uploads"),
  reportsDir:
    process.env.DB_MODE === "postgres"
      ? path.join(process.cwd(), "server", "uploads", "reports")
      : path.join(sqliteDir, "uploads", "reports"),
  tmpDir:
    process.env.DB_MODE === "postgres"
      ? path.join(process.cwd(), "server", "tmp")
      : path.join(sqliteDir, "tmp"),

  postgresUrl: process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "",
  syncCloudUrl: initialSyncCloudUrl,
  syncApiKey: initialSyncApiKey,
  isDesktop: process.env.IS_DESKTOP === "true",
};

