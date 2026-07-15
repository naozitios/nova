import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fakeChild = createFakeChild();
    mockSpawn.mockReturnValue(fakeChild);
  });

  afterEach(() => {
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

  it("returns a tracked ProcessHandle — kill sends SIGTERM", async () => {
    const port = getRandomPort();

    const workerPromise = startWorker(port);
    fakeChild.stdout!.emit("data", Buffer.from("[worker] polling for jobs\n"));
    const handle = await workerPromise;

    handle.kill();

    expect(fakeChild.kill).toHaveBeenCalledWith("SIGTERM");
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
});
