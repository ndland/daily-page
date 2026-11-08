// The rules of the release pipeline, as plain functions with no file, git or network access, so each
// one can be tested on its own. The commands in scripts/ read the files and call these.
//
// A version is "X.Y.Z", or "X.Y.Z-beta.N" for a beta. Tags have no "v" prefix, because BRAT and
// Obsidian expect the tag to equal the version in manifest.json.

const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/;

/** The parts of a version, or null when the text is not a stable or beta version. */
export function parseVersion(text) {
  const match = VERSION.exec(text);
  if (!match) return null;
  const [, major, minor, patch, beta] = match;
  return { major: Number(major), minor: Number(minor), patch: Number(patch), beta: beta === undefined ? null : Number(beta) };
}

/** Negative, zero or positive, like a sort comparator. A beta sorts before the stable version it leads up to. */
export function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) throw new Error(`Cannot compare "${a}" with "${b}": not versions.`);
  for (const part of ["major", "minor", "patch"]) {
    if (left[part] !== right[part]) return left[part] - right[part];
  }
  // Same X.Y.Z: a stable version (no beta number) is after every beta of it.
  if (left.beta === right.beta) return 0;
  if (left.beta === null) return 1;
  if (right.beta === null) return -1;
  return left.beta - right.beta;
}

/** Compares dotted numbers such as an Obsidian minAppVersion ("1.5.0"). */
function compareDotted(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * The type of a commit and whether it is breaking, from its subject and body. A message that is not
 * "type(scope): subject" has no type.
 */
export function parseCommit(subject, body = "") {
  const match = /^([a-z]+)(?:\([^)]*\))?(!)?:/.exec(subject);
  const breaking = match?.[2] === "!" || /^BREAKING[ -]CHANGE:/m.test(body);
  return { type: match ? match[1] : null, breaking };
}

/**
 * The next version, from the commits since the last release, or null when none of them is a feat, a fix
 * or breaking. Below 1.0 a breaking change or a feat bumps the minor number; from 1.0 a breaking change
 * bumps the major number and a feat the minor. A fix bumps the patch.
 */
export function nextVersion(current, commits) {
  const version = parseVersion(current);
  if (!version) throw new Error(`"${current}" is not a version.`);

  const breaking = commits.some((commit) => commit.breaking);
  const feature = commits.some((commit) => commit.type === "feat");
  const fix = commits.some((commit) => commit.type === "fix");
  const { major, minor, patch } = version;

  if (breaking) return major === 0 ? { version: `0.${minor + 1}.0`, bump: "minor" } : { version: `${major + 1}.0.0`, bump: "major" };
  if (feature) return { version: `${major}.${minor + 1}.0`, bump: "minor" };
  if (fix) return { version: `${major}.${minor}.${patch + 1}`, bump: "patch" };
  return null;
}

/** The next beta tag of `base`: one more than the highest existing beta of that base, or beta.1. */
export function nextBeta(base, tags) {
  let highest = 0;
  for (const tag of tags) {
    const parsed = parseVersion(tag);
    if (parsed && parsed.beta !== null && `${parsed.major}.${parsed.minor}.${parsed.patch}` === base) {
      highest = Math.max(highest, parsed.beta);
    }
  }
  return `${base}-beta.${highest + 1}`;
}

/** The highest stable version among the tags, or null. Betas and tags that are not versions are ignored. */
export function lastStableTag(tags) {
  const stable = tags.filter((tag) => parseVersion(tag)?.beta === null);
  return stable.length === 0 ? null : stable.reduce((best, tag) => (compareVersions(tag, best) > 0 ? tag : best));
}

/**
 * Whether versions.json needs a new entry for a release. Obsidian reads it only to find a fallback for an
 * app older than minAppVersion, so an entry is needed only when minAppVersion differs from the newest entry's.
 */
export function versionsJsonNeedsEntry(versions, minAppVersion) {
  const keys = Object.keys(versions);
  if (keys.length === 0) return true;
  const newest = keys.reduce((best, key) => (compareVersions(key, best) > 0 ? key : best));
  return versions[newest] !== minAppVersion;
}

/**
 * Problems that would make a release wrong, as a list of messages (empty when there are none). BRAT reads the
 * manifest in the release and trusts the tag over it, so any disagreement installs the wrong version.
 * `tag` is optional: without it only the files are compared.
 */
export function checkVersions({ packageJson, lock, manifest, versionsJson, tag }) {
  const problems = [];
  const version = manifest.version;

  const versions = {
    "package.json": packageJson.version,
    "package-lock.json": lock.version,
    "package-lock.json (packages[\"\"])": lock.packages?.[""]?.version,
  };
  for (const [file, found] of Object.entries(versions)) {
    if (found !== version) problems.push(`${file} says ${found}, but manifest.json says ${version}.`);
  }

  const entries = Object.keys(versionsJson);
  if (entries.length > 0) {
    const newest = entries.reduce((best, key) => (compareVersions(key, best) > 0 ? key : best));
    if (compareDotted(versionsJson[newest], manifest.minAppVersion) > 0) {
      problems.push(`versions.json maps ${newest} to ${versionsJson[newest]}, which is above the minAppVersion ${manifest.minAppVersion}.`);
    }
  }

  if (tag !== undefined) {
    const parsed = parseVersion(tag);
    if (!parsed) {
      problems.push(`The tag "${tag}" is not a version. Tags are X.Y.Z or X.Y.Z-beta.N, with no v prefix.`);
    } else if (parsed.beta === null) {
      if (tag !== version) problems.push(`The tag ${tag} does not match the version ${version}.`);
    } else if (compareVersions(`${parsed.major}.${parsed.minor}.${parsed.patch}`, version) <= 0) {
      problems.push(`The beta tag ${tag} must be for a version higher than ${version}.`);
    }
  }
  return problems;
}

/**
 * Reads and parses the four version files through `readText`, which returns a file's text or throws. A file
 * that is missing or is not JSON stops the release with its name, rather than with a stack trace.
 */
export function readVersionFiles(readText) {
  const read = (name) => {
    try {
      return JSON.parse(readText(name));
    } catch (error) {
      throw new Error(`${name} could not be read: ${error instanceof Error ? error.message : error}`);
    }
  };
  return {
    packageJson: read("package.json"),
    lock: read("package-lock.json"),
    manifest: read("manifest.json"),
    versionsJson: read("versions.json"),
  };
}
