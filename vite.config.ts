import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  root: "apps/desktop",
  plugins: [react()],
  resolve: {
    alias: {
      "@core": fileURLToPath(new URL("./packages/core/src", import.meta.url)),
    },
  },
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    strictPort: true,
    port: 5173,
  },
});
