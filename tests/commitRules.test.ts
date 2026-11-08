import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/** Runs the real commitlint CLI on a message, with the project's config, as the commit-msg hook does. */
function lint(message: string): { accepted: boolean; output: string } {
  const cli = "node_modules/@commitlint/cli/cli.js";
  const run = spawnSync(process.execPath, [cli], { input: message, encoding: "utf8" });
  return { accepted: run.status === 0, output: `${run.stdout}${run.stderr}` };
}

describe("commit message rules", () => {
  it("accepts a type, a listed scope and a subject, with or without a body", () => {
    expect(lint("fix(plan): refuse a block over 12 hours\n").accepted).toBe(true);
    expect(lint("fix(plan): refuse a block over 12 hours\n\nThe span rule was skipped for plans.\n").accepted).toBe(true);
  });

  it("refuses a missing scope, an unlisted scope, and a message that is not conventional", () => {
    expect(lint("feat: add a thing\n").accepted).toBe(false);
    expect(lint("feat(banana): add a thing\n").accepted).toBe(false);
    expect(lint("added some stuff\n").accepted).toBe(false);
  });

  it("refuses trailers, whatever their case", () => {
    for (const trailer of [
      "Co-Authored-By: Someone <a@b.c>",
      "co-authored-by: Someone <a@b.c>",
      "Signed-off-by: Nick <a@b.c>",
      "🤖 Generated with [Claude Code](https://claude.com/claude-code)",
    ]) {
      const result = lint(`fix(plan): a thing\n\n${trailer}\n`);
      expect(result.accepted, trailer).toBe(false);
      expect(result.output).toContain("no-trailers");
    }
  });

  it("still allows a BREAKING CHANGE footer, comment lines, and prose that starts with Generated with", () => {
    expect(lint("fix(plan): a thing\n\nBody.\n\nBREAKING CHANGE: the format changed\n").accepted).toBe(true);
    expect(lint("fix(plan): a thing\n\n# Co-Authored-By: a comment git drops\n").accepted).toBe(true);
    expect(lint("fix(plan): a thing\n\nGenerated with the new script instead of by hand.\n").accepted).toBe(true);
    // A wrapped body can start a line with these words, so only the real credit form is refused.
    expect(lint("fix(plan): a thing\n\nGenerated with Claude Code, then checked by hand.\n").accepted).toBe(true);
  });
});
