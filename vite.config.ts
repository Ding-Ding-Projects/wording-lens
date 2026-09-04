const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");
const { fileURLToPath, URL } = require("node:url");

module.exports = defineConfig({
  root: "apps/desktop",
  plugins: [react.default ? react.default() : react()],
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
