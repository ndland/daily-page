# Daily Page

A Hobonichi-style daily page for Obsidian. Your day is a timeline of timestamped activities, side notes, a checklist of todos, and three things that would make the day great. It sits in a `daily-page` code block in your daily note, and it works on desktop and on iPhone.

## Install

Build the plugin package, then copy it into your vault:

```bash
npm install
npm run release
```

The build runs the test suite first, so a failing test stops the release. The package is written to `release/daily-page/`: `main.js`, `manifest.json` and `styles.css`. The release script refuses any file that mentions the harness. Copy them into `<your vault>/.obsidian/plugins/daily-page/`, then turn the plugin on under Settings, Community plugins. On iPhone, put the same folder in the vault through your sync method, and reload Obsidian.

## Update

Run `npm run release` again, copy the four files over the old ones, and reload Obsidian.

## Commands and keys

| Command | Key |
| --- | --- |
| Log activity | Alt+Shift+A |
| Log side note | Alt+Shift+N |
| End running activity | Alt+Shift+E |
| Undo last log | Alt+Shift+Z |
| Add todo | Alt+Shift+T |
| Add to three things | Alt+Shift+G |

Click a block, a side note, a todo or a bullet in Three things to edit it. Click a todo's box to finish it.

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

## Licence

Not yet chosen. Until a licence is added, all rights are reserved.
