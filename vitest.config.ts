import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}", "server/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}", "server/src/**/*.ts"],
      exclude: ["**/*.{test,spec}.{ts,tsx}", "src/components/ui/**"],
    },
  },
});
