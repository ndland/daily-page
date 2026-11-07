import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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

const GOOD: Record<string, string> = {
  "dist/main.js": "module.exports = {};",
  "dist/manifest.json": "{}",
  "dist/styles.css": ".daily-page {}",
  "versions.json": "{}",
};

describe("scripts/package-plugin.mjs", () => {
  it("packages exactly the plugin files and versions.json", () => {
    const root = project(GOOD);
    try {
      runRelease(root);
      expect(readdirSync(join(root, "release", "daily-page")).sort()).toEqual([
        "main.js",
        "manifest.json",
        "styles.css",
        "versions.json",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when the build output is missing", () => {
    const { "dist/main.js": _missing, ...withoutMain } = GOOD;
    const root = project(withoutMain);
    try {
      expect(() => runRelease(root)).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses to package a file that mentions the harness", () => {
    const root = project({ ...GOOD, "dist/styles.css": "/* harness preview */" });
    try {
      expect(() => runRelease(root)).toThrow(/harness/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
