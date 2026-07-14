/**
 * T124: Service-role leakage boundary test.
 *
 * Scans Business Context client-facing modules for SUPABASE_SERVICE_ROLE_KEY
 * usage. The service-role key must only exist in the dedicated boundary module
 * (src/infrastructure/business-context/supabase-client.ts). No other module
 * should import or reference it directly.
 *
 * FR-034, SC-006, SC-007
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

// ─── Scan configuration ─────────────────────────────────────────────────────

/** Directories that serve client-facing HTTP routes. */
const API_SCAN_DIRS = ["src/app/api/businesses"];

/** Infrastructure modules that must not reference the service-role key directly. */
const INFRA_SCAN_DIRS = ["src/infrastructure/business-context"];

/** Module permitted to reference the service-role key (the boundary). */
const ALLOWED_BOUNDARY = "src/infrastructure/business-context/supabase-client.ts";

/** Patterns that indicate a service-role secret leak. */
const LEAK_PATTERNS = [
  /SUPABASE_SERVICE_ROLE_KEY/g,
  /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/g,
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function collectTsFiles(dirs: string[]): string[] {
  const files: string[] = [];
  const root = process.cwd();

  for (const dir of dirs) {
    const absDir = join(root, dir);
    walk(absDir, root, files);
  }

  return files;
}

function walk(absDir: string, root: string, acc: string[]): void {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(absDir);
  } catch {
    return; // directory may not exist
  }

  for (const entry of entries) {
    const fullPath = join(absDir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, root, acc);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      acc.push(relative(root, fullPath));
    }
  }
}

function readFileLines(filePath: string): string[] {
  const root = process.cwd();
  return readFileSync(join(root, filePath), "utf-8").split("\n");
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Server-secret boundary (SC-006, SC-007)", () => {
  const clientFiles = collectTsFiles([...API_SCAN_DIRS, ...INFRA_SCAN_DIRS]);

  it("no client-facing module references SUPABASE_SERVICE_ROLE_KEY", () => {
    const violations: { file: string; line: number; content: string }[] = [];

    for (const file of clientFiles) {
      if (file === ALLOWED_BOUNDARY) continue; // boundary module is exempt

      const lines = readFileLines(file);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of LEAK_PATTERNS) {
          pattern.lastIndex = 0; // reset regex state
          if (pattern.test(line)) {
            violations.push({ file, line: i + 1, content: line.trim() });
          }
        }
      }
    }

    expect(
      violations,
      `Service-role secret leaked in client-facing modules:\n${violations.map((v) => `  ${v.file}:${v.line}: ${v.content}`).join("\n")}`,
    ).toHaveLength(0);
  });

  it("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY is never used anywhere", () => {
    // Scan broader scope for this catastrophic leak pattern
    const allFiles = collectTsFiles(["src"]);

    const violations: { file: string; line: number; content: string }[] = [];

    for (const file of allFiles) {
      const lines = readFileLines(file);
      for (let i = 0; i < lines.length; i++) {
        if (/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/.test(lines[i])) {
          violations.push({ file, line: i + 1, content: lines[i].trim() });
        }
      }
    }

    expect(
      violations,
      `NEXT_PUBLIC service-role key found — this is a critical security violation:\n${violations.map((v) => `  ${v.file}:${v.line}: ${v.content}`).join("\n")}`,
    ).toHaveLength(0);
  });
});
