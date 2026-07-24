// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { toast } from 'sonner';
import { parseJwt } from '@/lib/jwt';

// Apni dashboard se nayi keys yahan paste karein
const supabaseUrl = 'https://mamhomsnsrzvnbboajpi.supabase.co';
const supabaseAnonKey = 'sb_publishable_imCkGXqVFzbAI-PEh_ZLhw_w-2NlaKU';

// Fallback to environment variables if placeholders are not replaced
const url = import.meta.env.VITE_SUPABASE_URL || supabaseUrl;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || supabaseAnonKey;

export const rawSupabase = createClient<Database>(url, key, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  }
});

const isDesktop = typeof window !== 'undefined' && (
  !!(window as any).margallaDesktop?.isDesktop || 
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1'
);

// Custom Local Query Builder for Offline-First SQLite redirection
class LocalQueryBuilder {
  private tableName: string;
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private data: any = null;
  private filters: any[] = [];
  private orderCol: string | null = null;
  private orderAscending = true;
  private limitVal: number | null = null;
  private isSingle = false;
  private isMaybeSingle = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(columns?: string) {
    this.action = 'select';
    return this;
  }

  insert(values: any) {
    this.action = 'insert';
    this.data = values;
    return this;
  }

  update(values: any) {
    this.action = 'update';
    this.data = values;
    return this;
  }

  upsert(values: any) {
    this.action = 'upsert';
    this.data = values;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ type: 'neq', column, value });
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push({ type: 'gt', column, value });
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push({ type: 'lt', column, value });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ type: 'gte', column, value });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push({ type: 'lte', column, value });
    return this;
  }

  like(column: string, value: any) {
    this.filters.push({ type: 'like', column, value });
    return this;
  }

  ilike(column: string, value: any) {
    this.filters.push({ type: 'ilike', column, value });
    return this;
  }

  in(column: string, value: any[]) {
    this.filters.push({ type: 'in', column, value });
    return this;
  }

  match(obj: Record<string, any>) {
    for (const [key, val] of Object.entries(obj)) {
      this.eq(key, val);
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderCol = column;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  limit(value: number) {
    this.limitVal = value;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  async then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    try {
      const payload = {
        table: this.tableName,
        action: this.action,
        data: this.data,
        filters: this.filters,
        order: this.orderCol ? { column: this.orderCol, ascending: this.orderAscending } : null,
        limit: this.limitVal,
        single: this.isSingle,
        maybeSingle: this.isMaybeSingle,
      };

      const token = localStorage.getItem("mgt_api_token") || "";
      const apiBase = (window as any).margallaDesktop?.apiBase || "http://localhost:3847/api";

      const response = await fetch(`${apiBase}/query-bridge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Query failed");
      }

      const res = await response.json();
      if (onfulfilled) {
        return onfulfilled(res);
      }
      return res;
    } catch (err: any) {
      console.warn(`[LocalQueryBuilder] Redirection failed:`, err);
      const fallbackResult = { data: this.isSingle || this.isMaybeSingle ? null : [], error: { message: err?.message || String(err) } };
      if (onfulfilled) {
        return onfulfilled(fallbackResult);
      }
      return fallbackResult;
    }
  }

  async catch(onrejected?: (reason: any) => any) {
    return this.then(undefined, onrejected);
  }
}

// Local Storage Bucket Mock
class LocalStorageBucket {
  private bucketName: string;

  constructor(bucketName: string) {
    this.bucketName = bucketName;
  }

  async upload(filePath: string, file: File, options?: any) {
    const toastId = `upload-${Date.now()}`;
    toast.loading("Preparing file upload...", { id: toastId });

    try {
      let uploadFile = file;
      if (file.type.startsWith("image/")) {
        toast.loading("Compressing image...", { id: toastId });
        const { compressImage } = await import("@/lib/image-compress");
        uploadFile = await compressImage(file, 1600, 1600, 0.75);
      }

      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("filepath", filePath);

      const token = localStorage.getItem("mgt_api_token") || "";
      const apiBase = (window as any).margallaDesktop?.apiBase || "http://localhost:3847/api";

      return new Promise<{ data: { path: string } | null; error: any }>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${apiBase}/storage/upload`, true);
        if (token) {
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        }

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            toast.loading(`Uploading: ${percent}%...`, { id: toastId });
            if (options && typeof options.onUploadProgress === "function") {
              options.onUploadProgress({ loaded: event.loaded, total: event.total });
            }
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            toast.success("Upload completed successfully!", { id: toastId });
            resolve({ data: { path: filePath }, error: null });
          } else {
            const errText = xhr.statusText || "Upload failed";
            toast.error(`Upload failed: ${errText}`, { id: toastId });
            resolve({ data: null, error: new Error(errText) });
          }
        };

        xhr.onerror = () => {
          toast.error("Upload failed due to connection error.", { id: toastId });
          resolve({ data: null, error: new Error("Network error") });
        };

        xhr.send(formData);
      });
    } catch (err: any) {
      console.error("[LocalStorageBridge] Upload failed:", err);
      toast.error(`Upload error: ${err.message || err}`, { id: toastId });
      return { data: null, error: err };
    }
  }

  async createSignedUrl(filePath: string, expiresIn: number) {
    const apiBase = (window as any).margallaDesktop?.apiBase || "http://localhost:3847/api";
    const publicUrl = `${apiBase}/storage/file?path=${encodeURIComponent(filePath)}`;
    return { data: { signedUrl: publicUrl }, error: null };
  }

  getPublicUrl(filePath: string) {
    const apiBase = (window as any).margallaDesktop?.apiBase || "http://localhost:3847/api";
    const publicUrl = `${apiBase}/storage/file?path=${encodeURIComponent(filePath)}`;
    return { data: { publicUrl } };
  }

  async remove(paths: string[]) {
    try {
      const token = localStorage.getItem("mgt_api_token") || "";
      const apiBase = (window as any).margallaDesktop?.apiBase || "http://localhost:3847/api";

      const res = await fetch(`${apiBase}/storage/remove`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ paths }),
      });
      if (!res.ok) throw new Error("Remove files failed on local bridge");
      return { data: { success: true }, error: null };
    } catch (err: any) {
      console.error("[LocalStorageBridge] Remove failed:", err);
      return { data: null, error: err };
    }
  }
}

const LocalStorageBuilder = {
  from(bucketName: string) {
    return new LocalStorageBucket(bucketName);
  }
};

// Local Auth Mock
const LocalAuthBuilder = {
  async getSession() {
    const token = localStorage.getItem("mgt_api_token");
    if (!token) return { data: { session: null }, error: null };

    try {
      const decoded = parseJwt(token);
      if (!decoded) throw new Error("Invalid token");

      const session = {
        access_token: token,
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "local-dummy",
        user: {
          id: decoded.sub,
          email: decoded.email,
          role: decoded.role,
          app_metadata: {},
          user_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString()
        }
      };
      return { data: { session }, error: null };
    } catch (err) {
      return { data: { session: null }, error: null };
    }
  },

  onAuthStateChange(callback: any) {
    // Fire callback once with the current session state
    LocalAuthBuilder.getSession().then(({ data }) => {
      callback("SIGNED_IN", data.session);
    });
    return {
      data: {
        subscription: {
          unsubscribe: () => {}
        }
      }
    };
  },

  async signOut() {
    const token = localStorage.getItem("mgt_api_token") || "";
    localStorage.removeItem("mgt_api_token");
    sessionStorage.clear();
    try {
      const apiBase = (window as any).margallaDesktop?.apiBase || "http://localhost:3847/api";
      await fetch(`${apiBase}/auth/logout`, {
        method: "POST",
        headers: {
          "Authorization": token ? `Bearer :${token}` : ""
        }
      });
    } catch (e) {}
    window.location.href = "/auth";
    return { error: null };
  },

  async signInWithPassword({ email, password }: any) {
    try {
      const client_id = email.includes("@") ? email.split("@")[0] : email;
      const apiBase = (window as any).margallaDesktop?.apiBase || "http://localhost:3847/api";
      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id, password })
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: "Authentication failed" }));
        throw new Error(errJson.error);
      }
      const data = await res.json();
      localStorage.setItem("mgt_api_token", data.token);

      const decoded = parseJwt(data.token);
      const session = {
        access_token: data.token,
        user: {
          id: decoded.sub,
          email: decoded.email,
          role: decoded.role,
          aud: "authenticated"
        }
      };

      return { data: { user: session.user, session }, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }
};

// Safety wrapper proxy to catch global errors and redirect calls on desktop
function makeSafeProxy(target: any): any {
  return new Proxy(target, {
    get(obj, prop) {
      if (isDesktop) {
        if (prop === 'from') {
          return function (tableName: string) {
            return new LocalQueryBuilder(tableName);
          };
        }
        if (prop === 'storage') {
          return LocalStorageBuilder;
        }
        if (prop === 'auth') {
          return LocalAuthBuilder;
        }
        if (prop === 'rpc') {
          return function (funcName: string, params?: any) {
            return {
              async then(onfulfilled?: any, onrejected?: any) {
                try {
                  const token = localStorage.getItem("mgt_api_token") || "";
                  const apiBase = (window as any).margallaDesktop?.apiBase || "http://localhost:3847/api";
                  
                  const response = await fetch(`${apiBase}/rpc-bridge`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": token ? `Bearer ${token}` : ""
                    },
                    body: JSON.stringify({ name: funcName, params }),
                  });
                  
                  if (!response.ok) {
                    const errJson = await response.json().catch(() => ({}));
                    throw new Error(errJson.error || "RPC call failed");
                  }
                  
                  const res = await response.json();
                  if (onfulfilled) return onfulfilled(res);
                  return res;
                } catch (err: any) {
                  console.warn(`[LocalQueryBuilder] RPC Redirection failed for ${funcName}:`, err);
                  const fallbackResult = { data: [], error: { message: err?.message || String(err) } };
                  if (onfulfilled) return onfulfilled(fallbackResult);
                  return fallbackResult;
                }
              },
              async catch(onrejected?: any) {
                return this.then(undefined, onrejected);
              }
            };
          };
        }
      }

      const value = obj[prop];
      if (typeof value === 'function') {
        return function (...args: any[]) {
          try {
            const res = value.apply(obj, args);
            if (res && typeof res.then === 'function') {
              const originalThen = res.then;
              res.then = function (onfulfilled: any, onrejected: any) {
                return originalThen.call(
                  res,
                  (val: any) => {
                    // Check if resolved value contains a network error
                    if (val && val.error) {
                      const errMsg = String(val.error?.message || val.error || '');
                      if (errMsg.includes('fetch') || errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('TypeError')) {
                        console.warn(`[Supabase Safe Proxy] Silenced network error in resolved object:`, val.error);
                        val.error = null;
                        val.data = Array.isArray(val.data) ? [] : null;
                      }
                    }
                    if (onfulfilled) return onfulfilled(val);
                    return val;
                  },
                  (err: any) => {
                    const errMsg = String(err?.message || err || '');
                    if (errMsg.includes('fetch') || errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('TypeError')) {
                      console.warn(`[Supabase Safe Proxy] Silenced network error rejection:`, err);
                      if (onfulfilled) {
                        return onfulfilled({ data: [], error: null });
                      }
                      return { data: [], error: null };
                    }
                    if (onrejected) {
                      return onrejected(err);
                    }
                    throw err;
                  }
                ).catch((catchErr: any) => {
                  console.warn(`[Supabase Safe Proxy] Caught async exception:`, catchErr);
                  return { data: [], error: null };
                });
              };
            }
            if (res && typeof res === 'object') {
              return makeSafeProxy(res);
            }
            return res;
          } catch (syncErr) {
            console.warn(`[Supabase Safe Proxy] Caught synchronous exception:`, syncErr);
            return Promise.resolve({ data: [], error: null });
          }
        };
      }
      if (value && typeof value === 'object') {
        return makeSafeProxy(value);
      }
      return value;
    }
  });
}

export const supabase = makeSafeProxy(rawSupabase);




