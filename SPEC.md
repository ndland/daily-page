# SPEC: Daily Page

Status: **draft, awaiting confirmation.** No code has been written.
Source of intent: the confirmed statement of intent from the interview (summarized in section 1).
Capability map: approved (modules A to F, section 7).

## 1. Objective

A daily page in Obsidian that mirrors the Hobonichi A6 Techo daily layout, in the Dracula palette. It works alongside the paper Hobonichi rather than replacing it.

- **User:** you, for planning and reviewing each day.
- **Why:** you want the digital page to be easy to start from any device, in the layout you already know from paper.
- **Success:**
  - Today's page opens with the date, the checklist, the timeline, and the notes column.
  - A hotkey logs an activity or a side note in a few seconds.
  - A finished day reads back correctly.
  - The footer quote and mini calendar render with no network.
- **Scope:** daily page only. Weekly and monthly views, aggregation, data-driven prompts, and Things integration beyond the checklist are out of scope and belong to later phases.
- **Platform:** Windows desktop and iPhone (Obsidian mobile). On a narrow screen the page is one column that scrolls, and no text is cut short. See the 500px media query in styles/daily-page.css.

## 2. Commands

Tech stack: TypeScript (strict), the Obsidian plugin API, esbuild for bundling, Vitest for tests, Node LTS.

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Rebuild on save (esbuild watch) into the test vault's plugin folder |
| `npm run build` | Type-check and produce the production bundle |
| `npm test` | Run the unit tests in `tests/` |

Plugin commands (available in Obsidian's command palette, with hotkeys you choose):

| Command | Behavior |
| --- | --- |
| Log activity | Prompts for a label, stamps the current time, ends the running activity at that time, and starts the new one. |
| Log side note | Prompts for text, stamps the current time, and adds the note. It does not change any activity's end time. |
| End running activity | Stamps the current time as the running activity's end. Adds no new line. |
| Undo last log | Reverts the last edit to the page in this session (a log, a tick, or an edit), including the previous running activity's end time. It changes only the page's lines, so text outside the page is kept. If the page has changed since that edit, it refuses rather than revert the newer change. |

## 3. Project structure

Source lives in its own git repository, outside the vault (`C:\Users\Nick Land\Documents\GitHub\daily-page`). It was moved out of the vault's `99_System/Automation/` folder because the vault's auto-commit sweeps in everything in the working tree, and Obsidian indexes `node_modules` as notes.

The vault receives only the built plugin, copied into `.obsidian/plugins/daily-page/` when a release is ready. Development happens in a separate test vault copy.

```
daily-page/              (repository root)
  manifest.json          plugin manifest
  package.json
  tsconfig.json
  esbuild.config.mjs
  src/
    main.ts              plugin entry; registers commands and the code-block renderer
    entries/
      format.ts          (A) parse and serialize timeline lines
      log.ts             (B) log, side-note, end, and undo actions
    render/
      page.ts            page shell and layout (C)
      checklist.ts       (C) checkbox rendering
      timeline.ts        (D) spans and the notes column
      dateBlock.ts       (E) date, moon phase, day-of-year
      calendar.ts        (E) mini month grid
      quote.ts           (F) fetch, cache, and display
    logic/               pure functions with no Obsidian imports (tested directly)
      time.ts            HH:MM parsing and minutes arithmetic
      moon.ts            moon phase
      dayOfYear.ts       day-of-year
      calendarGrid.ts    month grid, Monday first
      quoteCache.ts      per-day cache rules
  styles/
    daily-page.css       (C) Dracula styles
  tests/                 Vitest tests mirroring src/logic and src/entries
```

Build output: `main.js`, `manifest.json`, and `styles.css` go to `.obsidian/plugins/daily-page/` in the **test copy** of the vault during development.

## 4. Code style

- TypeScript with `strict: true`. No `any` without a comment that explains it.
- Pure logic lives in `src/logic/` and `src/entries/`. It does not import from `obsidian`, so it can be tested without Obsidian running.
- Times are stored as minutes from midnight internally, and as `HH:MM` text in the note.
- Functions stay under about 40 lines. Split by responsibility rather than by layer.
- Formatting follows Prettier defaults. Names are `camelCase` for values and functions, `PascalCase` for types.
- Comments explain *why*, not *what*. The moon-phase math needs one.
- The only default export is the plugin class in `main.ts`.

## 5. Testing strategy

- **Unit tests (Vitest)** cover everything in `src/logic/` and `src/entries/`:
  - Entry parse and serialize round trip, with malformed lines preserved.
  - Activity logging: ending the previous entry, and side notes leaving end times unchanged.
  - Span and position calculation for the timeline.
  - Date, moon phase, day-of-year, and the Monday-first calendar grid.
  - Quote cache rules.
- **Manual checks in a copy of the vault** cover the Obsidian-dependent parts:
  - Hotkeys and the command palette.
  - Rendering in reading view and live preview.
  - Behavior with the network off.
  - A visual comparison against the reference photo of the Hobonichi spread.
- **Acceptance rule:** every acceptance criterion in section 7 maps to at least one unit test or one listed manual check. Nothing ships on a manual check that has not been run.
- Tests run before every build. A failing test blocks the build.

## 6. Boundaries

**Always**
- Write only to today's daily note.
- Keep entries as plain markdown lines.
- Test changes in a copy of the vault first.
- Leave the paper Hobonichi routine alone.

**Ask first**
- Any network call besides the quote source.
- Any change to the entry format after it is in use.
- Any new plugin dependency.
- Any change to Things.

**Never**
- Delete or rewrite past entries.
- Store API keys in the repository.
- Send vault contents to an outside service.

## 7. Modules and acceptance criteria

Build order: A, then C, then B and D in parallel, then E and F.

### A. Entry format (no dependencies)

The daily note holds two sections:

```
## Timeline
- 09:00-10:15 Email
- 10:15- Proposal draft
- 09:40 note: idea for the proposal

## Checklist
- [ ] Walk
- [x] Water
```

- Closed activity: `- HH:MM-HH:MM Label`.
- Running activity: `- HH:MM- Label`. At most one running activity per day.
- Side note: `- HH:MM note: text`.
- Checklist: plain markdown tasks. They can be typed by hand, added with the Add todo hotkey, or ticked by clicking the box.

**Acceptance**
- Parsing and then serializing a note returns it byte for byte.
- A malformed line is kept as it is and flagged. It is never deleted.
- A day with two running activities is flagged, not silently fixed.

### B. Logging hotkeys (depends on A)

**Acceptance**
- Log activity ends the running activity at the new stamp and adds the new one as running.
- Log side note adds a note line and changes no activity's end time.
- End running activity sets the end time and adds no line.
- Undo last log reverts the last edit to the page in this session, including the previous end time. Text outside the page is kept.
- Undo is refused, and the note is left as it is, when the page changed after that edit.
- A log time earlier than the running activity's start is rejected with a message.
- If today's note does not exist, the first log creates it with both sections.

### C. Page layout and styles (no dependencies)

Layout, following the reference photo:
- Top left: date block. Top right: checklist column.
- Body: hour labels on the far left, then the timeline, then a solid divider, then the notes column to the right of the divider.
- Footer: quote area.

Palette (Dracula only). This mapping is a proposal to check during review:

| Role | Colour |
| --- | --- |
| Page background | `#282A36` |
| Primary text | `#F8F8F2` |
| Grid, ink, and hour labels | `#6272A4` |
| Grid and divider lines | `#44475A` |
| Today and running activity | `#BD93F9` |
| Checked items | `#8BE9FD` |

Note: `#6272A4` on `#282A36` has low contrast. Use it for lines and decoration only. Text uses `#F8F8F2`.

**Acceptance**
- Section order matches the reference photo.
- No text overflows at a narrow window width.
- Text meets a contrast ratio of 4.5:1 against the background.
- Light and dark themes are not required. The page is always Dracula.

### D. Timeline rendering (depends on A and C)

- Each closed activity is drawn as a block from its start to its end on the hour axis.
- A running activity is drawn from its start to the current time, with a visible running indicator.
- Side notes sit in the notes column at their timestamp.
- The hour axis runs 06 at the top to 03 at the bottom. It is a visual guide only and does not restrict entries.
- Entries outside that range still render, marked as out of the axis.

**Acceptance**
- An activity from 09:00 to 13:30 starts at the 09 mark and ends at the 13:30 position.
- A side note at 09:40 sits at the 09:40 position in the notes column.
- A day with only side notes renders the notes column with no timeline blocks.

### E. Date block and mini calendar (depends on C)

- Date block: month abbreviation, day number, weekday abbreviation, moon-phase icon, and day of year.
- Moon phase uses the mean synodic month, 29.530588853 days, counted from the reference new moon of 2000-01-06 18:14 UTC. The icon is one of eight phases.
- Mini calendar: the current month in a Monday-first grid, with today highlighted in the accent colour.

**Acceptance**
- 2026-07-23 shows `THU` and day `204`.
- The November 2026 grid starts with six blank cells, because 2026-11-01 is a Sunday.
- 2000-01-06 shows the new-moon icon, within one day.

### F. Daily quote (depends on C)

- On the first render of each day, fetch one quote and cache it against that date.
- Later renders that day use the cache with no network call.
- With no network, show the most recent cached quote.
- With no cache and no network, hide the footer quote without showing an error.
- The provider is chosen after checking reliability, display licence, rate limits, and attribution requirements.
- The plugin is the only code that fetches a quote. The Dataview view makes no network call. It shows the quote the plugin has cached, so a note never shows a different quote from the plugin, and a note never has a quote written into it.

**Provider decision: ZenQuotes** (`https://zenquotes.io/api/today`)
- Attribution: required on the free tier. The official ZenQuotes documentation (docs.zenquotes.io) asks free users to link back to zenquotes.io. The footer shows "Inspirational quotes provided by ZenQuotes API" with that link, always alongside a quote.
- Rate limit: the code makes at most one attempt every 15 minutes, which is far below any limit. The figure of 5 requests per 30 seconds is from third-party listings, not the official documentation, so confirm it before release.
- Display licence: the official documentation's attribution requirement is the only licence condition confirmed. Confirm the full current terms before release.
- Reliability: a failed or throttled attempt falls back to the most recent cached quote. With no cache, no quote is shown and no error appears.
- Status: selected in principle, pending the two confirmations above before release.

**Acceptance**
- Two renders on the same day trigger one fetch (checked with a mocked fetch in a unit test).
- With the network off, the cached quote shows and no error appears.
- With no cache and no network, the footer is hidden and no error is shown.
- The first render of a note does not wait on the network: it draws at once with the cached quote.

## 8. Open questions (not blocking)

1. **Quote provider:** ZenQuotes, selected in section F. Two points need confirming before release: the rate limit and the full display licence.
2. **Running activity past midnight:** the default is that it stays running in its own day's note and is not closed by the next day's entries. Confirm, or pick another rule.
3. **Week start:** Monday, assumed from the reference photo. Confirm.
4. **Hotkey defaults:** choose when building module B.
