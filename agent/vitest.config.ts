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
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      include: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
      // Temporary baseline for APE-59: patch coverage is enforced in Codecov, while local global
      // thresholds remain a lightweight safety net for the current repo-wide baseline.
      thresholds: {
        lines: 70,
        functions: 80,
        statements: 70,
        branches: 78,
      },
      exclude: [
        "node_modules/",
        ".next/",
        "coverage/",
        "test/**",
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "app/**/page.tsx",
        "app/**/layout.tsx",
        "**/index.ts",
        "**/types.ts",
      ],
    }
  }
});
