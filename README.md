# Daily Page

A Hobonichi-style daily page for Obsidian. Your day is a timeline of timestamped activities, side notes, a checklist of todos, and three things that would make the day great. It sits in a `daily-page` code block in your daily note, and it works on desktop and on iPhone.

## Install

**With BRAT:** add `ndland/daily-page` in BRAT. It installs the latest GitHub release and updates it when you run "Check for updates to all beta plugins". Reload the plugin after an update.

**From a build:** build the plugin package, then copy it into your vault:

```bash
npm install
npm run release
```

The build runs the test suite first, so a failing test stops the release. The package is written to `release/daily-page/`: `main.js`, `manifest.json` and `styles.css`. The release script refuses any file that mentions the harness. To copy it into a vault in one step, run `npm run install:vault -- "<path to your vault>"`. That copies the three files to `<vault>/.obsidian/plugins/daily-page/` and leaves `data.json` alone. Then turn the plugin on under Settings, Community plugins. On iPhone, the vault's own sync carries the files, then reload Obsidian.

A plugin installed with BRAT is replaced by BRAT's next update, so do not mix the two on one device.

## Update

With BRAT, run its update check. From a build, run `npm run release` or `npm run install:vault` again, then reload Obsidian.

## Commands and keys

| Command | Key |
| --- | --- |
| Log activity | Alt+Shift+A |
| Log side note | Alt+Shift+N |
| End running activity | Alt+Shift+E |
| Undo last log | Alt+Shift+Z |
| Add todo | Alt+Shift+T |
| Add to three things | Alt+Shift+G |
| Plan a block | Alt+Shift+P |

Click a block, a side note, a todo or a bullet in Three things to edit it. Click a todo's box to finish it.

## Planning your day

A planned block is an ordinary closed entry such as `- 14:00-15:00 Review #meeting`. It may overlap other entries or lie in the past, and it never counts as the running activity. Plan one by tapping an empty spot on the timeline (the dialog starts at the time you tapped), or with the Plan a block command (it starts at the next half hour). The Plan a block command is the keyboard route, since tapping needs a mouse or a touch screen. After 23:15 it suggests 23:30, so a plan stays at the end of today. To begin a planned block, click it and choose Start now (a label you changed in the dialog is kept, and the button is not offered on a past day's note, where the clock's time does not belong): it becomes the running activity, and any other running activity ends at that minute.

A page with a running activity redraws once a minute, so its block keeps up with the clock. On a device set to read-only, tapping the page opens no editing dialog.

## Tag colours

Put a tag such as `#work` in a label and the block takes that tag's colour. The first tag in a label that has a colour wins. Set the colours in the plugin settings, one `tag #hex` per line. The defaults use the Dracula palette (work, deep, meeting, admin, health, family, rest), and Reset to defaults puts them back. A setting still at the original two colours (work and deep) is upgraded to the new defaults when the plugin loads, and a setting you changed is kept. When the plugin is on, the Dataview view uses these settings too.

## Quotes

The footer quote comes from ZenQuotes (zenquotes.io), fetched at most once a day. The page shows the attribution with each quote, as ZenQuotes' free use requires.

Each day's quote is kept in the plugin's data, so a past note shows the quote kept for its own day. A past day with no kept quote shows none, because it cannot be fetched again.

## Daily note setup

- Put exactly one `daily-page` block in the note, with `## Timeline`, `## Checklist` and `## Three things` inside it.
- Leave a blank first line in the note. Without it, the cursor at the top can show the block's raw code.
- To create new notes from a template, set the template path in the plugin settings. The template must hold exactly one complete `daily-page` block. That block is reset to the three empty sections for each new note, so entries in the template are not copied. If the template is unusable, the built-in note is used and the reason is shown.
- To hide the note title and properties box in reading and editing, set `cssclasses: daily-note` in the note's frontmatter and add the snippet rules from `styles/vault.css`.
- A `dataviewjs` block in a template is executable code, so only use templates you trust.

## Development

```bash
npm test           # the test suite
npm run build      # type check and production build into dist/
npm run harness    # build the browser harness
npm run audit     # dependency vulnerabilities, at high severity and above
node harness/serve.mjs   # then open http://localhost:5173/harness/index.html
```

The harness shows the page in a browser, at a phone or desktop width. It is a development tool only. It is not part of the plugin: `npm run release` copies just the plugin files listed above, so the harness, the vault view in `dist/vault/`, the source and the tests never reach the plugin package.

## Commits and changelog

Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`, such as `fix(plan): refuse a block over 12 hours`. The scope is required and must be one of the areas listed in `commitlint.config.mjs`. A commit message hook (husky and commitlint) rejects anything else, and it is installed by `npm install`. Messages also carry no trailers: lines such as `Co-Authored-By`, `Signed-off-by` or "Generated with" are rejected.

```bash
npm run commit     # stage your changes first, then pick the type and scope from a list
npm run changelog  # regenerate CHANGELOG.md from the commit history
```

To add a scope, add it to the list in `commitlint.config.mjs`. The check and the prompt both read that one list. The changelog groups `feat` and `fix` commits by release tag, so tag a release before generating it.

## Releasing

A release is made on your machine and published by GitHub. You run one command to prepare it, review the result, and push the tag. Pushing the tag is what publishes: GitHub Actions builds the plugin from the tagged commit and creates the release. Nothing here pushes for you.

```bash
npm run release:prepare -- --dry-run   # the gates, the next version and the files it would change; changes nothing
npm run release:prepare                # make the release commit and the tag
git show                               # review the release commit
git push --follow-tags                 # publish: CI takes over from here
```

1. **Prepare.** From a clean `main`, `release:prepare` runs the gates (tests, type check, `npm audit`, commit messages since the last release, and the version files), then picks the next version from the commits. Below 1.0, a `feat` or a breaking change bumps the minor number and a `fix` bumps the patch. It writes the version into `package.json`, `package-lock.json` and `manifest.json`, regenerates `CHANGELOG.md`, commits `chore(release): X.Y.Z`, and makes an annotated tag `X.Y.Z`. To choose the version yourself: `npm run release:prepare -- 0.3.0`.
2. **Publish.** `git push --follow-tags` sends the commit and the tag. CI checks the tag against the version files, audits, checks the commit messages, builds, and creates the release as a **draft** with `main.js`, `manifest.json`, `styles.css` and the changelog section as notes.
3. **Release the draft.** Open the draft on GitHub, check the notes and the three files, and press Publish release.
4. **Update.** In BRAT, run "Check for updates to all beta plugins", then reload the plugin.

**Betas.** `npm run release:prepare -- --beta` makes only a tag, such as `0.2.0-beta.1`, on the current commit: no commit and no file change, so `main` keeps its stable version. Publish it with `git push origin 0.2.0-beta.1`. CI publishes it straight away as a **prerelease** and writes the beta version into the packaged `manifest.json`, so BRAT can install it. BRAT's "latest" option takes the highest version including prereleases, so a device that must stay on stable should use BRAT's frozen version.

**If something fails.** A failing gate stops `release:prepare` with that gate's output before anything is written. A failure after that restores every file and drops the commit, so no commit, tag or changed file is left behind. If CI fails after you push a tag, delete the tag (`git push --delete origin X.Y.Z` and `git tag -d X.Y.Z`), fix the cause, and prepare again. Never move the tag of a published release.

**`minAppVersion`.** Raise it by editing `manifest.json` on purpose. The next release then adds the matching `versions.json` entry. Releases that leave it alone do not touch `versions.json`.

`npm run release:check [tag]` checks that the version files agree, and that a tag matches them, without releasing anything.

## Licence

Not yet chosen. Until a licence is added, all rights are reserved.
