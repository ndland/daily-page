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
  checkVersions,
  compareVersions,
  lastStableTag,
  nextBeta,
  nextVersion,
  parseCommit,
  parseVersion,
  readVersionFiles,
  toJson,
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
    git: (...args) => {
      try {
        return execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();
      } catch (error) {
        // Show git's own message, which says why (for example, what a commit hook printed).
        throw new Error(`git ${args.join(" ")} failed:\n${error.stderr || error.stdout || error.message}`);
      }
    },
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

  // The cheap checks come first, so a wrong branch or a dirty tree fails before the slow gates run.
  if (!options.dryRun) {
    requireCleanMain(git);
    if (!options.beta && tags.includes(version)) throw new Error(`The tag ${version} already exists.`);
  }
  runGates(deps, files, last);

  if (options.beta) return prepareBeta(deps, { base: version, bump, tags, last, commits, dryRun: options.dryRun });

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

  applyStable(deps, files, version, changed);
  log(`Release ${version} is committed and tagged. Review it, then publish with: git push --follow-tags`);
  return result;
}

/** The checks that run before a release is made. The first one to fail stops everything. */
const GATES = [
  { name: "tests", command: "npm", args: ["test"] },
  { name: "type check", command: "npx", args: ["tsc", "--noEmit"] },
  { name: "dependency audit", command: "npm", args: ["audit", "--audit-level=high"] },
];

/** The last lines of a command's output, which is where a failure says why. */
function tail(output, lines = 40) {
  return output.trim().split(/\r?\n/).slice(-lines).join("\n");
}

/**
 * Runs every gate, in order, before anything is changed, and stops at the first that fails with its output.
 * The commit messages since the last release are checked with commitlint, which needs a release to start from.
 * The version files are checked here too, so a release is never prepared from files that already disagree.
 */
function runGates(deps, files, last) {
  const { run, log } = deps;
  const steps = [...GATES];
  if (last === null) log("No earlier release, so the commit message check was skipped.");
  else steps.push({ name: "commit messages", command: "npx", args: ["commitlint", "--from", last, "--to", "HEAD"] });

  for (const { name, command, args } of steps) {
    const result = run(command, args);
    if (!result.ok) throw new Error(`Gate failed: ${name}\n${tail(result.output)}`);
    log(`Gate passed: ${name}`);
  }

  const problems = checkVersions(files);
  if (problems.length > 0) throw new Error(`Gate failed: version files\n${problems.join("\n")}`);
  log("Gate passed: version files");
}

/** Stops unless the repository is on main with nothing uncommitted, so a release is made from known work. */
function requireCleanMain(git) {
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  if (branch !== "main") throw new Error(`Releases are made from main, and you are on ${branch}.`);
  if (git("status", "--porcelain") !== "") {
    throw new Error("The working tree has uncommitted changes. Commit or stash them before releasing.");
  }
}

/**
 * A beta is a tag and nothing else: no commit and no file change. BRAT's developer guide says not to commit a
 * beta's version to the default branch, and the release workflow writes the beta version into the packaged
 * manifest only. A beta adds no commit, so only the tag is pushed.
 */
function prepareBeta(deps, { base, bump, tags, last, commits, dryRun }) {
  const { git, log } = deps;
  const tag = nextBeta(base, tags);
  const since = last === null ? "the first commit" : last;
  log(`Next beta: ${tag}${bump ? ` (${describeCommits(commits)}, since ${since})` : " (given)"}`);
  log("A beta makes a tag only: no commit and no file change.");

  const result = { version: tag, bump, files: [], last };
  if (dryRun) {
    log("Dry run: nothing was changed.");
    return result;
  }
  git("tag", "-a", tag, "-m", tag);
  log(`Beta ${tag} is tagged on the current commit. Publish it with: git push origin ${tag}`);
  return result;
}

/**
 * Writes the new version into the files, regenerates the changelog, then commits and tags. It starts from a
 * clean working tree, so if any step fails the release is undone: the commit (if one was made) is dropped, and
 * every file goes back to exactly the text it had, or is removed if it did not exist. Nothing is left behind.
 * The files are restored from a copy rather than with `git reset --hard`, which would rewrite their line endings.
 */
function applyStable(deps, files, version, changed) {
  const { git, readText, writeText, removeFile, run } = deps;
  const start = git("rev-parse", "HEAD");
  const snapshot = new Map(
    changed.map((name) => {
      try {
        return [name, readText(name)];
      } catch {
        return [name, null];
      }
    }),
  );

  const { packageJson, lock, manifest, versionsJson } = files;
  const updates = {
    "package.json": { ...packageJson, version },
    "package-lock.json": { ...lock, version, packages: { ...lock.packages, "": { ...lock.packages[""], version } } },
    "manifest.json": { ...manifest, version },
    "versions.json": { ...versionsJson, [version]: manifest.minAppVersion },
  };

  try {
    for (const name of changed.filter((file) => file !== "CHANGELOG.md")) {
      writeText(name, toJson(readText(name), updates[name]));
    }
    const generated = run("npm", ["run", "changelog"]);
    if (!generated.ok) throw new Error(`npm run changelog failed:\n${generated.output}`);

    const problems = checkVersions({ ...readVersionFiles(readText), tag: version });
    if (problems.length > 0) throw new Error(`The version files are wrong after the bump:\n${problems.join("\n")}`);

    git("add", ...changed);
    git("commit", "-m", `chore(release): ${version}`);
    git("tag", "-a", version, "-m", version);
  } catch (error) {
    // Drop our commit if it was made, and unstage, keeping the working files; then put each file back.
    if (git("rev-parse", "HEAD") !== start) git("reset", "-q", "--mixed", start);
    git("reset", "-q");
    for (const [name, text] of snapshot) {
      if (text === null) removeFile(name);
      else writeText(name, text);
    }
    throw error;
  }
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
