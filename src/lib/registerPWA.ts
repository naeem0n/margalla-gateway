/**
 * Guarded PWA registration.
 * Never registers in Lovable preview, iframes, dev, or when ?sw=off is set.
 * Unregisters any matching stale workers in those contexts.
 */
const SW_URL = "/sw.js";

function isUnsafeHost(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
  return false;
}

async function unregisterMatching() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs
      .filter((r) => (r.active?.scriptURL ?? "").endsWith(SW_URL))
      .map((r) => r.unregister()),
  );
}

export async function registerPWA() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const inIframe = window.self !== window.top;
  const url = new URL(window.location.href);
  const swOff = url.searchParams.get("sw") === "off";
  const isProd = import.meta.env.PROD;

  if (!isProd || inIframe || isUnsafeHost() || swOff) {
    await unregisterMatching();
    return;
  }

  try {
    await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  } catch (e) {
    console.warn("[PWA] registration failed", e);
  }
}
