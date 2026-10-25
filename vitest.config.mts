import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    // Mirrors the `"@/*": ["./*"]` alias from tsconfig.json.
    alias: [{ find: /^@\//, replacement: rootDir }],
  },
  test: {
    environment: "node",
    include: ["app/**/*.test.ts"],
  },
});
