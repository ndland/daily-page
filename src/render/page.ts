import { readTimeline } from "../entries/format";
import { minutesOfDay } from "../logic/time";
import { StoredQuote } from "../logic/quoteCache";
import { renderDateBlock, renderMiniCalendar } from "./dateBlock";
import { readChecklist, renderChecklist } from "./checklist";
import { hourMarks, layoutTimeline, renderBlocks } from "./timeline";
import { renderQuote } from "./quote";

function el(tag: string, className: string, parent?: HTMLElement): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  parent?.appendChild(node);
  return node;
}

/** Draws the whole daily page into `root`, replacing anything already there. */
export function renderPage(
  root: HTMLElement,
  noteLines: string[],
  now: Date,
  quote: StoredQuote | null,
): void {
  root.replaceChildren();
  const page = el("div", "daily-page", root);

  const top = el("div", "daily-page__top", page);
  renderDateBlock(top, now);
  renderChecklist(top, readChecklist(noteLines));

  const body = el("div", "daily-page__body", page);
  const hours = el("div", "daily-page__hours", body);
  for (const mark of hourMarks()) {
    const label = el("span", "daily-page__hour-label", hours);
    label.textContent = mark.text;
    label.style.top = `${mark.topPct}%`;
  }
  const timelineEl = el("div", "daily-page__timeline", body);
  el("div", "daily-page__divider", body);
  const notesEl = el("div", "daily-page__notes", body);

  const timeline = readTimeline(noteLines);
  renderBlocks(timelineEl, notesEl, layoutTimeline(timeline, minutesOfDay(now)));

  const footer = el("div", "daily-page__footer", page);
  renderQuote(el("div", "", footer), quote);
  renderMiniCalendar(footer, now);
}
