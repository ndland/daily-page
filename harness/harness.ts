import { renderPage } from "../src/render/page";
import { keepFitted } from "../src/render/fit";
import { DEFAULT_TAG_COLOURS } from "../src/defaults";
import { parseTagColours } from "../src/logic/tags";
import { setChecklistItem, type ScopeEdit } from "../src/entries/edit";
import { openBlockEditor, openGreatThingEditor, openPlanDialog } from "../src/vault/editor";
import type { StoredQuote } from "../src/logic/quoteCache";

/** The same sample day as the test vault, so the harness matches what you see in Obsidian. */
const sampleNote = [
  "## Timeline",
  "- 09:00-10:15 Email #work",
  "- 09:40 note: idea for the proposal",
  "- 10:15-12:00 Proposal draft #deep",
  "- 12:00-13:00 Lunch",
  "- 13:00-13:30 Review notes",
  "- 13:30-13:45 Quick call (15 min) #work",
  "- 13:45-14:15 Standup (30 min) #deep",
  "- 15:00-15:15 Call with Sam (15 min) #work",
  "- 15:15-15:30 Check email (15 min) #deep",
  "- 15:30-15:45 Quick review (15 min) #work",
  "- 14:29 note: I'm testing this out.",
  "",
  "## Checklist",
  "- [x] Walk",
  "- [x] Water",
  "- [x] Read ten pages",
  "- [ ] New todo",
  "- [ ] Nice",
  "",
  "## Three things",
  "- Finish the proposal draft",
  "- Walk outside before dinner",
  "- Call Mum",
];

/** A new note, as the template creates it: the three sections with nothing in them. */
const emptyNote = ["## Timeline", "", "## Checklist", "", "## Three things"];

const quote: StoredQuote = {
  date: "2026-11-06",
  text: "Your mind is infinite, it's your doubts that are limiting.",
  author: "Robert Kiyosaki",
};

/** Long text in every place that used to be cut with an ellipsis. Everything should wrap. */
const longNote = [
  "## Timeline",
  "- 07:22-07:23 Wake up",
  "- 07:30-08:24 Shower, clean up, and a long breakfast with the whole family before heading out #family",
  "- 07:50 note: Hectic trying to get everyone ready for family pictures and the kids still have no shoes on",
  "- 09:45-11:45 Family pictures at the park with everyone, including the grandparents #family",
  "- 10:00 note: Short note",
  "- 10:05 note: Another quite long side note that has to wrap onto several lines in the narrow notes column",
  "- 12:00-12:20 A quick lunch that is a very long label for a short block #health",
  "",
  "## Checklist",
  "- [ ] Call the photographer about the prints and ask whether the extra edits are included",
  "- [x] Pack the bags for the trip to Mom and Dad's house this afternoon, including snacks",
  "- [x] Water",
  "",
  "## Three things",
  "- We have a good family photo session that everyone enjoys and nobody complains about",
  "- Everything goes ok at Mom & Dad's",
  "- The kids are all good today",
];

/** A day with an activity still running, to try Start now and the running-activity rules. */
const runningNote = ["## Timeline", "- 09:00-10:00 Email #work", "- 13:00- Writing the release notes #deep", "", "## Checklist", "", "## Three things"];

const params = new URLSearchParams(location.search);
/** Side notes of every length, to see how wrapped notes line up, space out and sit apart. ?note=notes */
const notesNote = [
  "## Timeline",
  "- 08:00 note: Short note",
  "- 09:00 note: Hectic trying to get everyone ready for family pictures",
  "- 10:30 note: It was cold for pictures, but everyone did well. Hopefully the pictures turn out, and the grandparents liked the park.",
  // Two notes close together, to show that a tall note pushes the next one down instead of overlapping it.
  "- 12:00 note: A long note right before another one, which has to wrap onto several lines in the narrow notes column",
  "- 12:10 note: And a second note ten minutes later",
  "- 15:00 note: One more of medium length that wraps once",
  "",
  "## Checklist",
  "",
  "## Three things",
  "- Wrapped lines sit on consecutive grid lines",
];

const modes: Record<string, string[]> = { empty: emptyNote, long: longNote, running: runningNote, notes: notesNote };
let lines = [...(modes[params.get("note") ?? ""] ?? sampleNote)];

// A fixed moment, so screenshots and measurements are repeatable: 14:30.
const NOW = new Date(2026, 10, 6, 14, 30);
const host = document.getElementById("host");

/** Draws the page from `lines`. An edit changes `lines` and draws again, as the plugin does with the note. */
function draw(): void {
  if (!host) return;
  renderPage(host, lines, NOW, quote, {
    // ?day=past shows the note as a past day's: no Start now, and a running activity runs to the end of that day.
    date: params.get("day") === "past" ? new Date(2026, 10, 5) : undefined,
    accent: "#bd93f9",
    tagColours: parseTagColours(DEFAULT_TAG_COLOURS),
    handlers: {
      onToggle: (item, checked) => apply((scope) => setChecklistItem(scope, item, checked)),
      onEdit: (block, isToday) => openBlockEditor(block, apply, { canStart: isToday }),
      onEditGreatThing: (item) => openGreatThingEditor(item, apply),
      onPlan: (minute) => openPlanDialog(minute, apply),
    },
  });
  const page = host.querySelector<HTMLElement>(".daily-page");
  if (page) keepFitted(page);
  // Exposed for measurement from the browser console.
  const exposed = window as unknown as Record<string, unknown>;
  exposed.harnessPage = page;
  exposed.harnessLines = () => [...lines];
}

/** Applies an edit the way the plugin does: a refusal shows its message, and the note stays as it was. */
function apply(edit: ScopeEdit): void {
  const outcome = edit(lines, NOW.getHours() * 60 + NOW.getMinutes());
  if (outcome.ok) {
    lines = outcome.lines;
    draw();
    return;
  }
  const message = document.createElement("div");
  message.className = "daily-page__message";
  message.textContent = outcome.message;
  host?.prepend(message);
  setTimeout(() => message.remove(), 4000);
}

draw();
