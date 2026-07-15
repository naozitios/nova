import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "src/$1") },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./tests/setup.ts"],
  },
});
