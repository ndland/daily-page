import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("the changelog script", () => {
  const script: string = JSON.parse(readFileSync("package.json", "utf8")).scripts.changelog;

  // A beta tag such as 0.2.0-beta.1 is not a release. Without this option the generator wrote a section for it,
  // and an empty section above it for the stable version, which the first live beta showed.
  it("skips beta tags, so a beta never appears in the changelog", () => {
    expect(script).toContain("--skip-unstable");
  });

  it("regenerates the whole file from the commits, in the conventional commits format", () => {
    expect(script).toContain("-p conventionalcommits");
    expect(script).toContain("-r 0");
  });
});
