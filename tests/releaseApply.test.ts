import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareRelease } from "../scripts/release-prepare.mjs";
import { cleanupRepos, repo, withFakeChangelog } from "./helpers/releaseRepo";

afterEach(cleanupRepos);

const read = (dir: string, name: string) => readFileSync(join(dir, name), "utf8");

describe("prepareRelease: applying a stable release", () => {
  it("bumps the version files, commits them with the changelog, and tags the commit", () => {
    const r = repo();
    withFakeChangelog(r);
    r.commit("feat(plan): add a thing");

    const result = prepareRelease(r.deps, {});

    expect(result.version).toBe("0.2.0");
    expect(r.git("log", "-1", "--format=%s")).toBe("chore(release): 0.2.0");
    expect(r.git("show", "--name-only", "--format=", "HEAD").split("\n").sort()).toEqual([
      "CHANGELOG.md",
      "manifest.json",
      "package-lock.json",
      "package.json",
    ]);
    expect(JSON.parse(read(r.dir, "package.json")).version).toBe("0.2.0");
    const lock = JSON.parse(read(r.dir, "package-lock.json"));
    expect([lock.version, lock.packages[""].version]).toEqual(["0.2.0", "0.2.0"]);
    expect(JSON.parse(read(r.dir, "manifest.json")).version).toBe("0.2.0");
    expect(r.git("status", "--porcelain")).toBe("");
  });

  it("makes an annotated tag on the release commit, because push --follow-tags sends only those", () => {
    const r = repo();
    withFakeChangelog(r);
    r.commit("fix(tags): repair a thing");
    prepareRelease(r.deps, {});
    expect(r.git("cat-file", "-t", "0.1.2")).toBe("tag");
    expect(r.git("rev-parse", "0.1.2^{commit}")).toBe(r.git("rev-parse", "HEAD"));
  });

  it("changes only the version in each file, keeping its formatting", () => {
    const r = repo();
    withFakeChangelog(r);
    r.commit("feat(plan): add a thing");
    const before = read(r.dir, "package.json");
    prepareRelease(r.deps, {});
    expect(read(r.dir, "package.json")).toBe(before.replace('"version": "0.1.1"', '"version": "0.2.0"'));
  });

  it("leaves versions.json alone while minAppVersion is unchanged", () => {
    const r = repo();
    withFakeChangelog(r);
    r.commit("feat(plan): add a thing");
    const before = read(r.dir, "versions.json");
    prepareRelease(r.deps, {});
    expect(read(r.dir, "versions.json")).toBe(before);
  });

  it("adds a versions.json entry when minAppVersion has changed, and commits it", () => {
    const r = repo({ minAppVersion: "1.6.0" });
    withFakeChangelog(r);
    r.commit("feat(plan): add a thing");
    prepareRelease(r.deps, {});
    expect(JSON.parse(read(r.dir, "versions.json"))).toEqual({ "0.1.1": "1.5.0", "0.2.0": "1.6.0" });
    expect(r.git("show", "--name-only", "--format=", "HEAD")).toContain("versions.json");
  });

  it("tells you to push the tag, and does not push", () => {
    const r = repo();
    withFakeChangelog(r);
    r.commit("feat(plan): add a thing");
    prepareRelease(r.deps, {});
    expect(r.messages.join("\n")).toContain("git push --follow-tags");
    expect(r.git("remote")).toBe("");
  });
});

describe("prepareRelease: refusing to start", () => {
  it("refuses off main, and changes nothing", () => {
    const r = repo();
    withFakeChangelog(r);
    r.commit("feat(plan): add a thing");
    r.git("switch", "-q", "-c", "topic");
    const head = r.git("rev-parse", "HEAD");
    expect(() => prepareRelease(r.deps, {})).toThrow(/main/);
    expect(r.git("rev-parse", "HEAD")).toBe(head);
    expect(r.git("tag", "--list", "0.2.0")).toBe("");
  });

  it("refuses a working tree with uncommitted changes, and changes nothing", () => {
    const r = repo();
    withFakeChangelog(r);
    r.commit("feat(plan): add a thing");
    writeFileSync(join(r.dir, "notes.txt"), "unrelated work");
    expect(() => prepareRelease(r.deps, {})).toThrow(/uncommitted/);
    expect(r.git("tag", "--list", "0.2.0")).toBe("");
    expect(read(r.dir, "notes.txt")).toBe("unrelated work");
  });

  it("refuses a version whose tag already exists", () => {
    const r = repo();
    withFakeChangelog(r);
    r.commit("feat(plan): add a thing");
    r.tag("0.3.0");
    r.commit("fix(tags): after the tag");
    expect(() => prepareRelease(r.deps, { version: "0.3.0" })).toThrow(/already exists/);
  });
});

describe("prepareRelease: a failure leaves nothing behind", () => {
  it("restores every file when the changelog step fails", () => {
    const r = repo();
    // Only the changelog step fails, so the gates pass and the failure comes after the files were written.
    r.deps.run = (_command: string, args: string[]) => ({ ok: !args.includes("changelog"), output: "changelog broke" });
    r.commit("feat(plan): add a thing");
    const head = r.git("rev-parse", "HEAD");
    const before = read(r.dir, "package.json");

    expect(() => prepareRelease(r.deps, {})).toThrow(/changelog broke/);

    expect(r.git("rev-parse", "HEAD")).toBe(head);
    expect(r.git("status", "--porcelain")).toBe("");
    expect(read(r.dir, "package.json")).toBe(before);
    expect(existsSync(join(r.dir, "CHANGELOG.md"))).toBe(false);
    expect(r.git("tag", "--list", "0.2.0")).toBe("");
  });

  it("rolls back the files when the commit is rejected, for example by a commit hook", () => {
    const r = repo();
    withFakeChangelog(r);
    r.commit("feat(plan): add a thing");
    const hook = join(r.dir, ".git", "hooks", "commit-msg");
    writeFileSync(hook, "#!/bin/sh\necho rejected by the hook >&2\nexit 1\n");
    chmodSync(hook, 0o755);
    const head = r.git("rev-parse", "HEAD");

    expect(() => prepareRelease(r.deps, {})).toThrow();

    expect(r.git("rev-parse", "HEAD")).toBe(head);
    expect(r.git("status", "--porcelain")).toBe("");
    expect(JSON.parse(read(r.dir, "manifest.json")).version).toBe("0.1.1");
    expect(existsSync(join(r.dir, "CHANGELOG.md"))).toBe(false);
    expect(r.git("tag", "--list", "0.2.0")).toBe("");
  });

  it("drops the release commit when tagging fails after the commit was made", () => {
    const r = repo();
    withFakeChangelog(r);
    r.commit("feat(plan): add a thing");
    // Signing a tag with a program that does not exist makes `git tag` fail, after `git commit` has worked.
    r.git("config", "tag.gpgsign", "true");
    r.git("config", "gpg.program", "no-such-signing-program");
    const head = r.git("rev-parse", "HEAD");

    expect(() => prepareRelease(r.deps, {})).toThrow();

    expect(r.git("rev-parse", "HEAD")).toBe(head);
    expect(r.git("status", "--porcelain")).toBe("");
    expect(JSON.parse(read(r.dir, "package.json")).version).toBe("0.1.1");
    expect(existsSync(join(r.dir, "CHANGELOG.md"))).toBe(false);
    expect(r.git("tag", "--list", "0.2.0")).toBe("");
  });

  it("restores a changelog that already existed", () => {
    const r = repo();
    writeFileSync(join(r.dir, "CHANGELOG.md"), "## 0.1.1 (old)\n");
    r.git("add", ".");
    r.git("commit", "-q", "-m", "docs(changelog): add one");
    // Only the changelog step fails, so the gates pass and the failure comes after the files were written.
    r.deps.run = (_command: string, args: string[]) => ({ ok: !args.includes("changelog"), output: "changelog broke" });
    r.commit("feat(plan): add a thing");

    expect(() => prepareRelease(r.deps, {})).toThrow();

    expect(read(r.dir, "CHANGELOG.md")).toBe("## 0.1.1 (old)\n");
    expect(r.git("status", "--porcelain")).toBe("");
  });
});
