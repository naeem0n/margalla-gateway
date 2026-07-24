declare global {
  interface Window {
    margallaDesktop?: { isDesktop: boolean; apiBase: string };
  }
}

const TOKEN_KEY = "mgt_api_token";

export function getApiBase(): string {
  if (typeof window !== "undefined" && window.margallaDesktop?.apiBase) {
    return window.margallaDesktop.apiBase;
  }
  return import.meta.env.VITE_API_URL ?? "/api";
}

export function getToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof localStorage === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && !!window.margallaDesktop;
}

const DESKTOP_API_FALLBACK = "http://localhost:3847/api";

/**
 * API base used by the offline-first desktop bridge. Falls back to the local
 * admin server when the desktop shell has not injected an explicit base.
 */
export function getDesktopApiBase(): string {
  if (typeof window !== "undefined" && window.margallaDesktop?.apiBase) {
    return window.margallaDesktop.apiBase;
  }
  return DESKTOP_API_FALLBACK;
}

/** Build request headers, attaching the bearer token when one is stored. */
export function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

/** Trigger a browser download for an in-memory blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function apiDownloadFile(path: string, filename: string, errorMessage: string) {
  const res = await fetch(`${getApiBase()}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(errorMessage);
  downloadBlob(await res.blob(), filename);
}

async function apiUploadFile<T = unknown>(path: string, file: File, errorMessage: string): Promise<T> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? errorMessage);
  }
  return res.json();
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const url = `${getApiBase()}${path}`;
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    if (err instanceof TypeError && (err.message.includes("fetch") || err.message.includes("NetworkError"))) {
      throw new Error("Local Admin Server is offline or not connected to the internet. Residents cannot view data until Admin PC is live and connected via Tunnel.");
    }
    throw err;
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    if (errorBody.require_password_change) {
      throw Object.assign(new Error("REQUIRE_PASSWORD_CHANGE"), errorBody);
    }
    throw new Error(errorBody.error || errorBody.message || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export type ApiUser = {
  id: string;
  client_id: string;
  email: string;
  full_name: string;
  apartment_no: string | null;
  phone: string | null;
  role: "admin" | "resident" | "thirdparty";
  permissions_json: string;
};

export async function apiLogin(client_id: string, password: string, portal?: string) {
  const data = await apiFetch<{ token: string; user: ApiUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ client_id, password, portal }),
  });
  setToken(data.token);
  return data;
}

export async function apiChangeInitialPassword(user_id: string, current_password: string, new_password: string) {
  const data = await apiFetch<{ token: string; user: ApiUser }>("/auth/change-initial-password", {
    method: "POST",
    body: JSON.stringify({ user_id, current_password, new_password }),
  });
  setToken(data.token);
  return data;
}

export async function apiPhoneLogin(client_id: string, phone: string, portal?: string) {
  const data = await apiFetch<{ token: string; user: ApiUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ client_id, phone, portal }),
  });
  setToken(data.token);
  return data;
}

export async function apiLogout() {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } finally {
    setToken(null);
  }
}

export async function apiMe() {
  return apiFetch<{ user: ApiUser }>("/auth/me");
}

export async function downloadDbBackup() {
  await apiDownloadFile(
    "/backup/download",
    `margalla-backup-${new Date().toISOString().slice(0, 10)}.db`,
    "Backup download failed",
  );
}

export async function restoreDbBackup(file: File) {
  return apiUploadFile<{ message?: string }>("/backup/restore", file, "Restore failed");
}

export async function downloadJsonBackup() {
  await apiDownloadFile(
    "/backup/export-json",
    `margalla-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`,
    "JSON Backup export failed",
  );
}

export async function restoreJsonBackup(file: File) {
  return apiUploadFile<{ message?: string }>("/backup/import-json", file, "JSON Import failed");
}

export async function getBackupLogs() {
  return apiFetch<{ logs: any[] }>("/backup/logs");
}

export async function clearDbBackup() {
  return apiFetch<{ ok: boolean; message: string }>("/backup/clear", { method: "POST" });
}

export async function triggerSync() {
  return apiFetch<{ pushed: number }>("/sync/push", { method: "POST", headers: { "X-Sync-Key": import.meta.env.VITE_SYNC_API_KEY ?? "" } });
}
