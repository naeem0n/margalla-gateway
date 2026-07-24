import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStorage } from "../../test/memory-storage";
import {
  apiFetch,
  apiLogin,
  apiLogout,
  getApiBase,
  getToken,
  isDesktopApp,
  setToken,
} from "./api-client";

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  const ok = init.ok ?? true;
  const status = init.status ?? (ok ? 200 : 400);
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage());
  vi.stubGlobal("window", {} as Window & typeof globalThis);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("api-client token helpers", () => {
  it("getToken returns null when nothing is stored", () => {
    expect(getToken()).toBeNull();
  });

  it("setToken stores and clears the token", () => {
    setToken("abc.def.ghi");
    expect(getToken()).toBe("abc.def.ghi");
    setToken(null);
    expect(getToken()).toBeNull();
  });
});

describe("getApiBase / isDesktopApp", () => {
  it("defaults to /api on the web when no VITE_API_URL is configured", () => {
    vi.stubEnv("VITE_API_URL", undefined as unknown as string);
    expect(getApiBase()).toBe("/api");
    expect(isDesktopApp()).toBe(false);
  });

  it("uses VITE_API_URL when configured", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
    expect(getApiBase()).toBe("https://api.example.com");
  });

  it("uses the desktop apiBase when injected", () => {
    (window as unknown as { margallaDesktop?: unknown }).margallaDesktop = {
      isDesktop: true,
      apiBase: "http://localhost:3847/api",
    };
    expect(getApiBase()).toBe("http://localhost:3847/api");
    expect(isDesktopApp()).toBe(true);
  });
});

describe("apiFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns the parsed JSON body on success", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse({ hello: "world" }),
    );
    const result = await apiFetch<{ hello: string }>("/ping");
    expect(result).toEqual({ hello: "world" });
    const [calledUrl] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toBe(`${getApiBase()}/ping`);
  });

  it("sets JSON Content-Type for a string body and attaches the bearer token", async () => {
    setToken("tok-123");
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(mockResponse({ ok: true }));

    await apiFetch("/thing", { method: "POST", body: JSON.stringify({ a: 1 }) });

    const [, options] = fetchMock.mock.calls[0];
    const headers = options.headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer tok-123");
  });

  it("does not force a Content-Type for FormData bodies", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(mockResponse({ ok: true }));

    await apiFetch("/upload", { method: "POST", body: new FormData() });

    const [, options] = fetchMock.mock.calls[0];
    const headers = options.headers as Headers;
    expect(headers.has("Content-Type")).toBe(false);
  });

  it("translates fetch network errors into an offline message", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    await expect(apiFetch("/ping")).rejects.toThrow(/Local Admin Server is offline/);
  });

  it("throws the server-provided error message on non-ok responses", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse({ error: "Bad credentials" }, { ok: false, status: 401 }),
    );
    await expect(apiFetch("/ping")).rejects.toThrow("Bad credentials");
  });

  it("falls back to a status-based message when no error body is present", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse({}, { ok: false, status: 500 }),
    );
    await expect(apiFetch("/ping")).rejects.toThrow("Request failed with status 500");
  });

  it("surfaces a REQUIRE_PASSWORD_CHANGE error with the flag attached", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse({ require_password_change: true, user_id: "u1" }, { ok: false, status: 403 }),
    );
    await expect(apiFetch("/ping")).rejects.toMatchObject({
      message: "REQUIRE_PASSWORD_CHANGE",
      require_password_change: true,
      user_id: "u1",
    });
  });
});

describe("apiLogin / apiLogout", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("stores the token returned by a successful login", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse({ token: "session-token", user: { id: "u1" } }),
    );
    const data = await apiLogin("RES-1", "pw");
    expect(data.token).toBe("session-token");
    expect(getToken()).toBe("session-token");
  });

  it("clears the token on logout even if the request fails", async () => {
    setToken("stale");
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));
    await expect(apiLogout()).rejects.toThrow("boom");
    expect(getToken()).toBeNull();
  });
});
