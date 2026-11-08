import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareRelease } from "../scripts/release-prepare.mjs";
import { cleanupRepos, repo } from "./helpers/releaseRepo";

afterEach(cleanupRepos);

describe("prepareRelease: a beta", () => {
  it("makes only an annotated tag on the current commit, with no commit and no file change", () => {
    const r = repo();
    r.commit("feat(plan): add a thing");
    const head = r.git("rev-parse", "HEAD");
    const manifest = readFileSync(join(r.dir, "manifest.json"), "utf8");

    const result = prepareRelease(r.deps, { beta: true });

    expect(result.version).toBe("0.2.0-beta.1");
    expect(r.git("cat-file", "-t", "0.2.0-beta.1")).toBe("tag");
    expect(r.git("rev-parse", "0.2.0-beta.1^{commit}")).toBe(head);
    expect(r.git("rev-parse", "HEAD")).toBe(head);
    expect(r.git("status", "--porcelain")).toBe("");
    expect(readFileSync(join(r.dir, "manifest.json"), "utf8")).toBe(manifest);
    expect(JSON.parse(readFileSync(join(r.dir, "versions.json"), "utf8"))).toEqual({ "0.1.1": "1.5.0" });
  });

  it("numbers the next beta of the same version one higher, and ignores betas when counting commits", () => {
    const r = repo();
    r.commit("feat(plan): add a thing");
    prepareRelease(r.deps, { beta: true });
    r.commit("fix(tags): a later fix");
    expect(prepareRelease(r.deps, { beta: true }).version).toBe("0.2.0-beta.2");
  });

  it("takes an explicit base version, which must be higher than the current version", () => {
    const r = repo();
    r.commit("docs(readme): words");
    expect(prepareRelease(r.deps, { beta: true, version: "0.3.0" }).version).toBe("0.3.0-beta.1");
    expect(() => prepareRelease(r.deps, { beta: true, version: "0.1.1" })).toThrow("higher");
  });

  it("shows the tag and creates nothing in a dry run", () => {
    const r = repo();
    r.commit("feat(plan): add a thing");
    prepareRelease(r.deps, { beta: true, dryRun: true });
    expect(r.git("tag", "--list", "0.2.0-beta.1")).toBe("");
    expect(r.messages.join("\n")).toContain("0.2.0-beta.1");
  });

  it("refuses when there is nothing to base a beta on", () => {
    const r = repo();
    r.commit("docs(readme): words");
    expect(() => prepareRelease(r.deps, { beta: true })).toThrow(/nothing to release/i);
  });

  it("refuses off main, and on a dirty working tree", () => {
    const r = repo();
    r.commit("feat(plan): add a thing");
    writeFileSync(join(r.dir, "notes.txt"), "unrelated work");
    expect(() => prepareRelease(r.deps, { beta: true })).toThrow(/uncommitted/);
    unlinkSync(join(r.dir, "notes.txt"));

    r.git("switch", "-q", "-c", "topic");
    expect(() => prepareRelease(r.deps, { beta: true })).toThrow(/main/);
    expect(r.git("tag", "--list", "0.2.0-beta.1")).toBe("");
  });

  it("tells you to push just the tag, because a beta adds no commit", () => {
    const r = repo();
    r.commit("feat(plan): add a thing");
    prepareRelease(r.deps, { beta: true });
    expect(r.messages.join("\n")).toContain("git push origin 0.2.0-beta.1");
  });
});
