import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = resolve("scripts/package-plugin.mjs");

/** Writes the given files into a fresh temporary project folder. */
function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "daily-page-release-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

function runRelease(root: string): void {
  execFileSync(process.execPath, [SCRIPT], { cwd: root, stdio: "pipe" });
}

/** Build output, plus the sources and development files that must never be packaged. */
const GOOD: Record<string, string> = {
  "dist/main.js": "module.exports = {};",
  "dist/manifest.json": "{}",
  "dist/styles.css": ".daily-page {}",
  "dist/vault/Daily Page/view.js": "// vault view",
  "versions.json": "{}",
  "src/main.ts": "export {};",
  "harness/harness.ts": "export {};",
  "tests/a.test.ts": "export {};",
};

describe("scripts/package-plugin.mjs", () => {
  it("packages exactly the three plugin files, and nothing from the sources or development folders", () => {
    const root = project(GOOD);
    try {
      runRelease(root);
      expect(readdirSync(join(root, "release", "daily-page")).sort()).toEqual([
        "main.js",
        "manifest.json",
        "styles.css",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails, naming the missing file, when the build output is missing", () => {
    const { "dist/main.js": _missing, ...withoutMain } = GOOD;
    const root = project(withoutMain);
    try {
      expect(() => runRelease(root)).toThrow(/dist\/main\.js is missing/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses a file that mentions the harness, and leaves no partial release behind", () => {
    const root = project({ ...GOOD, "dist/styles.css": "/* harness preview */" });
    try {
      expect(() => runRelease(root)).toThrow(/harness/);
      expect(existsSync(join(root, "release", "daily-page"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses a harness mention in main.js, not only in styles", () => {
    const root = project({ ...GOOD, "dist/main.js": "require('harness/serve')" });
    try {
      expect(() => runRelease(root)).toThrow(/main\.js mentions the harness/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
