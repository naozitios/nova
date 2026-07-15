/**
 * HTTP fetch with authentication and polling utilities.
 */

// ---------------------------------------------------------------------------
// authenticatedFetch
// ---------------------------------------------------------------------------

/**
 * HTTP fetch with authentication headers pre-set.
 * Accepts either a session cookie string (from createTestSession)
 * or a raw JWT (from createTestUser).
 *
 * @param url - Target URL.
 * @param opts - Standard RequestInit plus `authToken` for convenience.
 * @returns Response object.
 */
export async function authenticatedFetch(
  url: string,
  opts?: RequestInit & { authToken?: string },
): Promise<Response> {
  const headers = new Headers(opts?.headers);

  if (opts?.authToken) {
    // Detect if it's a cookie string (contains "=") or a raw JWT
    if (opts.authToken.includes("next-auth.session-token=")) {
      headers.set("Cookie", opts.authToken);
    } else {
      headers.set("Authorization", `Bearer ${opts.authToken}`);
    }
  }

  return fetch(url, { ...opts, headers });
}

// ---------------------------------------------------------------------------
// pollForCondition
// ---------------------------------------------------------------------------

/**
 * Poll a condition function until it returns a truthy value or timeout.
 *
 * @param fn - Condition to check (may be async).
 * @param timeout - Max wait in ms (default 30_000).
 * @param interval - Poll interval in ms (default 500).
 * @returns The truthy result from fn.
 * @throws {Error} If timeout exceeded. Error includes last fn result.
 */
export async function pollForCondition<T>(
  fn: () => T | Promise<T>,
  timeout = 30_000,
  interval = 500,
): Promise<T> {
  const deadline = Date.now() + timeout;
  let lastResult: unknown;

  while (Date.now() < deadline) {
    lastResult = await fn();
    if (lastResult) {
      return lastResult as T;
    }
    await sleep(interval);
  }

  throw new Error(
    `pollForCondition: timed out after ${timeout}ms. Last result: ${JSON.stringify(lastResult)}`,
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
