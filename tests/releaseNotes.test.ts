import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { extractNotes, formatBetaNotes } from "../scripts/lib/release.mjs";

const SCRIPT = resolve("scripts/release-notes.mjs");
const folders: string[] = [];

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

const CHANGELOG = [
  "## [0.3.0](https://github.com/ndland/daily-page/compare/0.2.0...0.3.0) (2026-12-01)",
  "",
  "### Features",
  "",
  "* **plan:** add a thing ([abc1234](https://example.com/abc1234))",
  "",
  "## 0.2.0 (2026-11-20)",
  "",
  "### Bug Fixes",
  "",
  "* **tags:** fix a thing",
  "",
  "## 0.1.1 (2026-11-08)",
  "",
  "### Features",
  "",
  "* **render:** first thing",
  "",
].join("\n");

describe("extractNotes", () => {
  it("returns one version's section, for a heading with a link and for one without", () => {
    expect(extractNotes(CHANGELOG, "0.3.0")).toBe(
      "### Features\n\n* **plan:** add a thing ([abc1234](https://example.com/abc1234))",
    );
    expect(extractNotes(CHANGELOG, "0.2.0")).toBe("### Bug Fixes\n\n* **tags:** fix a thing");
  });

  it("stops at the next version heading, and reads the last section to the end", () => {
    expect(extractNotes(CHANGELOG, "0.2.0")).not.toContain("first thing");
    expect(extractNotes(CHANGELOG, "0.1.1")).toBe("### Features\n\n* **render:** first thing");
  });

  it("does not match a version that only starts the same way, and gives null when there is none", () => {
    expect(extractNotes(CHANGELOG, "0.2")).toBeNull();
    expect(extractNotes(CHANGELOG, "0.2.00")).toBeNull();
    expect(extractNotes(CHANGELOG, "9.9.9")).toBeNull();
    expect(extractNotes("", "0.1.1")).toBeNull();
  });
});

describe("formatBetaNotes", () => {
  it("lists the feat, fix and breaking commits under a pre-release heading", () => {
    const notes = formatBetaNotes("0.2.0", [
      "feat(plan): add a thing",
      "docs(readme): words",
      "fix(tags): repair a thing",
      "chore(release): 0.1.1",
      "refactor(logic)!: rename a helper",
    ]);
    expect(notes).toContain("Pre-release of 0.2.0");
    expect(notes).toContain("- feat(plan): add a thing");
    expect(notes).toContain("- fix(tags): repair a thing");
    expect(notes).toContain("- refactor(logic)!: rename a helper");
    expect(notes).not.toContain("words");
    expect(notes).not.toContain("0.1.1");
  });

  it("says so when there is nothing user-facing yet", () => {
    expect(formatBetaNotes("0.2.0", ["docs(readme): words"])).toContain("No user-facing changes");
    expect(formatBetaNotes("0.2.0", [])).toContain("No user-facing changes");
  });
});

describe("release-notes command", () => {
  function notes(folder: string, tag: string) {
    const run = spawnSync(process.execPath, [SCRIPT, tag], { cwd: folder, encoding: "utf8" });
    return { status: run.status, stdout: run.stdout, output: `${run.stdout}${run.stderr}` };
  }

  function folder(): string {
    const made = mkdtempSync(join(tmpdir(), "daily-page-notes-"));
    folders.push(made);
    return made;
  }

  it("prints a stable version's changelog section", () => {
    const dir = folder();
    writeFileSync(join(dir, "CHANGELOG.md"), CHANGELOG);
    const result = notes(dir, "0.2.0");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("### Bug Fixes\n\n* **tags:** fix a thing");
  });

  it("fails and says so when the changelog has no section for the version", () => {
    const dir = folder();
    writeFileSync(join(dir, "CHANGELOG.md"), CHANGELOG);
    const result = notes(dir, "9.9.9");
    expect(result.status).toBe(1);
    expect(result.output).toContain("9.9.9");
  });

  it("fails when there is no changelog at all", () => {
    expect(notes(folder(), "0.2.0").status).toBe(1);
  });

  it("prints a beta's notes from the commits since the last stable tag", () => {
    const dir = folder();
    const git = (...args: string[]) =>
      execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd: dir });
    git("init", "-q", "-b", "main");
    git("commit", "-q", "--allow-empty", "-m", "feat(plan): old thing");
    git("tag", "-a", "0.1.1", "-m", "0.1.1");
    git("commit", "-q", "--allow-empty", "-m", "feat(plan): new thing");
    git("commit", "-q", "--allow-empty", "-m", "docs(readme): words");
    git("commit", "-q", "--allow-empty", "-m", "fix(tags): new fix");

    const result = notes(dir, "0.2.0-beta.1");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Pre-release of 0.2.0");
    expect(result.stdout).toContain("- feat(plan): new thing");
    expect(result.stdout).toContain("- fix(tags): new fix");
    expect(result.stdout).not.toContain("old thing");
    expect(result.stdout).not.toContain("words");
  });
});
