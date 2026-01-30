import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    coverage: {
      reporter: ["text", "html", "lcov"],
      exclude: [
        "**/node_modules/**",
        "**/.next/**",
        "**/dist/**",
        "**/coverage/**",
        "**/*.d.ts",
      ],
    },
  },
});
