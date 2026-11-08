import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The workflows are checked as text, because the repository has no YAML parser and adding one only for this
// would be a new dependency. Each rule below traces to the spec (SPEC-release.md, sections 6 and 12).
const read = (path: string) => readFileSync(path, "utf8");

/** The text of every `run:` step, so shell scripts can be checked on their own. */
function runBlocks(workflow: string): string[] {
  const lines = workflow.split(/\r?\n/);
  const blocks: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = /^(\s*)(?:- )?run:\s*(.*)$/.exec(lines[i]);
    if (!match) continue;
    const indent = match[1].length;
    const body = [match[2]];
    // A "|" block runs until a line indented no further than the key.
    while (i + 1 < lines.length && (lines[i + 1].trim() === "" || /^\s*/.exec(lines[i + 1])![0].length > indent)) {
      body.push(lines[++i]);
    }
    blocks.push(body.join("\n"));
  }
  return blocks;
}

describe(".nvmrc", () => {
  it("names the newest LTS major version, once", () => {
    expect(read(".nvmrc").trim()).toBe("26");
  });
});

describe("release workflow", () => {
  const workflow = read(".github/workflows/release.yml");

  it("starts only on a version tag, stable or beta, and never on a branch push", () => {
    const tags = [...workflow.matchAll(/^\s+- '([^']+)'$/gm)].map((m) => m[1]).filter((t) => t.includes("[0-9]"));
    expect(tags).toEqual(["[0-9]+.[0-9]+.[0-9]+", "[0-9]+.[0-9]+.[0-9]+-beta.[0-9]+"]);
    expect(workflow).not.toMatch(/^\s+branches:/m);
    expect(workflow).not.toMatch(/- ["']?\*["']?\s*$/m);
  });

  it("holds read-only permissions, with write access for contents only, on the one job", () => {
    expect(workflow).toMatch(/^permissions:\n  contents: read$/m);
    const writes = workflow.split(/\r?\n/).filter((line) => /:\s*write\s*$/.test(line));
    expect(writes).toEqual(["      contents: write"]);
    expect(workflow).not.toContain("id-token");
    expect(workflow).not.toContain("attestations");
  });

  it("pins every action to a full commit SHA", () => {
    const uses = [...workflow.matchAll(/^\s*- uses: (\S+)/gm)].map((m) => m[1]);
    expect(uses.length).toBeGreaterThanOrEqual(2);
    for (const reference of uses) expect(reference, reference).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
  });

  it("passes the tag to scripts through an environment variable, never inside the script text", () => {
    expect(workflow).toMatch(/^\s+TAG: \$\{\{ github\.ref_name \}\}$/m);
    for (const block of runBlocks(workflow)) expect(block).not.toContain("${{");
    for (const block of runBlocks(workflow).filter((b) => b.includes("TAG"))) {
      // Every use sits inside double quotes, such as "$TAG" or "$TAG^".
      expect(block.replace(/"[^"]*\$TAG[^"]*"/g, "")).not.toMatch(/\$TAG/);
    }
  });

  it("checks out the full history, installs without hooks, and uses the pinned Node version", () => {
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toMatch(/HUSKY: "0"/);
    expect(workflow).toContain("node-version-file: .nvmrc");
    expect(workflow).toContain("npm ci");
  });

  it("runs the checks in order before it publishes", () => {
    const at = (text: string) => {
      const index = workflow.indexOf(text);
      expect(index, text).toBeGreaterThan(-1);
      return index;
    };
    const order = [
      at('check-versions.mjs "$TAG"'),
      at("npm audit --audit-level=high"),
      at("commitlint"),
      at("npm run release"),
      at("stamp-manifest.mjs"),
      at("release-notes.mjs"),
      at("gh release create"),
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("publishes the three plugin files from the tag, as a draft when stable and a prerelease for a beta", () => {
    const create = workflow.slice(workflow.indexOf("- name: Create the release"));
    for (const flag of ["--verify-tag", "--notes-file", "--draft", "--prerelease"]) expect(create).toContain(flag);
    for (const file of ["main.js", "manifest.json", "styles.css"]) expect(create).toContain(`release/daily-page/${file}`);
    expect(workflow).toMatch(/GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  });
});

describe("ci workflow", () => {
  const workflow = read(".github/workflows/ci.yml");

  it("runs on pull requests and on pushes to main, and on no tag", () => {
    expect(workflow).toMatch(/^on:\n  pull_request:\n  push:\n    branches:\n      - main$/m);
    expect(workflow).not.toMatch(/^\s+tags:/m);
  });

  it("can only read: no write permission anywhere, and no publishing", () => {
    expect(workflow).toMatch(/^permissions:\n  contents: read$/m);
    expect(workflow).not.toMatch(/:\s*write\s*$/m);
    expect(workflow).not.toContain("gh release");
    expect(workflow).not.toContain("secrets.");
  });

  it("pins every action to a full commit SHA, with the same pins as the release workflow", () => {
    const pins = (text: string) => [...text.matchAll(/^\s*- uses: (\S+)/gm)].map((m) => m[1]).sort();
    expect(pins(workflow).length).toBeGreaterThanOrEqual(2);
    for (const reference of pins(workflow)) expect(reference, reference).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
    expect(pins(workflow)).toEqual(pins(read(".github/workflows/release.yml")));
  });

  it("writes no expression into a script, passing values through the environment", () => {
    for (const block of runBlocks(workflow)) expect(block).not.toContain("${{");
    expect(workflow).toMatch(/BASE_SHA: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
    expect(workflow).toMatch(/HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  });

  it("checks out the full history, installs without hooks, and uses the pinned Node version", () => {
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toMatch(/HUSKY: "0"/);
    expect(workflow).toContain("node-version-file: .nvmrc");
    expect(workflow).toContain("npm ci");
  });

  it("runs the same gates as a release: build and tests, audit, version files and commit messages", () => {
    expect(workflow).toContain("npm run release");
    expect(workflow).toContain("npm audit --audit-level=high");
    expect(workflow).toContain("node scripts/check-versions.mjs");
    expect(workflow).toContain('commitlint --from "$BASE_SHA" --to "$HEAD_SHA"');
    expect(workflow).toContain("commitlint --last");
  });

  it("lints a range on a pull request and the last commit on a push", () => {
    expect(workflow).toMatch(/if: github\.event_name == 'pull_request'[\s\S]*commitlint --from/);
    expect(workflow).toMatch(/if: github\.event_name == 'push'[\s\S]*commitlint --last/);
  });
});
