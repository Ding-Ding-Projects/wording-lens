import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@core": fileURLToPath(new URL("./packages/core/src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    include: ["packages/core/tests/**/*.test.ts", "apps/desktop/tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
