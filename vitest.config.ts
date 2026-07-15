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
    setupFiles: ["./tests/setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "default",
          include: ["tests/**/*.test.ts", "tests/**/*.test.tsx", "src/**/*.test.ts", "src/**/*.test.tsx"],
          exclude: ["tests/integration/business-context/source-processing-worker.*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "sequential",
          include: ["tests/integration/business-context/source-processing-worker.*.test.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
