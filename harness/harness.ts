import { renderPage } from "../src/render/page";
import { keepFitted } from "../src/render/fit";
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

const host = document.getElementById("host");
if (host) {
  // A fixed moment, so screenshots and measurements are repeatable.
  // ?note=empty shows a new note with no entries, as the template creates it.
  const shown = new URLSearchParams(location.search).get("note") === "empty" ? emptyNote : sampleNote;
  renderPage(host, shown, new Date(2026, 10, 6, 14, 30), quote, {
    accent: "#bd93f9",
    tagColours: { work: "#8be9fd", deep: "#ff79c6" },
  });
  const page = host.querySelector<HTMLElement>(".daily-page");
  if (page) keepFitted(page);
  // Exposed for measurement from the browser console.
  (window as unknown as Record<string, unknown>).harnessPage = page;
}
