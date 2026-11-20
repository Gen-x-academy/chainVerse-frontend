import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "**/__tests__/**/*.{ts,tsx}",
      "**/*.{test,spec}.{ts,tsx}",
      "test/**/*.{ts,tsx}",
      "components/**/__tests__/**/*.{ts,tsx}",
      "src/features/workspace/__tests__/**/*.{ts,tsx}",
      "src/features/workspace/**/__tests__/**/*.{ts,tsx}",
    ],
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 30,
      },
      exclude: [
        "node_modules",
        ".next",
        "e2e",
        "**/e2e/**",
        "test/api",
        "src/test/fixtures/**",
        "src/features/workspace/__tests__/fixtures/**",
        "**/*.e2e.{ts,tsx}",
        "**/*.journey.{ts,tsx}",
        "**/*.a11y.{ts,tsx}",
        "**/*.responsive.{ts,tsx}",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})