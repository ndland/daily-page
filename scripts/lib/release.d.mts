export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  /** The N of "-beta.N", or null for a stable version. */
  beta: number | null;
}

export interface ParsedCommit {
  type: string | null;
  breaking: boolean;
}

export type Bump = "major" | "minor" | "patch";

export interface JsonVersionFiles {
  packageJson: { version?: string };
  lock: { version?: string; packages?: Record<string, { version?: string }> };
  manifest: { version: string; minAppVersion: string };
  versionsJson: Record<string, string>;
  tag?: string;
}

/** The parts of a stable or beta version, or null when the text is neither. */
export function parseVersion(text: string): ParsedVersion | null;

/** Negative, zero or positive. A beta sorts before the stable version it leads up to. */
export function compareVersions(a: string, b: string): number;

/** The commit's type (null when not conventional) and whether it is breaking. */
export function parseCommit(subject: string, body?: string): ParsedCommit;

/** The next version from the commits since the last release, or null when none is a feat, a fix or breaking. */
export function nextVersion(current: string, commits: ParsedCommit[]): { version: string; bump: Bump } | null;

/** The next beta tag of `base`. */
export function nextBeta(base: string, tags: string[]): string;

/** The highest stable version among the tags, or null. */
export function lastStableTag(tags: string[]): string | null;

/** Whether versions.json needs a new entry for a release, which is only when minAppVersion changes. */
export function versionsJsonNeedsEntry(versions: Record<string, string>, minAppVersion: string): boolean;

/** Problems that would make a release wrong, as messages. Empty when there are none. */
export function checkVersions(input: JsonVersionFiles): string[];

/** Reads and parses package.json, package-lock.json, manifest.json and versions.json, or throws naming the file. */
export function readVersionFiles(readText: (name: string) => string): Omit<JsonVersionFiles, "tag">;
