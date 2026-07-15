/**
 * Process control, port management, and log capture.
 */

import { spawn, type ChildProcess } from "node:child_process";
import type { ProcessHandle, LogCapture } from "./types";

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** Set of ports currently in use by this harness (for parallel test safety). */
const usedPorts = new Set<number>();

/** Maps PIDs to ChildProcess instances for log capture. */
const internalProcessMap = new Map<number, ChildProcess>();

/** Tracks spawned process handles for cleanup. */
const spawnedProcesses: Set<ProcessHandle> = new Set();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function wrapProcess(
  proc: ChildProcess,
  onCleanup?: () => void,
): ProcessHandle {
  const pid = proc.pid!;
  internalProcessMap.set(pid, proc);

  const handle: ProcessHandle = {
    pid,
    kill() {
      proc.kill("SIGTERM");
      internalProcessMap.delete(pid);
      onCleanup?.();
    },
    waitForExit(): Promise<number> {
      return new Promise((resolve, reject) => {
        const cleanup = () => {
          proc.off("exit", onExitHandler);
          proc.off("error", onErrorHandler);
        };
        const onExitHandler = (code: number | null) => {
          internalProcessMap.delete(pid);
          onCleanup?.();
          cleanup();
          resolve(code ?? 1);
        };
        const onErrorHandler = (err: Error) => {
          internalProcessMap.delete(pid);
          onCleanup?.();
          cleanup();
          reject(err);
        };
        proc.on("exit", onExitHandler);
        proc.on("error", onErrorHandler);
      });
    },
  };

  return handle;
}

function waitForOutput(
  proc: ChildProcess,
  pattern: RegExp,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      proc.stdout?.off("data", onData);
      proc.stderr?.off("data", onData);
      proc.off("exit", onExit);
    };

    const timeout = setTimeout(() => {
      proc.kill();
      cleanup();
      reject(
        new Error(
          `waitForOutput: timed out after ${timeoutMs}ms waiting for ${pattern}`,
        ),
      );
    }, timeoutMs);

    let buffer = "";

    const onData = (data: Buffer) => {
      buffer += data.toString();
      if (pattern.test(buffer)) {
        cleanup();
        resolve();
      }
    };

    const onExit = (code: number | null) => {
      cleanup();
      if (!pattern.test(buffer)) {
        reject(
          new Error(
            `waitForOutput: process exited (${code}) before pattern ${pattern} was found`,
          ),
        );
      }
    };

    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);
    proc.on("exit", onExit);
  });
}

function releasePort(port: number): void {
  usedPorts.delete(port);
}

// ---------------------------------------------------------------------------
// getRandomPort
// ---------------------------------------------------------------------------

/**
 * Return a random available port not currently tracked by the harness.
 * Uses a ephemeral port range (49152–65535) and checks availability.
 */
export function getRandomPort(): number {
  const min = 49152;
  const max = 65535;
  let port: number;
  let attempts = 0;
  do {
    port = Math.floor(Math.random() * (max - min + 1)) + min;
    attempts++;
    if (attempts > 100) {
      throw new Error("Could not find an available port after 100 attempts");
    }
  } while (usedPorts.has(port));
  usedPorts.add(port);
  return port;
}

// ---------------------------------------------------------------------------
// startApp
// ---------------------------------------------------------------------------

/**
 * Start a Next.js dev server on the given port.
 * Waits for the "Ready" message before returning.
 *
 * @param port - Port to start the app on.
 * @returns Process handle for lifecycle management.
 */
export async function startApp(port: number): Promise<ProcessHandle> {
  const proc = spawn("npx", ["next", "dev", "-p", String(port)], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(port) },
  });

  const handle = wrapProcess(proc, () => releasePort(port));
  spawnedProcesses.add(handle);

  // Wait for "Ready" message
  await waitForOutput(proc, /Ready/i, 30_000);

  return handle;
}

// ---------------------------------------------------------------------------
// startWorker
// ---------------------------------------------------------------------------

/**
 * Start a business-context worker process on the given port.
 * Spawns `worker:business-context` via npx tsx, gives it a unique identity
 * based on the port, and waits for the polling-ready signal before returning.
 *
 * @param port - Port (used as part of the worker identity).
 * @returns Process handle for lifecycle management.
 */
export async function startWorker(port: number): Promise<ProcessHandle> {
  const proc = spawn("npx", ["tsx", "src/workers/business-context.ts"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(port),
      WORKER_ID: `test-worker-${port}`,
    },
  });

  const handle = wrapProcess(proc, () => releasePort(port));
  spawnedProcesses.add(handle);

  // Wait for the polling-ready signal
  await waitForOutput(proc, /\[worker\] polling for jobs/i, 30_000);

  return handle;
}

// ---------------------------------------------------------------------------
// captureLogs
// ---------------------------------------------------------------------------

/**
 * Capture stdout and stderr from a process handle.
 *
 * @param proc - Process handle from {@link startApp} or {@link startWorker},
 *               or a raw ChildProcess (for testing with inline processes).
 * @returns LogCapture interface for reading and asserting on logs.
 */
export function captureLogs(proc: ProcessHandle | ChildProcess): LogCapture {
  const lines: string[] = [];

  // Resolve to ChildProcess: check internal map, or use proc directly if it is one
  let childProc: ChildProcess | null = null;
  if ("stdout" in proc && "stderr" in proc) {
    // Already a ChildProcess
    childProc = proc as unknown as ChildProcess;
  } else {
    childProc = internalProcessMap.get(proc.pid) ?? null;
  }

  if (childProc) {
    childProc.stdout?.on("data", (data: Buffer) => {
      for (const line of data.toString().split("\n")) {
        if (line.trim()) lines.push(line);
      }
    });
    childProc.stderr?.on("data", (data: Buffer) => {
      for (const line of data.toString().split("\n")) {
        if (line.trim()) lines.push(line);
      }
    });
  }

  return {
    getLogs(): string[] {
      return [...lines];
    },
    assertOnLog(pattern: RegExp | string): void {
      const regex =
        typeof pattern === "string" ? new RegExp(pattern, "i") : pattern;
      if (!lines.some((l) => regex.test(l))) {
        throw new Error(
          `assertOnLog: pattern ${regex} not found in logs:\n${lines.join("\n")}`,
        );
      }
    },
    clear(): void {
      lines.length = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// cleanupProcesses
// ---------------------------------------------------------------------------

/**
 * Kill all spawned processes and release ports.
 * Called by cleanup() in harness.ts.
 */
export function cleanupProcesses(): void {
  for (const handle of spawnedProcesses) {
    try {
      handle.kill();
    } catch {
      // Process may already be dead
    }
  }
  spawnedProcesses.clear();
  usedPorts.clear();
}
