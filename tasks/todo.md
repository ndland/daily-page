# Task list: Release pipeline

Spec: `SPEC-release.md`. Plan: `tasks/plan.md`. Each task ends with the verification listed. Commit messages follow the rules in `commitlint.config.mjs` (scopes `release`, `tooling`, `tests`, `docs` types as fitting), and carry no trailers.

Every task also meets the standing bar: `npm test` and `npx tsc --noEmit` pass, and the diff is limited to the files listed.

## Phase 0: Setup

- [x] **T1: Create the branch and commit the spec and plan** (XS)
  - Acceptance: branch `chore/release-pipeline` exists, created from `chore/commit-tooling`; `SPEC-release.md`, `tasks/plan.md` and `tasks/todo.md` are committed in one commit.
  - Verify: `git branch --show-current` shows the new branch; the commit passes the commit hook; `git status` is clean.
  - Files: `SPEC-release.md`, `tasks/plan.md`, `tasks/todo.md`.
  - Depends on: plan approved.

## Phase 1: Pure logic (no GitHub, no git)

- [x] **T2: Version library** (S)
  - Acceptance:
    - Parses `X.Y.Z` and `X.Y.Z-beta.N`, and compares them (a beta is lower than its stable version).
    - Chooses the next version from a list of commit types: breaking or `feat` gives minor, `fix` gives patch (below 1.0); other types alone give "nothing to release".
    - Chooses the next beta number from the existing tags of the same base version.
    - Decides whether `versions.json` needs a new entry (only when `minAppVersion` differs from the newest entry's value).
    - Checks that version files agree and that a tag matches, with a clear message for each failure.
  - Verify: `npx vitest run tests/releaseLib.test.ts`. Mutation check: flip the beta comparison and the `feat`/`fix` rule once each, and confirm a test fails.
  - Files: `scripts/lib/release.mjs`, `scripts/lib/release.d.mts`, `tests/releaseLib.test.ts`.
  - Depends on: T1.

- [x] **T3: `check-versions` command** (S)
  - Acceptance: `node scripts/check-versions.mjs [tag]` reads `package.json`, `package-lock.json`, `manifest.json` and `versions.json`, exits 0 when they agree (and match the tag), and exits 1 with the library's message otherwise. A beta tag passes when its base is higher than the manifest version. `npm run release:check` runs it.
  - Verify: `npx vitest run tests/checkVersions.test.ts` (temporary project folders: agreeing, one file off, tag mismatch, beta tag, missing file); then run it in this repo with no tag and expect exit 0.
  - Files: `scripts/check-versions.mjs`, `tests/checkVersions.test.ts`, `package.json`.
  - Depends on: T2.

- [x] **T4: `release-notes` command** (S)
  - Acceptance:
    - `node scripts/release-notes.mjs 0.2.0` prints that version's `CHANGELOG.md` section, for both heading styles the generator writes (`## 0.2.0 (date)` and `## [0.2.0](link) (date)`), and stops at the next version heading.
    - A version with no section exits 1 and says so.
    - `-- --beta-from <last stable tag>` style input is covered by a pure function that formats beta notes from commit subjects (the `feat` and `fix` lines since the last stable tag), with a "Pre-release of X" heading.
  - Verify: `npx vitest run tests/releaseNotes.test.ts` (first, middle and last section, missing version, both heading styles, beta formatting, empty beta).
  - Files: `scripts/release-notes.mjs`, `scripts/lib/release.mjs`, `scripts/lib/release.d.mts`, `tests/releaseNotes.test.ts`.
  - Depends on: T2.

### Checkpoint A: after T2 to T4
- [ ] All tests pass, `tsc` is clean, the new tests were mutation-checked.
- [ ] `node scripts/check-versions.mjs` passes in this repo.
- [ ] Review with the maintainer before Phase 2.

## Phase 2: `release:prepare`

- [x] **T5: Choose the version, and dry run** (M)
  - Acceptance: `npm run release:prepare -- --dry-run` reads the commit subjects since the last stable tag (`git log <tag>..HEAD`), prints the next version, why (counts of `feat`, `fix`, breaking), and the files it would change; an explicit version argument overrides; with nothing releasable it exits 1 and says why; it changes nothing.
  - Verify: `npx vitest run tests/releasePrepare.test.ts` using a temporary git repository with scripted commits and tags (feat gives minor, fix gives patch, breaking gives minor, docs-only refuses, override wins, no tags yet).
  - Files: `scripts/release-prepare.mjs`, `scripts/lib/release.mjs`, `scripts/lib/release.d.mts`, `tests/releasePrepare.test.ts`, `package.json`.
  - Depends on: T2.

- [ ] **T6: Apply a stable release** (M)
  - Acceptance: without `--dry-run`, on a clean `main`, it updates `package.json`, `package-lock.json` and `manifest.json` to the new version, adds a `versions.json` entry only when `minAppVersion` changed, regenerates `CHANGELOG.md`, commits `chore(release): X`, and tags `X`. It never pushes. It refuses on a dirty tree or off `main`.
  - Verify: temporary git repository tests: the commit holds exactly the expected files, the tag points at it, `versions.json` is untouched when `minAppVersion` is unchanged, a dirty tree and a wrong branch are refused.
  - Files: `scripts/release-prepare.mjs`, `scripts/lib/release.mjs`, `tests/releasePrepare.test.ts`.
  - Depends on: T5.

- [ ] **T7: Beta tag** (S)
  - Acceptance: `npm run release:prepare -- --beta` creates only the tag `X-beta.N` on the current commit, with `N` one more than the highest existing beta of that base version (or 1), makes no commit, and changes no file. The base `X` must be higher than the version in `manifest.json`, or it refuses.
  - Verify: temporary git repository tests: first beta, second beta, base not higher than manifest (refused), working tree unchanged and no new commit.
  - Files: `scripts/release-prepare.mjs`, `scripts/lib/release.mjs`, `tests/releasePrepare.test.ts`.
  - Depends on: T6.

- [ ] **T8: Gates before any change** (M)
  - Acceptance: before touching a file, it runs the gates through the injected runner, in order: `npm test`, `npx tsc --noEmit`, `npm audit --audit-level=high`, commitlint on the commit range since the last tag, and `check-versions`. The first failure stops it with that gate's output and leaves no commit, no tag and no changed file. If a step after the first write fails, the files are restored.
  - Verify: tests with a fake runner that fails each gate in turn, and one that fails after the first write; the real gates run once in this repo with `--dry-run`.
  - Files: `scripts/release-prepare.mjs`, `scripts/lib/release.mjs`, `tests/releasePrepare.test.ts`.
  - Depends on: T6.

### Checkpoint B: after T5 to T8
- [ ] All tests pass; the release logic was mutation-checked (drop a gate, skip the restore).
- [ ] `npm run release:prepare -- --dry-run` in this repo prints a sensible version and file list.
- [ ] Review with the maintainer before Phase 3.

## Phase 3: Workflows

- [ ] **T9: Release workflow, `.nvmrc` and the beta stamp** (M)
  - Acceptance:
    - `.nvmrc` holds `26`.
    - `release.yml` triggers on `'[0-9]+.[0-9]+.[0-9]+'` and `'[0-9]+.[0-9]+.[0-9]+-beta.[0-9]+'` only; has `permissions: contents: read` at workflow level and `contents: write` only on the publish job.
    - Every action is pinned to a full commit SHA that was looked up and checked against the action's own repository.
    - The tag name reaches the shell through an environment variable, quoted.
    - Steps: checkout with `fetch-depth: 0`, setup-node from `.nvmrc`, `npm ci` with `HUSKY=0`, `check-versions <tag>`, `npm audit`, commitlint from the previous tag, `npm run release`, stamp the beta version into the packaged `manifest.json` (beta tags only), then `gh release create` with `--verify-tag`, `--notes-file`, the three files, and `--draft` for stable or `--prerelease` for beta.
    - `scripts/stamp-manifest.mjs <dir> <version>` sets the version in a packaged manifest and changes nothing else.
  - Verify: `npx vitest run tests/workflows.test.ts` (parses the YAML; checks triggers, permissions, SHA pins, no `${{ github.ref_name }}` inside a `run:` script, the `--verify-tag` flag, and the stamp script on a temporary folder). The SHAs are listed in the commit body with the lookup command used.
  - Files: `.nvmrc`, `.github/workflows/release.yml`, `scripts/stamp-manifest.mjs`, `tests/workflows.test.ts`, `package.json` (a YAML parser as a dev dependency only if none is already installed; ask first).
  - Depends on: T3, T4, T7.

- [ ] **T10: CI workflow** (S)
  - Acceptance: `ci.yml` runs on pull requests and on pushes to `main`: checkout with `fetch-depth: 0`, setup-node from `.nvmrc`, `npm ci` with `HUSKY=0`, `npm run release`, `npm audit`, `check-versions` with no tag, and commitlint on the pull request's commit range (`--from` base SHA `--to` head SHA) or `--last` on a push. `permissions: contents: read`; actions pinned.
  - Verify: the workflow test from T9 extended to `ci.yml`; then, after the branch is pushed (ask first), the run on the pull request is green on Node 26.
  - Files: `.github/workflows/ci.yml`, `tests/workflows.test.ts`.
  - Depends on: T3, T9 (shares the test and the pinned SHAs).

### Checkpoint C: after T9 and T10
- [ ] All tests pass; the workflow test was mutation-checked (unpin one action, widen one permission).
- [ ] The CI run on a pull request is green on Node 26, or the Node 24 fallback is decided and recorded.
- [ ] Review with the maintainer before Phase 4.

## Phase 4: Docs and go-live (each step asks first)

- [ ] **T11: Docs** (S)
  - Acceptance: the README has a "Releasing" section (prepare, push, publish the draft, the beta flow, BRAT update, what to do when a gate fails); `SPEC-release.md` status is updated; the Development section lists the new commands.
  - Verify: every command in the README runs as written in this repo (`--dry-run` for the release ones).
  - Files: `README.md`, `SPEC-release.md`.
  - Depends on: T10.

- [ ] **T12: Merge, force-push and repair the tags** (M, ask first at every step)
  - Acceptance, in order, each only on the maintainer's OK: merge `chore/commit-tooling` and `chore/release-pipeline` into `main`; force-push `main` with `--force-with-lease`; recreate tags `0.1.0` and `0.1.1` on the rewritten equivalents of their commits and push them; confirm both GitHub releases still show their three assets; delete the `backup/before-trailer-strip` branch.
  - Verify: `git log origin/main` matches local `main`; `git tag --merged main` lists both tags; `npm run changelog` now splits into two releases.
  - Files: none (git operations).
  - Depends on: T11.

- [ ] **T13: Beta dry run** (S, ask first)
  - Acceptance: `npm run release:prepare -- --beta` then pushing the tag publishes a prerelease with the three assets and a beta version in its `manifest.json`; BRAT installs it on desktop and shows the beta version; the prerelease and its tag are then deleted. If the job-level `contents: write` is not enough, the repository's workflow-permission setting is changed (ask first).
  - Verify: the Actions run is green; the release page shows the assets; BRAT shows the beta version; afterwards `gh release list` and `git ls-remote --tags origin` show no beta.
  - Files: none.
  - Depends on: T12.

- [ ] **T14: First stable release through the pipeline** (S, ask first)
  - Acceptance: `npm run release:prepare` on a clean `main`, `git push --follow-tags`, CI creates a draft release with the changelog section as notes and the three assets; the draft is published by hand; BRAT updates on desktop and on the phone.
  - Verify: the release is visible, the tag equals the manifest version, BRAT shows the new version on both devices.
  - Files: none.
  - Depends on: T13.

### Final checkpoint
- [ ] Every success criterion in `SPEC-release.md` section 8 is met and checked off against the first stable release.
- [ ] `tasks/` files are updated to match what shipped.
