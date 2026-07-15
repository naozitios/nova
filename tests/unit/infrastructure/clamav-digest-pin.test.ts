import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dirname, "..", "..", "..");
const EXPECTED_DIGEST =
  "sha256:75fb5fd95fcbe1d7e6d240c369c1572b686ee2c95949d1042b5148de8eddebb4";
const EXPECTED_TAG = "1.4.3";

const CLAMAV_IMAGE_PATTERN =
  /clamav\/clamav:([0-9]+\.[0-9]+\.[0-9]+)(?:@sha256:([a-f0-9]{64}))?/g;

function findComposeFiles(): string[] {
  const files: string[] = [];
  const rootEntries = readdirSync(PROJECT_ROOT);
  for (const entry of rootEntries) {
    if (
      entry.startsWith("docker-compose") &&
      (entry.endsWith(".yml") || entry.endsWith(".yaml"))
    ) {
      files.push(join(PROJECT_ROOT, entry));
    }
  }
  return files;
}

function extractClamavImages(content: string): { tag: string; digest?: string }[] {
  const images: { tag: string; digest?: string }[] = [];
  let match;
  while ((match = CLAMAV_IMAGE_PATTERN.exec(content)) !== null) {
    images.push({ tag: match[1], digest: match[2] ? `sha256:${match[2]}` : undefined });
  }
  return images;
}

describe("ClamAV image digest pinning", () => {
  it("rejects tag-only ClamAV image references (must use digest pin)", () => {
    const composeFiles = findComposeFiles();
    expect(composeFiles.length).toBeGreaterThan(0);

    for (const filePath of composeFiles) {
      const content = readFileSync(filePath, "utf-8");
      const images = extractClamavImages(content);

      for (const image of images) {
        expect(image.digest, `ClamAV image must include @sha256: digest, got tag ${image.tag}`).toBeDefined();
        expect(image.tag).toBe(EXPECTED_TAG);
      }
    }
  });

  it("pins the exact expected ClamAV digest", () => {
    const composeFiles = findComposeFiles();
    for (const filePath of composeFiles) {
      const content = readFileSync(filePath, "utf-8");
      const images = extractClamavImages(content);

      for (const image of images) {
        expect(image.digest).toBe(EXPECTED_DIGEST);
      }
    }
  });

  it("defines healthcheck in docker-compose", () => {
    const composeFiles = findComposeFiles();
    for (const filePath of composeFiles) {
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("healthcheck:");
      expect(content).toContain("interval:");
      expect(content).toContain("timeout:");
      expect(content).toContain("retries:");
    }
  });
});
