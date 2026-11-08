import { readTimeline } from "../entries/format";
import { minutesOfDay } from "../logic/time";
import { renderDateBlock, renderMiniCalendar } from "./dateBlock";
import { ChecklistItem, readChecklist, renderChecklist } from "./checklist";
import { DAY_END_MINUTE, PositionedBlock, hourMarks, layoutTimeline, renderBlocks } from "./timeline";
import { QuoteText, renderQuote } from "./quote";
import { renderDoneList } from "./done";
import { GreatThing, readGreatThings, renderGreatThings } from "./greatThings";

function sameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function el(tag: string, className: string, parent?: HTMLElement): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  parent?.appendChild(node);
  return node;
}

/** What happens when the reader clicks something on the page. */
export interface PageHandlers {
  onToggle?: (item: ChecklistItem, checked: boolean) => void;
  /** A click on a block. `isToday` is false on a past day's note, where "now" is not the note's time. */
  onEdit?: (block: PositionedBlock, isToday: boolean) => void;
  /** A tap on an empty spot of the timeline, with the minute of the day it is at. */
  onPlan?: (minute: number) => void;
  onEditGreatThing?: (item: GreatThing) => void;
}

export interface PageOptions {
  /** Highlight colour as a CSS colour, such as "#bd93f9". Falls back to the stylesheet default. */
  accent?: string;
  /** Tag name to colour, for activity labels such as "Email #work". */
  tagColours?: Record<string, string>;
  handlers?: PageHandlers;
  /**
   * The day the note is for. The date, moon phase, day of the year and mini calendar come from it, so an
   * old note keeps its own day. Defaults to `now`. Running activities always use `now`.
   */
  date?: Date;
}

/** Draws the whole daily page into `root`, replacing anything already there. */
export function renderPage(
  root: HTMLElement,
  noteLines: string[],
  now: Date,
  quote: QuoteText | null,
  options: PageOptions = {},
): void {
  root.replaceChildren();
  const page = el("div", "daily-page", root);
  if (options.accent) page.style.setProperty("--dp-accent", options.accent);

  // The top row, as on the Hobonichi page: the date at the top left, the todos at the top right.
  const checklist = readChecklist(noteLines);
  const top = el("div", "daily-page__top", page);
  const noteDay = options.date ?? now;
  renderDateBlock(top, noteDay);
  const topRight = el("div", "daily-page__top-right", top);
  renderChecklist(topRight, checklist, options.handlers?.onToggle);

  const body = el("div", "daily-page__body", page);
  const hours = el("div", "daily-page__hours", body);
  for (const mark of hourMarks()) {
    const label = el("span", "daily-page__hour-label", hours);
    label.textContent = mark.text;
    label.style.top = `${mark.topPct}%`;
  }
  const timelineEl = el("div", "daily-page__timeline", body);
  el("div", "daily-page__divider", body);
  // The notes column opens with the three things box, and the timed notes sit below it.
  const notesEl = el("div", "daily-page__notes", body);
  renderGreatThings(notesEl, readGreatThings(noteLines), options.handlers?.onEditGreatThing);
  const notesArea = el("div", "daily-page__notes-area", notesEl);

  const timeline = readTimeline(noteLines);
  const isToday = sameCalendarDay(noteDay, now);
  const onEdit = options.handlers?.onEdit;
  renderBlocks(
    timelineEl,
    notesArea,
    // On a past day's note a running activity has no "now" to run up to, so it runs to the end of that day.
    layoutTimeline(timeline, isToday ? minutesOfDay(now) : DAY_END_MINUTE, options.tagColours ?? {}),
    onEdit && ((block) => onEdit(block, isToday)),
    options.handlers?.onPlan,
  );

  const footer = el("div", "daily-page__footer", page);
  const footerLeft = el("div", "daily-page__footer-left", footer);
  // Finished todos sit at the foot of the notes column, where the empty space is.
  renderDoneList(notesEl, checklist);
  renderQuote(footerLeft, quote);
  renderMiniCalendar(footer, noteDay);
}
