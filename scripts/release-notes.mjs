// Prints the release notes for a tag, for the body of a GitHub release.
//
//   node scripts/release-notes.mjs 0.2.0           a stable version: its section of CHANGELOG.md
//   node scripts/release-notes.mjs 0.2.0-beta.1    a beta: the feat and fix commits since the last stable tag
//
// A beta has no changelog section, because the changelog is generated only when a stable release is
// prepared. Exit code 1 means there are no notes to print.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extractNotes, formatBetaNotes, lastStableTag, parseVersion } from "./lib/release.mjs";

const tag = process.argv[2];
const parsed = tag === undefined ? null : parseVersion(tag);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!parsed) fail(`"${tag ?? ""}" is not a version. Usage: node scripts/release-notes.mjs X.Y.Z[-beta.N]`);

if (parsed.beta === null) {
  let changelog;
  try {
    changelog = readFileSync("CHANGELOG.md", "utf8");
  } catch {
    fail("CHANGELOG.md could not be read. Run npm run changelog first.");
  }
  const notes = extractNotes(changelog, tag);
  if (notes === null) fail(`CHANGELOG.md has no section for ${tag}. Run npm run changelog first.`);
  console.log(notes);
} else {
  const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
  const stable = lastStableTag(git("tag", "--list").split(/\r?\n/).filter(Boolean));
  const range = stable === null ? [] : [`${stable}..HEAD`];
  const subjects = git("log", "--format=%s", ...range).split(/\r?\n/).filter(Boolean);
  console.log(formatBetaNotes(`${parsed.major}.${parsed.minor}.${parsed.patch}`, subjects));
}
