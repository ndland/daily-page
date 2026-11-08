# Implementation Plan: Release pipeline

Spec: `SPEC-release.md` (approved 2026-11-08). Task list: `tasks/todo.md`. Tasks are tracked in that file, not in an external tracker.

## Overview

Build the pipeline in `SPEC-release.md`: a local `release:prepare` command that gates, picks the version, bumps the files, regenerates the changelog, commits and tags; and two GitHub Actions workflows (a release workflow on version tags, and a CI workflow on pull requests and `main`). Most of the logic is plain Node scripts that are unit-tested without GitHub. Only the last phase touches GitHub, and each step there needs the maintainer's OK.

## What I found in the code (read-only)

- `npm run release` already runs `npm run build` (tests, `tsc`, esbuild) and then `scripts/package-plugin.mjs`, which writes exactly `main.js`, `manifest.json` and `styles.css` to `release/daily-page/` and refuses a file that mentions the harness. The workflows can call it instead of repeating those gates.
- `esbuild.config.mjs` copies `manifest.json` into `dist/manifest.json` at build time. That packaged copy is the one a beta's version is stamped into, so the root `manifest.json` is never touched for a beta (spec section 3, S3).
- Existing script tests (`tests/packagePlugin.test.ts`) run the script in a temporary project folder through `execFileSync`. The harness uses a `.mjs` file with a `.d.mts` for types. New scripts follow both patterns.
- `npm test` is part of `npm run build`, and it now includes `tests/commitRules.test.ts`, so CI needs the dev dependencies and a full checkout.
- Branches: `chore/commit-tooling` is not merged, and the pipeline needs its `commitlint` and changelog tooling. `SPEC-release.md` is untracked.

## Architecture decisions

1. **One small library plus thin command-line scripts.** The spec lists three scripts. I add `scripts/lib/release.mjs` (with a `.d.mts`) holding the pure functions: parsing and comparing versions, choosing the next version, checking that version files agree, finding a changelog section, and deciding when `versions.json` needs an entry. The three scripts are thin wrappers that read files and call it. This keeps every rule unit-testable without touching git or the file system, and keeps each task within about 5 files.
2. **`release:prepare` takes its side effects as parameters.** The function that orchestrates a release is given `run` (shell commands), `read`, `write` and `git` helpers. Tests pass fakes or a temporary git repository, and the command-line wrapper passes the real ones. This avoids a "skip the gates" flag, which would contradict the spec's rule that gates are never skipped.
3. **No new runtime dependencies.** Commit types are read from `git log` subjects with a small parser (`type(scope)!: subject`, and a `BREAKING CHANGE:` line in a body). `conventional-changelog` and `commitlint` stay as they are.
4. **Version choice follows the spec:** below 1.0, a breaking change or `feat` bumps minor and `fix` bumps patch. Only those count, so a range with only `docs`, `chore` and so on gives "nothing to release" unless a version is given.
5. **All-or-nothing local release.** `release:prepare` runs every gate before it changes a file, writes the files, then commits and tags. If any step after the first write fails, it restores the files, so no commit and no tag are left behind. It never pushes.
6. **Beta notes come from commit subjects**, not from the changelog generator, because a beta has no changelog section. They list the `feat` and `fix` commits since the last stable tag. This avoids depending on `conventional-changelog`'s unreleased mode, which I have not verified.
7. **Stacked branches.** Work goes on `chore/release-pipeline`, created from `chore/commit-tooling`. Merge order later is tooling first, then pipeline.
8. **The release workflow calls `npm run release`** (build, tests, `tsc`, package) and adds only what that doesn't cover: the version check, `npm audit`, commitlint on the range since the last tag, the beta manifest stamp, and publishing.

## Dependency graph

```
T1 branch + docs
 └─ T2 lib: versions
     ├─ T3 check-versions ─────────────┐
     ├─ T4 release-notes ──────────────┤
     └─ T5 prepare: choose + dry run ──┤
         ├─ T6 prepare: apply stable   │
         │   └─ T7 prepare: beta       │
         └─ T8 prepare: gates ─────────┘
                                        ▼
                        T9 release.yml  (needs T3, T4, T7)
                        T10 ci.yml      (needs T3)
                                        ▼
                        T11 docs
                                        ▼
        T12 repair tags and merge → T13 beta dry run → T14 first stable release
```

T3, T4 and T5 can be built in parallel once T2 is done. T9 and T10 can be built in parallel. T12 to T14 are strictly sequential and need the maintainer.

## Task list

See `tasks/todo.md` for the checklist with acceptance criteria. Summary:

### Phase 0: Setup
- T1 Create the branch and commit the spec and plan.

### Phase 1: Pure logic (no GitHub, no git)
- T2 Version library. T3 `check-versions`. T4 `release-notes`.
- **Checkpoint A.**

### Phase 2: `release:prepare`
- T5 Choose the version and dry run. T6 Apply a stable release. T7 Beta tag. T8 Gates.
- **Checkpoint B.**

### Phase 3: Workflows
- T9 Release workflow, `.nvmrc` and the beta stamp. T10 CI workflow.
- **Checkpoint C.**

### Phase 4: Docs and go-live (each step asks first)
- T11 README and spec status. T12 Repair tags and merge. T13 Beta dry run. T14 First stable release.
- **Final checkpoint.**

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Tests and tooling have only run on Node 22; CI uses Node 26 | Medium | The first CI run is the check (T10 on a pull request). If it fails only on 26, fix it or pin CI to 24 and record why. |
| A failed `release:prepare` leaves a half-made release | High | Gates run before any write; on a later failure the files are restored; tested in a temporary git repository (T6, T8). |
| Action versions and commit SHAs are unverified | Medium | Look them up with `gh api` while writing T9 and T10, and check each SHA belongs to the action's own repository. |
| The job-level `contents: write` may not be enough with the repository default left read-only | Medium | Settled by the beta dry run (T13). If it fails, change the repository's workflow-permission setting (ask first). |
| The history rewrite left the `0.1.0` and `0.1.1` tags on commits that are no longer on `main` | High | T12 repairs them before any live run. Until then, "commits since the last tag" is unusable, so T5 and T8 are only tested on temporary repositories. |
| Windows line endings and `git`/shell differences in tests | Low | Tests build their own repositories with explicit settings and use `execFileSync`, as the existing script tests do. |
| BRAT "latest" picks up a beta on devices following "latest" | Low | Accepted in the spec. Use BRAT's frozen version for a device that must stay on stable. |
| Force-pushing and moving published tags are hard to undo | High | T12 is ask-first at every step, with a backup branch kept until the maintainer confirms. |

## Open questions

None blocking. Two choices to confirm while reviewing the plan:
1. The library file (`scripts/lib/release.mjs`) is an addition to the spec's project structure.
2. T12 to T14 touch the public repository, so I will stop and ask before each one, as the spec's boundaries require.
