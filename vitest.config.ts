import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  process.env.OPENROUTER_API_KEY ??= env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_MODEL ??= env.OPENROUTER_MODEL;

  return {
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
  };
});
