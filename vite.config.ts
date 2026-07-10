// @lovable.dev/vite-tanstack-config already includes the core TanStack/Vite setup.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  nitro: false,
  tanstackStart: {
    spa: { enabled: true },
    prerender: { enabled: false }
  },
  vite: {
    base: "./",
    build: {
      minify: false
    },
    plugins: [

      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null, // we register manually via guarded wrapper
        filename: "sw.js",
        devOptions: { enabled: false },
        manifest: {
          name: "Margalla Gateway",
          short_name: "Margalla",
          description: "Margalla Gateway — Property Management Portal",
          theme_color: "#0f172a",
          background_color: "#0f172a",
          display: "standalone",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          ],
        },
        workbox: {
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/api\//, /^\/~oauth/],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: { cacheName: "mgt-pages", networkTimeoutSeconds: 4 },
            },
            {
              urlPattern: ({ url }) => url.origin === self.location.origin && /\.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname),
              handler: "CacheFirst",
              options: { cacheName: "mgt-assets", expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } },
            },
          ],
        },
      }),
    ],
  },
});
