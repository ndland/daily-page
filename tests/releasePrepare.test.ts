import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDeps, parseArgs, prepareRelease } from "../scripts/release-prepare.mjs";

const folders: string[] = [];

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

interface Repo {
  dir: string;
  git: (...args: string[]) => string;
  commit: (subject: string, body?: string) => void;
  tag: (name: string) => void;
  messages: string[];
  deps: ReturnType<typeof createDeps>;
}

/** A real git repository on `main` at version 0.1.1, tagged 0.1.1, with the four version files committed. */
function repo(options: { minAppVersion?: string; tagged?: boolean } = {}): Repo {
  const dir = mkdtempSync(join(tmpdir(), "daily-page-prepare-"));
  folders.push(dir);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.com");
  git("config", "commit.gpgsign", "false");
  git("config", "tag.gpgsign", "false");

  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(join(dir, "package.json"), json({ name: "x", version: "0.1.1" }));
  writeFileSync(join(dir, "package-lock.json"), json({ name: "x", version: "0.1.1", packages: { "": { version: "0.1.1" } } }));
  writeFileSync(join(dir, "manifest.json"), json({ id: "x", version: "0.1.1", minAppVersion: options.minAppVersion ?? "1.5.0" }));
  writeFileSync(join(dir, "versions.json"), json({ "0.1.1": "1.5.0" }));
  git("add", ".");
  git("commit", "-q", "-m", "chore(release): 0.1.1");
  if (options.tagged !== false) git("tag", "-a", "0.1.1", "-m", "0.1.1");

  const messages: string[] = [];
  const deps = createDeps(dir);
  deps.log = (message: string) => messages.push(message);
  return {
    dir,
    git,
    messages,
    deps,
    commit: (subject, body) => git("commit", "-q", "--allow-empty", "-m", subject, ...(body ? ["-m", body] : [])),
    tag: (name) => git("tag", "-a", name, "-m", name),
  };
}

describe("parseArgs", () => {
  it("reads the flags and an explicit version", () => {
    expect(parseArgs([])).toEqual({ dryRun: false, beta: false, version: undefined });
    expect(parseArgs(["--dry-run", "--beta"])).toEqual({ dryRun: true, beta: true, version: undefined });
    expect(parseArgs(["0.3.0"])).toEqual({ dryRun: false, beta: false, version: "0.3.0" });
  });

  it("refuses an unknown flag and a second version", () => {
    expect(() => parseArgs(["--bogus"])).toThrow("--bogus");
    expect(() => parseArgs(["0.3.0", "0.4.0"])).toThrow("one version");
  });
});

describe("prepareRelease: choosing the version (dry run)", () => {
  it("bumps the minor number for a feat since the last stable tag, and says why", () => {
    const r = repo();
    r.commit("feat(plan): add a thing");
    r.commit("docs(readme): words");
    const result = prepareRelease(r.deps, { dryRun: true });
    expect(result.version).toBe("0.2.0");
    expect(result.bump).toBe("minor");
    expect(r.messages.join("\n")).toContain("0.2.0");
    expect(r.messages.join("\n")).toContain("1 feat");
  });

  it("bumps the patch for a fix, and the minor number for a breaking change below 1.0", () => {
    const fixed = repo();
    fixed.commit("fix(tags): repair a thing");
    expect(prepareRelease(fixed.deps, { dryRun: true }).version).toBe("0.1.2");

    const breaking = repo();
    breaking.commit("fix(tags)!: change a format");
    expect(prepareRelease(breaking.deps, { dryRun: true }).version).toBe("0.2.0");

    const body = repo();
    body.commit("refactor(logic): rename", "BREAKING CHANGE: the helper moved");
    expect(prepareRelease(body.deps, { dryRun: true }).version).toBe("0.2.0");
  });

  it("only counts commits after the last stable tag, and ignores a beta tag", () => {
    const r = repo();
    r.commit("feat(plan): before the beta");
    r.tag("0.2.0-beta.1");
    r.commit("fix(tags): after the beta");
    expect(prepareRelease(r.deps, { dryRun: true }).version).toBe("0.2.0");
  });

  it("ignores commits made before the last stable tag", () => {
    const r = repo();
    r.commit("feat(plan): already shipped");
    r.tag("0.1.2");
    r.commit("fix(tags): after the release");
    expect(prepareRelease(r.deps, { dryRun: true }).version).toBe("0.1.2");
  });

  it("refuses when nothing since the last release is a feat, a fix or breaking", () => {
    const r = repo();
    r.commit("docs(readme): words");
    r.commit("chore(deps): bump");
    expect(() => prepareRelease(r.deps, { dryRun: true })).toThrow(/nothing to release/i);
  });

  it("works when there is no tag yet, counting every commit", () => {
    const r = repo({ tagged: false });
    r.commit("feat(plan): add a thing");
    expect(prepareRelease(r.deps, { dryRun: true }).version).toBe("0.2.0");
  });

  it("takes an explicit version over the commits, and refuses one that is not higher or not a version", () => {
    const r = repo();
    r.commit("docs(readme): words");
    expect(prepareRelease(r.deps, { dryRun: true, version: "0.3.0" }).version).toBe("0.3.0");
    expect(() => prepareRelease(r.deps, { dryRun: true, version: "0.1.1" })).toThrow("higher");
    expect(() => prepareRelease(r.deps, { dryRun: true, version: "0.1.0" })).toThrow("higher");
    expect(() => prepareRelease(r.deps, { dryRun: true, version: "v0.3.0" })).toThrow("v0.3.0");
  });

  it("lists the files it would change, and changes nothing", () => {
    const r = repo();
    r.commit("feat(plan): add a thing");
    const before = readFileSync(join(r.dir, "manifest.json"), "utf8");
    const result = prepareRelease(r.deps, { dryRun: true });
    expect(result.files).toEqual(["package.json", "package-lock.json", "manifest.json", "CHANGELOG.md"]);
    expect(r.git("status", "--porcelain")).toBe("");
    expect(readFileSync(join(r.dir, "manifest.json"), "utf8")).toBe(before);
  });
});
