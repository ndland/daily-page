import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = resolve("scripts/check-versions.mjs");
const folders: string[] = [];

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

/** A project folder with the four version files, each at 0.1.1 unless changed. */
function project(changes: Record<string, unknown> = {}): string {
  const files: Record<string, unknown> = {
    "package.json": { name: "x", version: "0.1.1" },
    "package-lock.json": { name: "x", version: "0.1.1", packages: { "": { version: "0.1.1" } } },
    "manifest.json": { id: "x", version: "0.1.1", minAppVersion: "1.5.0" },
    "versions.json": { "0.1.1": "1.5.0" },
    ...changes,
  };
  const folder = mkdtempSync(join(tmpdir(), "daily-page-versions-"));
  folders.push(folder);
  for (const [name, content] of Object.entries(files)) {
    if (content !== null) writeFileSync(join(folder, name), JSON.stringify(content, null, 2));
  }
  return folder;
}

function check(folder: string, ...args: string[]) {
  const run = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: folder, encoding: "utf8" });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

describe("check-versions", () => {
  it("passes when the files agree, and says which version", () => {
    const result = check(project());
    expect(result.status).toBe(0);
    expect(result.output).toContain("0.1.1");
  });

  it("passes when the tag equals the version", () => {
    expect(check(project(), "0.1.1").status).toBe(0);
  });

  it("fails and names the file that is off", () => {
    const folder = project({ "manifest.json": { version: "0.1.2", minAppVersion: "1.5.0" } });
    const result = check(folder);
    expect(result.status).toBe(1);
    expect(result.output).toContain("manifest.json");
  });

  it("fails when the tag does not match the version", () => {
    const result = check(project(), "0.2.0");
    expect(result.status).toBe(1);
    expect(result.output).toContain("0.2.0");
  });

  it("accepts a beta tag for a higher version, and refuses one for the same version", () => {
    expect(check(project(), "0.2.0-beta.1").status).toBe(0);
    expect(check(project(), "0.1.1-beta.1").status).toBe(1);
  });

  it("fails clearly when a version file is missing", () => {
    const result = check(project({ "versions.json": null }));
    expect(result.status).toBe(1);
    expect(result.output).toContain("versions.json");
  });
});
