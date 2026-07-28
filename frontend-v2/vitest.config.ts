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
    ],
    exclude: ["node_modules", ".next", "e2e"],
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 30,
      },
      exclude: ["node_modules", ".next", "e2e", "test/api"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
