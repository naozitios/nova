import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  process.env.OPENROUTER_API_KEY ??= env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_MODEL ??= env.OPENROUTER_MODEL;

  return {
    resolve: {
      alias: [{ find: /^@\/(.*)$/, replacement: path.resolve(__dirname, 'src/$1') }],
    },
    test: {
      environment: 'node',
      setupFiles: ['./tests/setup.ts'],
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            include: [
              'src/**/*.test.ts',
              'src/**/*.test.tsx',
              'tests/unit/**/*.test.ts',
              'tests/unit/**/*.test.tsx',
            ],
            fileParallelism: true,
          },
        },
        {
          extends: true,
          test: {
            name: 'contract',
            include: ['tests/contract/**/*.test.ts', 'tests/contract/**/*.test.tsx'],
            fileParallelism: true,
          },
        },
        {
          extends: true,
          test: {
            name: 'integration',
            include: ['tests/integration/**/*.test.ts', 'tests/integration/**/*.test.tsx'],
            fileParallelism: false,
          },
        },
        {
          extends: true,
          test: {
            name: 'rls',
            include: ['tests/rls/**/*.test.ts', 'tests/rls/**/*.test.tsx'],
            fileParallelism: false,
          },
        },
        {
          extends: true,
          test: {
            name: 'e2e',
            include: ['tests/e2e/**/*.test.ts', 'tests/e2e/**/*.test.tsx'],
            fileParallelism: false,
          },
        },
      ],
    },
  };
});
