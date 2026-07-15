/**
 * ClamAV scanner lifecycle management for E2E tests.
 *
 * The E2E harness owns scanner start, health-check wait, and cleanup.
 * Uses docker compose to manage the clamav service defined in docker-compose.yml.
 *
 * All process execution uses argument-array spawn (no shell interpolation).
 * Compose file path is derived from this module's location via import.meta.url.
 */

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Compose file path — derived from this module's location
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
export const COMPOSE_FILE = resolve(__dirname, "../../../docker-compose.yml");

// ---------------------------------------------------------------------------
// Internal helpers — non-blocking process execution
// ---------------------------------------------------------------------------

export function run(
  command: string,
  args: string[],
  timeoutMs = 30_000,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);

    const proc = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      signal: ac.signal,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const done = (err: Error | null, code: number | null) => {
      if (settled) return;
      settled = true;
      if (timedOut) {
        reject(
          new Error(
            `${command} ${args.join(" ")} timed out after ${timeoutMs}ms`,
          ),
        );
      } else if (err || (code !== null && code !== 0)) {
        reject(
          new Error(
            `${command} ${args.join(" ")} exited ${code}: ${stderr || stdout}`,
          ),
        );
      } else {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      }
    };

    proc.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        timedOut = true;
      }
      done(err, null);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      done(null, code);
    });
  });
}

function dockerCompose(
  args: string[],
  timeoutMs = 30_000,
): Promise<string> {
  return run("docker", ["compose", "-f", COMPOSE_FILE, ...args], timeoutMs).then(
    (r) => r.stdout,
  );
}

// ---------------------------------------------------------------------------
// cleanupScanner (defined before startScanner — startScanner calls it)
// ---------------------------------------------------------------------------

/**
 * Stop and remove the ClamAV scanner container deterministically.
 * Tries graceful stop first, then force-removes. Surfaces errors from
 * the remove step (stop failure is non-fatal if container is already gone).
 */
export async function cleanupScanner(): Promise<void> {
  try {
    await dockerCompose(["stop", "clamav"], 15_000);
  } catch {
    // Stop failure is non-fatal — container may already be stopped
  }
  try {
    await dockerCompose(["rm", "-f", "clamav"], 10_000);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("No such container")) {
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// startScanner
// ---------------------------------------------------------------------------

/**
 * Start the ClamAV scanner container via docker compose.
 * Ensures clean state by stopping any existing container first.
 */
export async function startScanner(): Promise<void> {
  await cleanupScanner();
  await dockerCompose(["up", "-d", "clamav"]);
}

// ---------------------------------------------------------------------------
// waitScannerHealthy
// ---------------------------------------------------------------------------

/**
 * Poll docker inspect until the ClamAV container reports healthy status.
 *
 * @param timeoutMs - Max wait in ms (default 120_000 — ClamAV cold start downloads definitions).
 * @param intervalMs - Poll interval in ms (default 3_000).
 * @throws If timeout exceeded before container becomes healthy.
 */
export async function waitScannerHealthy(
  timeoutMs = 120_000,
  intervalMs = 3_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const containerId = await dockerCompose(["ps", "-q", "clamav"], 5_000);
      if (!containerId) {
        await new Promise((r) => setTimeout(r, intervalMs));
        continue;
      }
      const { stdout } = await run(
        "docker",
        ["inspect", "--format={{.State.Health.Status}}", containerId],
        5_000,
      );

      if (stdout === "healthy") {
        return;
      }
    } catch {
      // Container may not be ready yet — continue polling
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    `waitScannerHealthy: ClamAV container not healthy after ${timeoutMs}ms`,
  );
}
