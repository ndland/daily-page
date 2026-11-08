export interface PrepareOptions {
  dryRun: boolean;
  beta: boolean;
  /** An explicit stable version, which overrides the one the commits call for. */
  version: string | undefined;
}

export interface RunResult {
  ok: boolean;
  output: string;
}

/** Everything release:prepare does to the outside world, so tests can use a temporary repository. */
export interface Deps {
  git: (...args: string[]) => string;
  readText: (name: string) => string;
  writeText: (name: string, text: string) => void;
  removeFile: (name: string) => void;
  run: (command: string, args: string[]) => RunResult;
  log: (message: string) => void;
}

export interface PrepareResult {
  version: string;
  bump: "major" | "minor" | "patch" | null;
  files: string[];
  last: string | null;
}

/** Reads the command line: --dry-run, --beta, and at most one explicit version. */
export function parseArgs(argv: string[]): PrepareOptions;

/** The real git, files, shell and output, for a repository at `cwd`. */
export function createDeps(cwd?: string): Deps;

/** Prepares a release. With dryRun it reports and changes nothing. */
export function prepareRelease(deps: Deps, options?: Partial<PrepareOptions>): PrepareResult;
