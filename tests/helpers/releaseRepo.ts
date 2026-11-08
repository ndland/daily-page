import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDeps } from "../../scripts/release-prepare.mjs";

const folders: string[] = [];

/** Removes every repository made since the last call. Call it from afterEach. */
export function cleanupRepos(): void {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
}

export interface Repo {
  dir: string;
  git: (...args: string[]) => string;
  commit: (subject: string, body?: string) => void;
  tag: (name: string) => void;
  messages: string[];
  deps: ReturnType<typeof createDeps>;
}

/** A real git repository on `main` at version 0.1.1, tagged 0.1.1, with the four version files committed. */
export function repo(options: { minAppVersion?: string; tagged?: boolean } = {}): Repo {
  const dir = mkdtempSync(join(tmpdir(), "daily-page-prepare-"));
  folders.push(dir);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.com");
  git("config", "commit.gpgsign", "false");
  git("config", "tag.gpgsign", "false");

  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(join(dir, "package.json"), json({ name: "x", version: "0.1.1" }));
  writeFileSync(join(dir, "package-lock.json"), json({ name: "x", version: "0.1.1", packages: { "": { version: "0.1.1" } } }));
  writeFileSync(join(dir, "manifest.json"), json({ id: "x", version: "0.1.1", minAppVersion: options.minAppVersion ?? "1.5.0" }));
  writeFileSync(join(dir, "versions.json"), json({ "0.1.1": "1.5.0" }));
  git("add", ".");
  git("commit", "-q", "-m", "chore(release): 0.1.1");
  if (options.tagged !== false) git("tag", "-a", "0.1.1", "-m", "0.1.1");

  const messages: string[] = [];
  const deps = createDeps(dir);
  deps.log = (message: string) => messages.push(message);
  return {
    dir,
    git,
    messages,
    deps,
    commit: (subject, body) => git("commit", "-q", "--allow-empty", "-m", subject, ...(body ? ["-m", body] : [])),
    tag: (name) => git("tag", "-a", name, "-m", name),
  };
}

/**
 * Makes `npm run changelog` succeed without npm: it writes a changelog section for the version in package.json,
 * as the real generator does. Any other command succeeds and does nothing.
 */
export function withFakeChangelog(r: Repo): void {
  r.deps.run = (_command: string, args: string[]) => {
    if (args.includes("changelog")) {
      const version = JSON.parse(r.deps.readText("package.json")).version;
      r.deps.writeText("CHANGELOG.md", `## ${version} (2026-01-01)\n\n### Features\n\n* a thing\n`);
    }
    return { ok: true, output: "" };
  };
}
