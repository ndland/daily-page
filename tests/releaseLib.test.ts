import { describe, expect, it } from "vitest";
import {
  checkVersions,
  compareVersions,
  lastStableTag,
  nextBeta,
  nextVersion,
  parseCommit,
  parseVersion,
  versionsJsonNeedsEntry,
} from "../scripts/lib/release.mjs";

describe("parseVersion", () => {
  it("reads a stable version and a beta version", () => {
    expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, beta: null });
    expect(parseVersion("0.2.0-beta.4")).toEqual({ major: 0, minor: 2, patch: 0, beta: 4 });
  });

  it("refuses anything else, including a v prefix and other prerelease names", () => {
    for (const text of ["v1.2.3", "1.2", "1.2.3-rc.1", "1.2.3-beta", "1.2.3.4", ""]) {
      expect(parseVersion(text), text).toBeNull();
    }
  });
});

describe("compareVersions", () => {
  it("orders by number, not by text", () => {
    expect(compareVersions("0.10.0", "0.9.0")).toBeGreaterThan(0);
    expect(compareVersions("0.1.1", "0.2.0")).toBeLessThan(0);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
  });

  it("puts a beta before its stable version, and betas in order", () => {
    expect(compareVersions("0.2.0-beta.1", "0.2.0")).toBeLessThan(0);
    expect(compareVersions("0.2.0", "0.2.0-beta.1")).toBeGreaterThan(0);
    expect(compareVersions("0.2.0-beta.2", "0.2.0-beta.1")).toBeGreaterThan(0);
    expect(compareVersions("0.2.0-beta.9", "0.1.9")).toBeGreaterThan(0);
  });
});

describe("parseCommit", () => {
  it("reads the type and whether the change is breaking", () => {
    expect(parseCommit("feat(plan): add a thing")).toEqual({ type: "feat", breaking: false });
    expect(parseCommit("fix(plan)!: change a format")).toEqual({ type: "fix", breaking: true });
    expect(parseCommit("chore(release): 0.2.0", "BREAKING CHANGE: the format changed")).toEqual({
      type: "chore",
      breaking: true,
    });
  });

  it("gives no type for a message that is not conventional", () => {
    expect(parseCommit("added some stuff")).toEqual({ type: null, breaking: false });
  });
});

describe("nextVersion", () => {
  const feat = { type: "feat", breaking: false };
  const fix = { type: "fix", breaking: false };
  const docs = { type: "docs", breaking: false };

  it("below 1.0, a feat bumps the minor number and a fix bumps the patch", () => {
    expect(nextVersion("0.1.1", [feat])).toEqual({ version: "0.2.0", bump: "minor" });
    expect(nextVersion("0.1.1", [fix])).toEqual({ version: "0.1.2", bump: "patch" });
    expect(nextVersion("0.1.1", [fix, feat, docs])).toEqual({ version: "0.2.0", bump: "minor" });
  });

  it("below 1.0, a breaking change bumps the minor number", () => {
    expect(nextVersion("0.1.1", [{ type: "fix", breaking: true }])).toEqual({ version: "0.2.0", bump: "minor" });
  });

  it("from 1.0, a breaking change bumps the major number", () => {
    expect(nextVersion("1.2.3", [{ type: "fix", breaking: true }])).toEqual({ version: "2.0.0", bump: "major" });
    expect(nextVersion("1.2.3", [feat])).toEqual({ version: "1.3.0", bump: "minor" });
    expect(nextVersion("1.2.3", [fix])).toEqual({ version: "1.2.4", bump: "patch" });
  });

  it("gives nothing when no commit is a feat, a fix or breaking", () => {
    expect(nextVersion("0.1.1", [docs, { type: "chore", breaking: false }])).toBeNull();
    expect(nextVersion("0.1.1", [])).toBeNull();
  });
});

describe("tags", () => {
  const tags = ["0.1.0", "0.1.1", "0.2.0-beta.1", "0.2.0-beta.2", "0.3.0-beta.9", "not-a-version"];

  it("numbers the next beta from the betas of the same base version", () => {
    expect(nextBeta("0.2.0", tags)).toBe("0.2.0-beta.3");
    expect(nextBeta("0.3.0", tags)).toBe("0.3.0-beta.10");
    expect(nextBeta("0.4.0", tags)).toBe("0.4.0-beta.1");
  });

  it("finds the highest stable tag, ignoring betas and other tags", () => {
    expect(lastStableTag(tags)).toBe("0.1.1");
    expect(lastStableTag(["0.2.0-beta.1", "x"])).toBeNull();
  });
});

describe("versionsJsonNeedsEntry", () => {
  it("is false while minAppVersion matches the newest entry, and true when it changes", () => {
    const versions = { "0.1.0": "1.5.0", "0.1.1": "1.5.0" };
    expect(versionsJsonNeedsEntry(versions, "1.5.0")).toBe(false);
    expect(versionsJsonNeedsEntry(versions, "1.6.0")).toBe(true);
  });

  it("finds the newest entry by version, not by position, and needs one when empty", () => {
    expect(versionsJsonNeedsEntry({ "0.2.0": "1.6.0", "0.1.0": "1.5.0" }, "1.6.0")).toBe(false);
    expect(versionsJsonNeedsEntry({}, "1.5.0")).toBe(true);
  });
});

describe("checkVersions", () => {
  const files = () => ({
    packageJson: { version: "0.1.1" },
    lock: { version: "0.1.1", packages: { "": { version: "0.1.1" } } },
    manifest: { version: "0.1.1", minAppVersion: "1.5.0" },
    versionsJson: { "0.1.0": "1.5.0", "0.1.1": "1.5.0" },
  });

  it("finds no problem when the files agree, with or without a matching tag", () => {
    expect(checkVersions(files())).toEqual([]);
    expect(checkVersions({ ...files(), tag: "0.1.1" })).toEqual([]);
  });

  it("names the file that disagrees", () => {
    const input = files();
    input.manifest.version = "0.1.2";
    expect(checkVersions(input).join("\n")).toContain("manifest.json");

    const lockOff = files();
    lockOff.lock.packages[""].version = "0.0.9";
    expect(checkVersions(lockOff).join("\n")).toContain("package-lock.json");
  });

  it("refuses a stable tag that differs from the version", () => {
    expect(checkVersions({ ...files(), tag: "0.2.0" }).join("\n")).toContain("0.2.0");
  });

  it("accepts a beta tag whose base is higher than the version, and refuses one that is not", () => {
    expect(checkVersions({ ...files(), tag: "0.2.0-beta.1" })).toEqual([]);
    expect(checkVersions({ ...files(), tag: "0.1.1-beta.1" }).join("\n")).toContain("higher");
    expect(checkVersions({ ...files(), tag: "0.1.0-beta.1" }).join("\n")).toContain("higher");
  });

  it("refuses a tag that is not a version, such as one with a v prefix", () => {
    expect(checkVersions({ ...files(), tag: "v0.1.1" }).join("\n")).toContain("v0.1.1");
  });

  it("refuses a versions.json whose newest value is above minAppVersion", () => {
    const input = files();
    input.versionsJson["0.1.1"] = "1.9.0";
    expect(checkVersions(input).join("\n")).toContain("versions.json");
  });
});
