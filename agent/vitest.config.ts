import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html", "lcov"],
      lines: 80,
      functions: 80,
      statements: 80,
      branches: 75,
      exclude: ["node_modules/", ".next/", "app/**/layout.tsx", "**/*.d.ts"]
    }
  }
});
