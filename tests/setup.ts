import { afterEach, beforeAll, afterAll } from "vitest";

beforeAll(() => {
  Object.assign(process.env, {
    NODE_ENV: "test",
    NEXTAUTH_SECRET: "test-secret",
    NEXTAUTH_URL: "http://localhost:3000",
  });
});

afterEach(() => {
  // Reset any global test state between tests
});

afterAll(() => {
  // Cleanup after all tests
});
