const { defineConfig } = require("vitest/config");
const react = require("@vitejs/plugin-react");
const { fileURLToPath, URL } = require("node:url");

module.exports = defineConfig({
  plugins: [react.default ? react.default() : react()],
  resolve: { alias: { "@core": fileURLToPath(new URL("./packages/core/src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    include: ["packages/core/tests/**/*.test.ts", "apps/desktop/tests/**/*.test.ts", "tests/integration/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
