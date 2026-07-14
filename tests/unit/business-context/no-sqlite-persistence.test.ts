import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FORBIDDEN_IMPORTS = [
  "@libsql/client",
  "drizzle-orm/sqlite-core",
  ":memory:",
  "InMemoryRepository",
];

const TARGET_DIRS = [
  path.resolve("src/app/api/businesses"),
  path.resolve("src/infrastructure/business-context"),
];

function findTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTsFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("Business Context must not use SQLite persistence", () => {
  const tsFiles = TARGET_DIRS.flatMap((dir) => findTsFiles(dir));

  it("should have no files with forbidden imports", () => {
    const violations: { file: string; matched: string }[] = [];

    for (const file of tsFiles) {
      const content = fs.readFileSync(file, "utf-8");
      for (const forbidden of FORBIDDEN_IMPORTS) {
        if (content.includes(forbidden)) {
          violations.push({ file: path.relative(process.cwd(), file), matched: forbidden });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
