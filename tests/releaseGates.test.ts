import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareRelease } from "../scripts/release-prepare.mjs";
import { cleanupRepos, repo, withFakeChangelog } from "./helpers/releaseRepo";

afterEach(cleanupRepos);

const GATES = [
  { name: "tests", command: "npm test" },
  { name: "type check", command: "npx tsc --noEmit" },
  { name: "dependency audit", command: "npm audit --audit-level=high" },
  { name: "commit messages", command: "npx commitlint --from 0.1.1 --to HEAD" },
];

describe("prepareRelease: gates", () => {
  it("runs every gate, in order, before it changes anything", () => {
    const r = repo();
    withFakeChangelog(r);
    r.commit("feat(plan): add a thing");
    prepareRelease(r.deps, {});
    expect(r.runs).toEqual([...GATES.map((gate) => gate.command), "npm run changelog"]);
  });

  it("runs the gates in a dry run too, and generates no changelog", () => {
    const r = repo();
    r.commit("feat(plan): add a thing");
    prepareRelease(r.deps, { dryRun: true });
    expect(r.runs).toEqual(GATES.map((gate) => gate.command));
  });

  it("runs the gates before tagging a beta", () => {
    const r = repo();
    r.commit("feat(plan): add a thing");
    prepareRelease(r.deps, { beta: true });
    expect(r.runs).toEqual(GATES.map((gate) => gate.command));
    expect(r.git("tag", "--list", "0.2.0-beta.1")).toBe("0.2.0-beta.1");
  });

  for (const [index, gate] of GATES.entries()) {
    it(`stops at a failing ${gate.name} gate, shows its output, and leaves nothing behind`, () => {
      const r = repo();
      withFakeChangelog(r);
      r.commit("feat(plan): add a thing");
      const original = r.deps.run;
      r.deps.run = (command: string, args: string[]) => {
        const line = [command, ...args].join(" ");
        const result = original(command, args);
        return line === gate.command ? { ok: false, output: "first line\nTHE GATE OUTPUT" } : result;
      };
      const head = r.git("rev-parse", "HEAD");
      const manifest = readFileSync(join(r.dir, "manifest.json"), "utf8");

      expect(() => prepareRelease(r.deps, {})).toThrow(new RegExp(`Gate failed: ${gate.name}[\\s\\S]*THE GATE OUTPUT`));

      // Later gates never ran, and nothing was written, committed or tagged.
      expect(r.runs).toEqual(GATES.slice(0, index + 1).map((g) => g.command));
      expect(r.git("rev-parse", "HEAD")).toBe(head);
      expect(r.git("status", "--porcelain")).toBe("");
      expect(readFileSync(join(r.dir, "manifest.json"), "utf8")).toBe(manifest);
      expect(r.git("tag", "--list", "0.2.0")).toBe("");
    });
  }

  it("stops when the version files disagree, naming the file", () => {
    const r = repo();
    writeFileSync(join(r.dir, "manifest.json"), JSON.stringify({ id: "x", version: "0.1.2", minAppVersion: "1.5.0" }, null, 2) + "\n");
    r.git("add", ".");
    r.git("commit", "-q", "-m", "fix(tags): edit the manifest by hand");
    r.commit("feat(plan): add a thing");
    expect(() => prepareRelease(r.deps, {})).toThrow(/Gate failed: version files[\s\S]*package\.json/);
    expect(r.git("tag", "--list", "0.2.0")).toBe("");
  });

  it("skips the commit message gate, and says so, when there is no earlier release", () => {
    const r = repo({ tagged: false });
    r.commit("feat(plan): add a thing");
    prepareRelease(r.deps, { dryRun: true });
    expect(r.runs.some((line) => line.includes("commitlint"))).toBe(false);
    expect(r.messages.join("\n")).toContain("commit message check was skipped");
  });

  it("checks the branch and the working tree before it spends time on the gates", () => {
    const r = repo();
    r.commit("feat(plan): add a thing");
    r.git("switch", "-q", "-c", "topic");
    expect(() => prepareRelease(r.deps, {})).toThrow(/main/);
    expect(r.runs).toEqual([]);
  });
});
