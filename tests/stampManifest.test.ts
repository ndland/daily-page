import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { toJson } from "../scripts/lib/release.mjs";

const SCRIPT = resolve("scripts/stamp-manifest.mjs");
const folders: string[] = [];

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

function packageDir(manifest: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), "daily-page-stamp-"));
  folders.push(dir);
  if (manifest !== null) writeFileSync(join(dir, "manifest.json"), manifest);
  return dir;
}

function stamp(dir: string, version: string) {
  const run = spawnSync(process.execPath, [SCRIPT, dir, version], { encoding: "utf8" });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

const MANIFEST = '{\n  "id": "daily-page",\n  "version": "0.1.1",\n  "minAppVersion": "1.5.0"\n}\n';

describe("stamp-manifest", () => {
  it("sets the version in the packaged manifest and changes nothing else", () => {
    const dir = packageDir(MANIFEST);
    expect(stamp(dir, "0.2.0-beta.1").status).toBe(0);
    expect(readFileSync(join(dir, "manifest.json"), "utf8")).toBe(MANIFEST.replace("0.1.1", "0.2.0-beta.1"));
  });

  it("changes nothing when the manifest already has the version, as for a stable release", () => {
    const dir = packageDir(MANIFEST);
    expect(stamp(dir, "0.1.1").status).toBe(0);
    expect(readFileSync(join(dir, "manifest.json"), "utf8")).toBe(MANIFEST);
  });

  it("refuses a version that is not a version, leaving the manifest as it was", () => {
    const dir = packageDir(MANIFEST);
    const result = stamp(dir, "v0.2.0");
    expect(result.status).toBe(1);
    expect(result.output).toContain("v0.2.0");
    expect(readFileSync(join(dir, "manifest.json"), "utf8")).toBe(MANIFEST);
  });

  it("fails clearly when there is no manifest", () => {
    const result = stamp(packageDir(null), "0.2.0");
    expect(result.status).toBe(1);
    expect(result.output).toContain("manifest.json");
  });
});

describe("toJson", () => {
  it("keeps the line endings and the presence of a final newline", () => {
    expect(toJson('{\r\n  "a": 1\r\n}\r\n', { a: 2 })).toBe('{\r\n  "a": 2\r\n}\r\n');
    expect(toJson('{\n  "a": 1\n}', { a: 2 })).toBe('{\n  "a": 2\n}');
  });
});
