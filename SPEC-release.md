# SPEC: Release pipeline

Status: **decisions confirmed, awaiting approval of the whole spec.** No pipeline code has been written. Framework claims were checked against official sources on 2026-11-08 (section 12).
Scope: how Daily Page is versioned, gated, built and published so BRAT (and later the Obsidian community directory) can install it. The plugin's own spec is `SPEC.md`; this file does not change it.
Builds on: the conventional-commit rules and changelog generator on branch `chore/commit-tooling` (`commitlint.config.mjs`, `npm run changelog`).

## 1. Objective

One reliable, repeatable path from "commits on `main`" to "a GitHub release BRAT can install", with the checks that today live in a person's head enforced by code.

- **User:** the maintainer (one person), and BRAT on desktop and iPhone.
- **Why:** releasing is manual today. The version is hand-edited in three files, the release is built and attached by hand, and nothing stops a tag that disagrees with `manifest.json`. A mismatch breaks BRAT silently.
- **Channels:** stable (`0.2.0`) and beta (`0.2.0-beta.1`, published as a GitHub prerelease for testing through BRAT before stable).
- **Success:** the criteria in section 8.

### Assumptions (confirm or correct)

1. BRAT installs from a GitHub release whose tag equals the `manifest.json` version, with `main.js`, `manifest.json` and `styles.css` attached as release assets.
2. Tags have no `v` prefix (`0.1.1`, not `v0.1.1`), matching the existing releases.
3. Versions stay below 1.0 for now: a `feat` bumps the minor number, a `fix` bumps the patch, and a breaking change also bumps the minor number.
4. Release notes come from the generated `CHANGELOG.md`.
5. One maintainer; `main` is the release branch; the repo is public.
6. No secrets are needed. Publishing uses the workflow's built-in `GITHUB_TOKEN`.

## 2. Decision: how a release is started

You asked for best practice for this stack. The Obsidian plugin ecosystem (the official sample plugin and most community plugins) uses **a tag push that triggers a GitHub Actions workflow**. Options:

| | A. Local prepare, tag push publishes | B. Release pull request (release-please) | C. Manual workflow run |
| --- | --- | --- | --- |
| How | One local command bumps, regenerates the changelog, commits and tags. Pushing the tag publishes. | A bot keeps a release PR open from your commits. Merging it tags and publishes. | You press a button in the Actions tab and type the version. |
| Fit for Obsidian | Closest to the ecosystem norm and to the BRAT convention that the tag equals the manifest version. | Works, but it owns your changelog and version files, which conflicts with the generator already added, and it is built for packages, not for a `manifest.json` plus `versions.json` pair. | Simple, but the version and changelog still have to be committed first. |
| Control | Full. You review the release commit before pushing. | Medium. | Medium. |
| Moving parts | Two small scripts and one workflow. | A bot, a config and a manifest file. | One workflow plus the same scripts. |

**Proposed: A.** It adds the fewest tools and keeps the changelog generator you already have. B and C stay available later because the gate and publish steps are the same.

## 3. How it works

```
commits on main
   │  npm run release:prepare            (local, no push)
   ▼
gates → next version → bump 3 files → changelog → commit "chore(release): X" → tag X
   │  git push --follow-tags             (you decide when)
   ▼
CI on the tag:  verify versions → gates → build → check the 3 files → publish release
   │
   ▼
GitHub release X (prerelease if X has a -beta suffix), notes from CHANGELOG.md, 3 assets
   │  BRAT: "Check for updates"
   ▼
desktop and phone
```

### Components

| Id | What | Where |
| --- | --- | --- |
| P1 `check-versions` | Fails unless `package.json`, `package-lock.json`, `manifest.json` and `versions.json` agree, and (when given) equal a tag. | `scripts/check-versions.mjs` |
| P2 `release-prepare` | Runs the gates, picks the version, updates the files, regenerates the changelog, commits and tags. | `scripts/release-prepare.mjs`, `npm run release:prepare` |
| P3 `release-notes` | Prints one version's section of `CHANGELOG.md`, for the release body. | `scripts/release-notes.mjs` |
| P4 `release-workflow` | On a version tag: verify, gate, build, publish. | `.github/workflows/release.yml` |
| P5 `ci-workflow` | The same gates on every pull request and push to `main`. | `.github/workflows/ci.yml` |

P1 and P3 have no dependencies. P2 uses P1 and P3. P4 uses P1 and P3. P5 uses P1. Build order: P1, P3, P2, P4, P5.

### Version rules

- Next version from the commits since the last stable tag: breaking change or `feat` gives a minor bump, `fix` gives a patch bump, below 1.0. Only `feat`, `fix` and breaking commits count. Other types alone give no release (it refuses and says why), unless a version is passed explicitly.
- `npm run release:prepare -- 0.3.0` overrides.
- **Beta (`-- --beta`) makes a tag only.** It creates the tag `X-beta.N` on the current `main` commit and changes no file and makes no commit. `N` counts up from the last beta of the same base version `X`, and `X` must be higher than the version in `manifest.json`. CI writes the beta version into the *packaged* `manifest.json` only. BRAT's developer guide says not to commit a beta's bumped version to the default branch, because Obsidian reads the root `manifest.json` there for updates (see section 12, S3).
- **`versions.json` is updated only when `minAppVersion` changes.** Obsidian reads it only to find a fallback version for an app older than the current `minAppVersion`, and "you don't need to list every release" (S2). The existing entries for `0.1.0` and `0.1.1` are harmless and stay.
- `minAppVersion` is not bumped automatically. Raising it is a deliberate edit, and the next `release:prepare` then adds the `versions.json` entry.
- **BRAT side effect to accept:** BRAT's "latest" option takes the highest semantic version *including prereleases* (S3). Once a beta is published, a BRAT install following "latest" will pick it up. That is fine for a one-person project, and BRAT's "frozen version" option pins a device.

### Gates (all must pass, locally and in CI)

1. `npm test` and `npx tsc --noEmit`.
2. Version files agree, and the tag equals the version (P1): `package.json`, `package-lock.json` and `manifest.json` carry one version, which equals the tag for a stable release (a beta tag's base must be higher). `versions.json` needs an entry only for a version that changed `minAppVersion`, and its newest value never exceeds `manifest.json`'s `minAppVersion`.
3. `npm audit --audit-level=high` finds nothing.
4. `commitlint` passes on every commit since the last release tag, including the no-trailers rule.
5. The built package holds exactly `main.js`, `manifest.json` and `styles.css`, none mentioning the harness (already enforced by `scripts/package-plugin.mjs`).

## 4. Commands

```bash
npm run release:prepare                 # next version from the commits; commits and tags; no push
npm run release:prepare -- 0.3.0        # explicit version
npm run release:prepare -- --beta       # next beta of the next version
npm run release:prepare -- --dry-run    # show the version, the changelog section and the files; change nothing
node scripts/check-versions.mjs [tag]   # P1 on its own
node scripts/release-notes.mjs 0.3.0    # P3 on its own
git push --follow-tags                  # publish: the tag triggers CI
npm run release                         # unchanged: build and package into release/daily-page/
npm run changelog                       # unchanged: regenerate CHANGELOG.md
```

## 5. Project structure

```
scripts/check-versions.mjs      P1
scripts/release-prepare.mjs     P2
scripts/release-notes.mjs       P3
scripts/package-plugin.mjs      existing: packages the three files
scripts/install-vault.mjs       existing: copies a build into a vault
.github/workflows/release.yml   P4
.github/workflows/ci.yml        P5
.nvmrc                          the Node major used by both workflows
tests/release*.test.ts          unit tests for P1 to P3
CHANGELOG.md                    generated by npm run changelog, committed with each release
```

## 6. Code style

Scripts match the existing ones: plain ESM `.mjs`, Node built-ins first, comments that say why, a refusal with a clear message rather than a silent fix.

```js
// Refuses a release whose files disagree, because BRAT reads the manifest in the release and a
// mismatch with the tag installs the wrong version without any error.
function checkVersions(versions, tag) {
  const distinct = new Set(Object.values(versions));
  if (distinct.size > 1) {
    throw new Error(`Version files disagree: ${JSON.stringify(versions)}`);
  }
  if (tag !== undefined && !distinct.has(tag)) {
    throw new Error(`Tag ${tag} does not match the version ${[...distinct][0]}`);
  }
}
```

Workflow rules (each traces to a source in section 12):
- Trigger only on version tags: `'[0-9]+.[0-9]+.[0-9]+'` for stable and `'[0-9]+.[0-9]+.[0-9]+-beta.[0-9]+'` for beta (S4). This is narrower than the Obsidian sample's `"*"` (S1), so an unrelated tag cannot start a release.
- Every third-party action pinned to a full commit SHA, from the action's own repository, with the SHAs looked up when the workflow is written (S5).
- Workflow-level `permissions: contents: read`, raised to `contents: write` only in the publish job (S5).
- The tag name reaches shell steps through an environment variable and is quoted, never written into the script text (S5).
- Stable releases are created as a **draft** that you promote by hand, as the Obsidian sample does (S1). Betas are published straight away as a **prerelease**, because BRAT can only install published releases. `gh release create` uses `--verify-tag`, `--notes-file`, `--draft` or `--prerelease`, and the three files (S6).
- `fetch-depth: 0` on checkout, so the commit range since the last tag can be linted (S7).
- `HUSKY=0` so `npm ci` does not install hooks. Node **26**, the newest LTS, pinned to its major version in one place (`.nvmrc`) and bumped on purpose, not by a floating alias (S8).

## 7. Testing strategy

- **Unit (vitest, `tests/`):** the logic in P1 to P3 is exported as pure functions and tested: next-version rules (feat, fix, breaking, nothing releasable, beta counting, 0.x), version-file agreement, tag mismatch, release-notes extraction (first, middle and missing version), and `versions.json` updates.
- **Mutation check:** break each rule once (drop a comparison, skip the beta branch) and confirm a test fails.
- **Workflows:** no mock runner. They are checked three ways: the YAML parses and every action is SHA-pinned (a small test), `ci.yml` runs on this branch's pull request, and one real **beta** tag run publishes a throwaway prerelease that is then deleted (see Ask first).
- **End to end:** install the beta through BRAT on desktop, confirm the version shows, then update to the stable release.

## 8. Success criteria

1. From a clean `main`, one `release:prepare` followed by `git push --follow-tags` produces a GitHub release with the right tag, the three assets and the changelog section as notes, with no other manual step.
2. A tag that disagrees with `manifest.json`, or with any version file, fails CI before anything is published.
3. A failing test, type error, high-severity audit finding or non-conforming commit blocks the release.
4. A `-beta.N` tag publishes a prerelease that BRAT can install, with the beta version in the packaged `manifest.json`, and leaves `main`'s files and `versions.json` untouched.
5. Re-running the dry run changes nothing, and a failed gate leaves no commit and no tag.
6. Every pull request runs the same gates.
7. The release workflow holds no personal token and every action is pinned.

## 9. Boundaries

- **Always:**
  - run the gates before tagging;
  - keep the tag equal to the version in every file;
  - build the release in CI from the tagged commit, never from a laptop;
  - leave the release commit and tag unpushed so you can review them.
- **Ask first:**
  - force-pushing, or moving or deleting a published tag or release;
  - turning on branch protection, or requiring status checks;
  - adding a third-party action or a new dependency;
  - the first real publish, including the beta test run;
  - raising `minAppVersion`;
  - submitting to the Obsidian community directory;
  - adding artifact attestations.
- **Never:**
  - publish from a dirty working tree or from a branch other than `main`;
  - edit assets on a published release;
  - put a token or secret in the repo or in a workflow file;
  - skip a gate to get a release out;
  - hand-edit `CHANGELOG.md` between releases (it is regenerated).

## 10. Prerequisite: repair the tags

The history was rewritten to drop commit trailers, so the local `0.1.0` tag and the published `0.1.0` and `0.1.1` releases point at commits that no longer exist on `main`. Until that is repaired the changelog cannot split by release, and "commits since the last release" has no valid start. Repair, in order (each step needs your OK): merge `chore/commit-tooling`; force-push `main`; recreate tags `0.1.0` and `0.1.1` on the rewritten equivalents of their commits; check that both GitHub releases still show their assets.

## 11. Decisions

Confirmed by the maintainer on 2026-11-08:

1. **Release path: option A.** Local `release:prepare`, tag push publishes (section 2).
2. **The pull-request workflow (P5) is in scope.**
3. **Attestations: later.** Add the signed build-provenance step, and its two extra token permissions, only when submitting to the community directory (S1).
4. **Stable releases are created as drafts** that you publish by hand, for now. Revisit once the pipeline has proved itself.
5. **Node: the latest LTS.** Today that is Node 26, in Active LTS since 2026-10-28 and supported until 2029-04-30 (S8).

Risk from decision 5: this machine runs Node 22, and the tests and tooling (TypeScript 7, Vitest 5, esbuild) have only been run here. The first CI run on Node 26 is itself a check. If something fails only on 26, the choice is to fix it or to pin CI to 24 (also supported, until 2028-04-30), and that is decided when it happens.

Resolved by the source check: BRAT beta mechanics (S3), whether to draft stable releases (S1), and how `versions.json` is maintained (S2).

## 12. Sources

Checked on 2026-11-08 against the pages below. Quotes are short.

| Id | Source | What it settles |
| --- | --- | --- |
| S1 | https://docs.obsidian.md/Plugins/Releasing/Release+your+plugin+with+GitHub+Actions | The official release workflow: runs on pushed tags, builds, and runs `gh release create "$tag" --title="$tag" --draft main.js manifest.json styles.css`. "Create a tag that matches the version in the `manifest.json` file." Attestation is "recommended when you submit a plugin to the community directory." The page's example uses bare versions (`1.0.1`) and does not mention prereleases or a `v` prefix. |
| S2 | https://docs.obsidian.md/Reference/Versions | `versions.json` maps a plugin version to the `minAppVersion` it supports, is read only when the user's app is older than the current `minAppVersion`, and needs updating only when `minAppVersion` changes. The page does not state a semver requirement for `manifest.json`. |
| S3 | https://github.com/TfTHacker/obsidian42-brat/blob/main/BRAT-DEVELOPER-GUIDE.md | "Since v1.1.0, BRAT primarily works with GitHub releases." It downloads `manifest.json`, `main.js` and `styles.css` from the release assets. "Latest" takes the highest semantic version, prereleases included. A frozen version installs that exact release. If the tag and the released manifest version differ, the tag wins and BRAT shows a notice. Betas are releases marked as prerelease, and the bumped version should not be committed to the default branch's `manifest.json` yet. `manifest-beta.json` is ignored since BRAT 1.1.0. |
| S4 | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax | Tag filters match the full ref name. In the filter cheat sheet, `*` does not match `/`, `+` means one or more of the preceding character, `[0-9]` ranges work, and `v[12].[0-9]+.[0-9]+` is the documented version pattern. Patterns starting with `*`, `[` or `!` must be quoted. Defining only `tags` stops branch pushes from triggering the workflow. |
| S5 | https://docs.github.com/en/actions/reference/security/secure-use | Pin third-party actions to a full-length commit SHA from the action's own repository. Set the default token permission to read-only and raise it per job. Pass expressions to scripts through an environment variable and quote it. |
| S6 | https://cli.github.com/manual/gh_release_create | `--draft`, `--prerelease`, `--notes-file`, `--title`, `--verify-tag` (abort if the tag is not on the remote), `--latest`. Asset files are positional arguments after the tag. With no matching tag the command creates one from the default branch, which is why `--verify-tag` is used. |
| S7 | https://commitlint.js.org/guides/ci-setup.html | The example uses `fetch-depth: 0`, lints pushes with `--last`, and lints pull requests with `--from <base sha> --to <head sha>`. |
| S8 | https://raw.githubusercontent.com/nodejs/Release/main/schedule.json | Node 26 is Active LTS (from 2026-10-28, ends 2029-04-30), Node 24 and Node 22 are Maintenance LTS (end 2028-04-30 and 2027-04-30), and Node 27 is not yet released. |

### Unverified, to settle during implementation

- **Action versions and SHAs.** The Obsidian sample still uses `actions/checkout@v3` and `actions/setup-node@v3` on Node 18, which are old. I have not looked up current versions or their commit SHAs. This is done with `gh api` when the workflow is written, and the SHAs are verified against each action's own repository.
- **`actions/attest@v4`.** Named in the Obsidian sample but not read; only relevant if question 3 is answered yes.
- **The Obsidian sample's `versions.json` helper.** Obsidian's sample plugin ships a version-bump script, but I have not read it, so its exact rule for when it adds an entry is unconfirmed. The rule above comes from the documentation page (S2).
- **Settings page requirement.** The Obsidian page says the repository's workflow permissions must be "Read and write permissions" in Settings, Actions, General. Whether the per-job `contents: write` is enough on its own, with the repository default left read-only, is untested. The beta test run settles it.
- **The nodejs.org release table** gave end-of-life dates that disagree with the official schedule file (it showed 2026 dates). I used the schedule file and did not rely on that page.
