import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { EventEmitter } from "node:events";
import { Writable } from "node:stream";
import type { ChildProcess } from "node:child_process";

// ---------------------------------------------------------------------------
// Mock child_process.spawn BEFORE importing the module under test
// ---------------------------------------------------------------------------

vi.mock("node:child_process", async () => {
  const actual = await vi.importActual<typeof import("node:child_process")>(
    "node:child_process",
  );
  return {
    ...actual,
    spawn: vi.fn(),
  };
});

import { spawn } from "node:child_process";
import { startWorker, cleanupProcesses, getRandomPort } from "./process";

const mockSpawn = vi.mocked(spawn);

// ---------------------------------------------------------------------------
// Helpers — build a fake ChildProcess from EventEmitter
// ---------------------------------------------------------------------------

function createFakeChild(): ChildProcess {
  const proc = new EventEmitter() as ChildProcess;
  const stdout = new EventEmitter() as Writable;
  const stderr = new EventEmitter() as Writable;

  // EventEmitter.off already works on the real prototype, but we need
  // the writable stream shape so cast via Object.defineProperty for on/off.
  for (const target of [stdout, stderr]) {
    Object.defineProperty(target, "on", { value: target.on.bind(target) });
    Object.defineProperty(target, "off", { value: target.off.bind(target) });
  }

  (proc as any).stdout = stdout;
  (proc as any).stderr = stderr;
  (proc as any).pid = 12345;
  proc.kill = vi.fn(() => true);

  return proc;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("startWorker", () => {
  let fakeChild: ChildProcess;
  let mockProcessKill: MockInstance<typeof process["kill"]>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fakeChild = createFakeChild();
    mockSpawn.mockReturnValue(fakeChild);
    mockProcessKill = vi.spyOn(process, "kill").mockReturnValue(true);
  });

  afterEach(() => {
    // ESRCH makes cleanupProcesses skip already-dead processes
    mockProcessKill.mockImplementation(() => {
      throw Object.assign(new Error("ESRCH"), { code: "ESRCH" });
    });
    cleanupProcesses();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("spawns worker:business-context with exact WORKER_ID and port in env", async () => {
    const port = getRandomPort();

    const workerPromise = startWorker(port);
    fakeChild.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    const handle = await workerPromise;

    expect(mockSpawn).toHaveBeenCalledOnce();
    const [command, args, opts] = mockSpawn.mock.calls[0]!;

    expect(command).toBe("npx");
    expect(args).toEqual(["tsx", "src/workers/business-context.ts"]);
    expect(opts).toMatchObject({
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });

    const env = (opts as any).env;
    expect(env).toBeDefined();
    expect(env.PORT).toBe(String(port));
    expect(env.WORKER_ID).toBe(`test-worker-${port}`);

    expect(handle).toBeDefined();
    expect(handle.pid).toBe(12345);
    expect(typeof handle.kill).toBe("function");
    expect(typeof handle.waitForExit).toBe("function");
  });

  it("handle.kill() falls back to proc.kill on ESRCH", async () => {
    const port = getRandomPort();

    // Make process group kill fail so fallback to proc.kill("SIGTERM") fires
    mockProcessKill.mockImplementation(() => {
      throw Object.assign(new Error("ESRCH: no such process"), {
        code: "ESRCH",
      });
    });

    const workerPromise = startWorker(port);
    fakeChild.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    const handle = await workerPromise;

    handle.kill();

    // Group kill attempted, then ESRCH → fallback to proc.kill
    expect(mockProcessKill).toHaveBeenCalledWith(-12345, "SIGTERM");
    expect(fakeChild.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("handle.kill() propagates non-ESRCH process-group kill errors", async () => {
    const port = getRandomPort();

    // Make process group kill fail with a non-ESRCH error
    mockProcessKill.mockImplementation(() => {
      throw Object.assign(new Error("EPERM: operation not permitted"), {
        code: "EPERM",
      });
    });

    const workerPromise = startWorker(port);
    fakeChild.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    const handle = await workerPromise;

    // handle.kill() should throw — non-ESRCH errors propagate
    expect(() => handle.kill()).toThrow(/EPERM/);
  });

  it("handle.kill() rejects with actionable error when ChildProcess has no pid", async () => {
    const port = getRandomPort();

    const workerPromise = startWorker(port);
    fakeChild.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    const handle = await workerPromise;

    // Remove pid after wrapProcess captured it — simulates stale/corrupt handle
    const savedPid = (fakeChild as any).pid;
    (fakeChild as any).pid = undefined;

    // Must fail fast with actionable error, not silently return
    expect(() => handle.kill()).toThrow(/no pid/i);

    // Restore pid so afterEach cleanupProcesses can kill normally
    (fakeChild as any).pid = savedPid;
  });

  it("handle.kill() cleans up internalProcessMap even when kill throws", async () => {
    const port = getRandomPort();

    const workerPromise = startWorker(port);
    fakeChild.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    const handle = await workerPromise;

    // Make process.kill throw non-ESRCH on SIGTERM
    mockProcessKill.mockImplementation(() => {
      throw Object.assign(new Error("EPERM"), { code: "EPERM" });
    });

    // Kill should throw but port must still be released (try/finally)
    expect(() => handle.kill()).toThrow(/EPERM/);

    // Port released — getRandomPort should not throw
    expect(() => {
      for (let i = 0; i < 5; i++) getRandomPort();
    }).not.toThrow();
  });

  it("handle.kill() releases port — same port is reusable", async () => {
    const port = getRandomPort();

    const workerPromise = startWorker(port);
    fakeChild.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    const handle = await workerPromise;

    // Kill via the handle — triggers onCleanup which calls releasePort
    handle.kill();
    // Simulate the exit event that wrapProcess registered
    fakeChild.emit("exit", 0);

    // Port is released; getRandomPort should eventually recycle it
    // (not deterministic, but proves no throw / no stall)
    expect(() => {
      for (let i = 0; i < 5; i++) getRandomPort();
    }).not.toThrow();
  });

  it("throws if worker exits before emitting polling pattern", async () => {
    const port = getRandomPort();

    const workerPromise = startWorker(port);
    fakeChild.emit("exit", 1);

    await expect(workerPromise).rejects.toThrow(/process exited/);
  });

  it("throws on timeout if polling pattern never appears", async () => {
    const port = getRandomPort();

    const workerPromise = startWorker(port);
    vi.advanceTimersByTime(31_000);

    await expect(workerPromise).rejects.toThrow(/timed out/);
  });

  it("no lingering stdout/stderr/exit listeners after successful start", async () => {
    const port = getRandomPort();

    const workerPromise = startWorker(port);
    fakeChild.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    const handle = await workerPromise;

    // After startWorker resolves, the internal waitForOutput listeners
    // (stdout data, stderr data, proc exit) should all be removed.
    const stdoutListeners = fakeChild.stdout!.listenerCount("data");
    const stderrListeners = fakeChild.stderr!.listenerCount("data");
    const exitListeners = fakeChild.listenerCount("exit");

    expect(stdoutListeners).toBe(0);
    expect(stderrListeners).toBe(0);
    expect(exitListeners).toBe(0);

    handle.kill();
  });

  it("no lingering listeners after early-exit rejection", async () => {
    const port = getRandomPort();

    const workerPromise = startWorker(port);
    fakeChild.emit("exit", 1);

    await expect(workerPromise).rejects.toThrow(/process exited/);

    const stdoutListeners = fakeChild.stdout!.listenerCount("data");
    const stderrListeners = fakeChild.stderr!.listenerCount("data");
    const exitListeners = fakeChild.listenerCount("exit");

    expect(stdoutListeners).toBe(0);
    expect(stderrListeners).toBe(0);
    expect(exitListeners).toBe(0);
  });

  it("no lingering listeners after timeout rejection", async () => {
    const port = getRandomPort();

    const workerPromise = startWorker(port);
    vi.advanceTimersByTime(31_000);

    await expect(workerPromise).rejects.toThrow(/timed out/);

    const stdoutListeners = fakeChild.stdout!.listenerCount("data");
    const stderrListeners = fakeChild.stderr!.listenerCount("data");
    const exitListeners = fakeChild.listenerCount("exit");

    expect(stdoutListeners).toBe(0);
    expect(stderrListeners).toBe(0);
    expect(exitListeners).toBe(0);
  });

  it("handle.kill() kills process group via negative PID", async () => {
    const port = getRandomPort();

    const workerPromise = startWorker(port);
    fakeChild.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    const handle = await workerPromise;

    handle.kill();

    // Should kill via process group (-pid), not just the wrapper
    expect(mockProcessKill).toHaveBeenCalledWith(
      -12345,
      "SIGTERM",
    );
  });

  it("timeout error includes captured stdout/stderr buffer", async () => {
    const port = getRandomPort();

    const workerPromise = startWorker(port);
    fakeChild.stdout!.emit("data", Buffer.from("app starting\n"));
    fakeChild.stderr!.emit("data", Buffer.from("dep warning\n"));
    vi.advanceTimersByTime(31_000);

    await expect(workerPromise).rejects.toThrow(/timed out/);
    await expect(workerPromise).rejects.toThrow(/app starting/);
    await expect(workerPromise).rejects.toThrow(/dep warning/);
  });

  it("timeout rejection propagates when kill also fails with non-ESRCH error", async () => {
    const port = getRandomPort();

    // Make process group kill fail with a non-ESRCH error
    mockProcessKill.mockImplementation(() => {
      throw Object.assign(new Error("EPERM: operation not permitted"), {
        code: "EPERM",
      });
    });

    const workerPromise = startWorker(port);
    vi.advanceTimersByTime(31_000);

    // Should reject with timeout diagnostic, not hang
    await expect(workerPromise).rejects.toThrow(/timed out/);
    await expect(workerPromise).rejects.toThrow(/kill failed/);
  });

  it("early-exit error includes captured stdout/stderr buffer", async () => {
    const port = getRandomPort();

    const workerPromise = startWorker(port);
    fakeChild.stdout!.emit("data", Buffer.from("boot output\n"));
    fakeChild.stderr!.emit("data", Buffer.from("fatal crash\n"));
    fakeChild.emit("exit", 1);

    await expect(workerPromise).rejects.toThrow(/process exited/);
    await expect(workerPromise).rejects.toThrow(/boot output/);
    await expect(workerPromise).rejects.toThrow(/fatal crash/);
  });
});

// ---------------------------------------------------------------------------
// cleanupProcesses
// ---------------------------------------------------------------------------

describe("cleanupProcesses", () => {
  let fakeChild: ChildProcess;
  let mockProcessKill: MockInstance<typeof process["kill"]>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fakeChild = createFakeChild();
    mockSpawn.mockReturnValue(fakeChild);
    mockProcessKill = vi.spyOn(process, "kill").mockReturnValue(true);
  });

  afterEach(() => {
    // ESRCH makes cleanupProcesses skip already-dead processes
    mockProcessKill.mockImplementation(() => {
      throw Object.assign(new Error("ESRCH"), { code: "ESRCH" });
    });
    cleanupProcesses();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ------------------------------------------------------------------
  // RED: cleanup resolves with no timer advance when group is already gone
  // ------------------------------------------------------------------
  it("resolves without timer advance when process group already gone", async () => {
    const port = getRandomPort();
    const workerPromise = startWorker(port);
    fakeChild.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    await workerPromise;

    // Process already dead (ESRCH on every call)
    mockProcessKill.mockImplementation(() => {
      throw Object.assign(new Error("ESRCH"), { code: "ESRCH" });
    });

    // Must resolve without advancing fake timers
    cleanupProcesses();

    // Port released
    expect(() => getRandomPort()).not.toThrow();
  });

  it("synchronous — returns void, not a promise", async () => {
    const port = getRandomPort();
    const workerPromise = startWorker(port);
    fakeChild.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    await workerPromise;

    mockProcessKill.mockImplementation(() => {
      throw Object.assign(new Error("ESRCH"), { code: "ESRCH" });
    });

    const result = cleanupProcesses();
    expect(result).toBeUndefined();
  });

  it("cleans up multiple tracked handles synchronously and releases all ports", async () => {
    const port1 = getRandomPort();
    const port2 = getRandomPort();

    // Spawn first worker
    const worker1Promise = startWorker(port1);
    fakeChild.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    await worker1Promise;

    // Spawn second worker with different PID
    const fakeChild2 = createFakeChild();
    (fakeChild2 as any).pid = 99999;
    mockSpawn.mockReturnValue(fakeChild2);
    const worker2Promise = startWorker(port2);
    fakeChild2.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    await worker2Promise;

    // ESRCH so cleanup resolves immediately
    mockProcessKill.mockImplementation(() => {
      throw Object.assign(new Error("ESRCH"), { code: "ESRCH" });
    });

    const result = cleanupProcesses();
    expect(result).toBeUndefined();

    // Both ports released
    expect(() => {
      for (let i = 0; i < 5; i++) getRandomPort();
    }).not.toThrow();
  });

  it("cleans up spawnedProcesses and usedPorts", async () => {
    const port = getRandomPort();
    const workerPromise = startWorker(port);
    fakeChild.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    await workerPromise;

    // Make process appear dead so polling resolves quickly
    mockProcessKill.mockImplementation(() => {
      throw Object.assign(new Error("ESRCH"), { code: "ESRCH" });
    });

    cleanupProcesses();

    // Port released — getRandomPort should not throw
    expect(() => {
      for (let i = 0; i < 5; i++) getRandomPort();
    }).not.toThrow();

    fakeChild.emit("exit", 0);
  });

  it("rejects EPERM from Phase 1 without timer advance", async () => {
    const port = getRandomPort();
    const workerPromise = startWorker(port);
    fakeChild.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    await workerPromise;

    // Phase 1 kill throws EPERM (not ESRCH) — must propagate immediately
    mockProcessKill.mockImplementationOnce(() => {
      throw Object.assign(new Error("EPERM: operation not permitted"), {
        code: "EPERM",
      });
    });
    // Subsequent calls (poll signal-0) throw ESRCH so poll resolves
    mockProcessKill.mockImplementation(() => {
      throw Object.assign(new Error("ESRCH"), { code: "ESRCH" });
    });

    // Must throw EPERM, no timer advance needed
    expect(() => cleanupProcesses()).toThrow(/EPERM/);
  });

  it("sends SIGKILL immediately — no timer advance needed", async () => {
    const port = getRandomPort();
    const workerPromise = startWorker(port);
    fakeChild.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    await workerPromise;

    // Process dies immediately on SIGKILL
    mockProcessKill.mockImplementation((_pid: number, sig?: string | number) => {
      if (sig === "SIGKILL") {
        mockProcessKill.mockImplementation(() => {
          throw Object.assign(new Error("ESRCH"), { code: "ESRCH" });
        });
        return true;
      }
      return true;
    });

    cleanupProcesses();

    // SIGKILL sent immediately, no fake timer advance needed
    expect(mockProcessKill).toHaveBeenCalledWith(-12345, "SIGKILL");
  });

  it("ESRCH on SIGKILL tolerated, non-ESRCH propagates with state cleanup", async () => {
    const port = getRandomPort();
    const workerPromise = startWorker(port);
    fakeChild.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    await workerPromise;

    // SIGKILL throws non-ESRCH
    mockProcessKill.mockImplementation((_pid: number, sig?: string | number) => {
      if (sig === "SIGKILL") {
        throw Object.assign(new Error("EPERM"), { code: "EPERM" });
      }
      return true;
    });

    expect(() => cleanupProcesses()).toThrow(/EPERM/);

    // State must still be cleared despite error
    expect(() => getRandomPort()).not.toThrow();
  });

  it("clears spawnedProcesses and usedPorts even when Phase 1 throws", async () => {
    const port1 = getRandomPort();
    const port2 = getRandomPort();

    // Spawn two workers
    const worker1Promise = startWorker(port1);
    fakeChild.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    await worker1Promise;

    const fakeChild2 = createFakeChild();
    (fakeChild2 as any).pid = 99999;
    mockSpawn.mockReturnValue(fakeChild2);
    const worker2Promise = startWorker(port2);
    fakeChild2.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    await worker2Promise;

    // First kill throws EPERM; subsequent calls (poll, second handle) ESRCH
    mockProcessKill.mockImplementationOnce(() => {
      throw Object.assign(new Error("EPERM"), { code: "EPERM" });
    });
    mockProcessKill.mockImplementation(() => {
      throw Object.assign(new Error("ESRCH"), { code: "ESRCH" });
    });

    expect(() => cleanupProcesses()).toThrow(/EPERM/);

    // State must be cleared — no stale handles, ports reusable
    expect(() => getRandomPort()).not.toThrow();
  });

  it("attempts all tracked groups before throwing first non-ESRCH error", async () => {
    const port1 = getRandomPort();
    const port2 = getRandomPort();

    // Spawn first worker (PID 12345 from createFakeChild)
    const worker1Promise = startWorker(port1);
    fakeChild.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    await worker1Promise;

    // Spawn second worker with different PID
    const fakeChild2 = createFakeChild();
    (fakeChild2 as any).pid = 99999;
    mockSpawn.mockReturnValue(fakeChild2);
    const worker2Promise = startWorker(port2);
    fakeChild2.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    await worker2Promise;

    // Track call order: first SIGKILL throws EPERM, second succeeds
    const killCalls: Array<{ pid: number; sig: string | undefined }> = [];
    mockProcessKill.mockImplementation(
      (_pid: number, sig?: string | number) => {
        killCalls.push({ pid: _pid, sig: sig as string });
        if (_pid === -12345 && sig === "SIGKILL") {
          throw Object.assign(new Error("EPERM"), { code: "EPERM" });
        }
        // Second group (or any non-first) — succeed, then go ESRCH
        mockProcessKill.mockImplementation(() => {
          throw Object.assign(new Error("ESRCH"), { code: "ESRCH" });
        });
        return true;
      },
    );

    // Must throw EPERM — but only after attempting both groups
    expect(() => cleanupProcesses()).toThrow(/EPERM/);

    // Both SIGKILL calls were made (first threw EPERM, second succeeded)
    const sigkillCalls = killCalls.filter((c) => c.sig === "SIGKILL");
    expect(sigkillCalls).toHaveLength(2);
    expect(sigkillCalls[0]!.pid).toBe(-12345);
    expect(sigkillCalls[1]!.pid).toBe(-99999);

    // All state cleared despite error
    expect(() => {
      for (let i = 0; i < 5; i++) getRandomPort();
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Production WORKER_ID guard — spawns the REAL worker entrypoint
// ---------------------------------------------------------------------------

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

describe("production WORKER_ID guard", () => {
  const WORKER_PATH = "src/workers/business-context.ts";

  it("exits nonzero with safe error when WORKER_ID is absent in production", async () => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "production",
      DATABASE_URL: "file:./test.db",
      NEXTAUTH_SECRET: "test-secret",
      META_ENCRYPTION_KEY: "test-key",
    };
    delete env.WORKER_ID;

    let exitCode: number | undefined;
    let output = "";
    try {
      await execFileAsync("npx", ["tsx", WORKER_PATH], {
        env,
        timeout: 10_000,
      });
    } catch (err: any) {
      exitCode = typeof err.code === "number" ? err.code : undefined;
      output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    }
    expect(exitCode).toBeDefined();
    expect(exitCode).toBeGreaterThan(0);
    expect(output).toMatch(/WORKER_ID/i);
  }, 15_000);

  it("exits nonzero when WORKER_ID is blank in production", async () => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "production",
      WORKER_ID: "   ",
      DATABASE_URL: "file:./test.db",
      NEXTAUTH_SECRET: "test-secret",
      META_ENCRYPTION_KEY: "test-key",
    };

    let exitCode: number | undefined;
    let output = "";
    try {
      await execFileAsync("npx", ["tsx", WORKER_PATH], {
        env,
        timeout: 10_000,
      });
    } catch (err: any) {
      exitCode = typeof err.code === "number" ? err.code : undefined;
      output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    }
    expect(exitCode).toBeDefined();
    expect(exitCode).toBeGreaterThan(0);
    expect(output).toMatch(/WORKER_ID/i);
  }, 15_000);
});
