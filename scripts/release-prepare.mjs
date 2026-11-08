// Prepares a release on your machine. It never pushes: you push the tag when you are ready, and CI publishes.
//
//   npm run release:prepare                   the next version, chosen from the commits since the last release
//   npm run release:prepare -- 0.3.0          an explicit version
//   npm run release:prepare -- --beta         a beta tag only, with no commit and no file change
//   npm run release:prepare -- --dry-run      show what would happen, and change nothing
//
// The rules live in scripts/lib/release.mjs. This file reads the repository and calls them. Everything it
// does to the outside world goes through `deps` (git, files, shell commands, output), so the tests can run it
// against a temporary repository.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  compareVersions,
  lastStableTag,
  nextVersion,
  parseCommit,
  parseVersion,
  readVersionFiles,
  versionsJsonNeedsEntry,
} from "./lib/release.mjs";

/** Reads the command line: --dry-run, --beta, and at most one explicit version. */
export function parseArgs(argv) {
  const options = { dryRun: false, beta: false, version: undefined };
  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--beta") options.beta = true;
    else if (arg.startsWith("--")) throw new Error(`Unknown option ${arg}. Use --dry-run, --beta, or a version.`);
    else if (options.version !== undefined) throw new Error("Give at most one version.");
    else options.version = arg;
  }
  return options;
}

/** The real git, files, shell and output, for a repository at `cwd`. */
export function createDeps(cwd = process.cwd()) {
  return {
    git: (...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim(),
    readText: (name) => readFileSync(join(cwd, name), "utf8"),
    writeText: (name, text) => writeFileSync(join(cwd, name), text),
    removeFile: (name) => rmSync(join(cwd, name), { force: true }),
    // npm and npx are .cmd files on Windows, which need a shell to start.
    run: (command, args) => {
      const run = spawnSync(command, args, { cwd, encoding: "utf8", shell: process.platform === "win32" });
      return { ok: run.status === 0, output: `${run.stdout ?? ""}${run.stderr ?? ""}` };
    },
    log: (message) => console.log(message),
  };
}

/** The commits after `tag` (all of them when there is no tag), with their types. */
function commitsSince(git, tag) {
  const range = tag === null ? [] : [`${tag}..HEAD`];
  const out = git("log", "--format=%s%x1f%b%x1e", ...range);
  return out
    .split("\x1e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [subject, body = ""] = record.split("\x1f");
      return { subject: subject.trim(), ...parseCommit(subject.trim(), body) };
    });
}

/** The version to release: the explicit one, or the one the commits call for. Throws when there is none. */
function chooseVersion(current, commits, explicit) {
  if (explicit !== undefined) {
    const parsed = parseVersion(explicit);
    if (!parsed || parsed.beta !== null) throw new Error(`"${explicit}" is not a version. Use X.Y.Z.`);
    if (compareVersions(explicit, current) <= 0) {
      throw new Error(`"${explicit}" is not higher than the current version ${current}.`);
    }
    return { version: explicit, bump: null };
  }
  const next = nextVersion(current, commits);
  if (next === null) {
    throw new Error(
      "Nothing to release: no commit since the last release is a feat, a fix or a breaking change. " +
        "Pass a version to release anyway.",
    );
  }
  return next;
}

/** One line saying what the commits contain. */
function describeCommits(commits) {
  const count = (test) => commits.filter(test).length;
  return `${count((c) => c.type === "feat")} feat, ${count((c) => c.type === "fix")} fix, ${count((c) => c.breaking)} breaking`;
}

/**
 * Prepares a release. With `dryRun` it reports the version and the files it would change and touches nothing.
 * Returns what it decided.
 */
export function prepareRelease(deps, options = {}) {
  const { git, readText, log } = deps;
  const files = readVersionFiles(readText);
  const current = files.manifest.version;
  const tags = git("tag", "--list").split(/\r?\n/).filter(Boolean);
  const last = lastStableTag(tags);
  const commits = commitsSince(git, last);
  const { version, bump } = chooseVersion(current, commits, options.version);

  const changed = ["package.json", "package-lock.json", "manifest.json"];
  if (versionsJsonNeedsEntry(files.versionsJson, files.manifest.minAppVersion)) changed.push("versions.json");
  changed.push("CHANGELOG.md");

  const since = last === null ? "the first commit" : last;
  log(`Next version: ${version}${bump ? ` (${bump}: ${describeCommits(commits)}, since ${since})` : " (given)"}`);
  log(`Files: ${changed.join(", ")}`);

  const result = { version, bump, files: changed, last };
  if (options.dryRun) {
    log("Dry run: nothing was changed.");
    return result;
  }
  throw new Error("Applying a release is not built yet. Use --dry-run.");
}

// Runs only when started from the command line, not when the tests import this file.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    prepareRelease(createDeps(), parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
