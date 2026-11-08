import { ActivityEntry, NoteEntry, TimelineLine } from "../entries/format";
import { MINUTES_PER_DAY, formatTime } from "../logic/time";
import { colourForLabel } from "../logic/tags";
import { makeClickable } from "./access";

/** The visual axis runs from 06:00 down to 03:00 the next day: 21 hours. */
export const AXIS_START = 6 * 60;
export const AXIS_MINUTES = 21 * 60;

/** The minute of the day the axis ends at (03:00), where a running activity on a past day's note stops. */
export const DAY_END_MINUTE = (AXIS_START + AXIS_MINUTES) % MINUTES_PER_DAY;

/** Hour labels as they appear in the reference page, top to bottom. */
const HOUR_LABELS = [6, 9, 12, 15, 18, 21, 0, 3];

/**
 * Blocks shorter than this share of the axis are too short for a line of text. Their label
 * moves to the right of the block. 2.8% of the 21-hour axis is about 35 minutes.
 */
export const SHORT_BLOCK_PCT = 2.8;

/** The least distance, in pixels, between the centres of two short labels. */
export const LABEL_GAP_PX = 18;

/**
 * Moves short labels apart so none overlap. Labels are placed in time order, each at least
 * LABEL_GAP_PX below the one before. Measured in pixels, so it needs the timeline laid out.
 */
export function spreadShortLabels(timelineEl: HTMLElement): void {
  const height = timelineEl.clientHeight;
  if (height === 0) return;

  const items = [...timelineEl.querySelectorAll<HTMLElement>(".daily-page__block.is-short")]
    .map((block) => {
      const top = (parseFloat(block.style.top) / 100) * height;
      const blockHeight = (parseFloat(block.style.height) / 100) * height;
      return { block, label: block.querySelector<HTMLElement>(".daily-page__block-label"), top, centre: top + blockHeight / 2 };
    })
    .filter((item): item is typeof item & { label: HTMLElement } => item.label !== null)
    .sort((a, b) => a.centre - b.centre);

  // A label that wraps is taller than one line, so two labels need half of each one's height between their centres.
  const heights = items.map((item) => Math.max(LABEL_GAP_PX, item.label.offsetHeight));
  const gapBetween = (i: number): number => (heights[i - 1] + heights[i]) / 2;

  // Push each label down until it clears the one before, then pull back any label that would run
  // past the bottom of the axis, from the bottom up, as the notes are laid out.
  const centres: number[] = [];
  let previous = -Infinity;
  items.forEach((item, i) => {
    previous = Math.max(item.centre, i === 0 ? -Infinity : previous + gapBetween(i));
    centres.push(previous);
  });
  let limit = height;
  for (let i = centres.length - 1; i >= 0; i--) {
    centres[i] = Math.min(centres[i], limit);
    if (i > 0) limit = centres[i] - gapBetween(i);
  }
  // When the labels cannot all fit, they overlap, but none is placed off either end of the axis.
  for (let i = 0; i < centres.length; i++) {
    centres[i] = Math.min(Math.max(centres[i], 0), height);
  }

  items.forEach((item, i) => {
    // The label is positioned inside its block, so its offset is relative to the block's top.
    item.label.style.top = `${centres[i] - item.top}px`;
  });
}

export interface PositionedBlock {
  kind: "activity" | "note";
  label: string;
  timeText: string;
  /** Position and size as a percentage of the axis height. */
  topPct: number;
  heightPct: number;
  running: boolean;
  /** True when the entry starts between 03:00 and 06:00, outside the visible axis. */
  outOfAxis: boolean;
  /** Highlight from the label's tag, or null to use the default accent. */
  colour: string | null;
  /** Position of this entry in the timeline, and its exact line, used when editing. */
  index: number;
  raw: string;
}

export interface HourMark {
  text: string;
  topPct: number;
}

/** Minutes past 06:00, wrapping at midnight. Always in the range 0 to 1439. */
export function axisOffset(minutes: number): number {
  return (minutes - AXIS_START + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/**
 * The minute of the day at a point down the timeline, where `fraction` is 0 at the top (06:00) and 1 at the
 * bottom. Rounded down to a multiple of `step` minutes, so a tap lands on a tidy time.
 */
export function minuteAtFraction(fraction: number, step = 15): number {
  const clamped = Math.min(Math.max(fraction, 0), 1);
  const offset = Math.min(Math.floor((clamped * AXIS_MINUTES) / step) * step, AXIS_MINUTES - step);
  return (AXIS_START + offset) % MINUTES_PER_DAY;
}

function toPercent(offsetMinutes: number): number {
  return (offsetMinutes / AXIS_MINUTES) * 100;
}

function noteBlock(entry: NoteEntry, index: number, raw: string): PositionedBlock {
  const offset = axisOffset(entry.time);
  return {
    kind: "note",
    label: entry.text,
    timeText: formatTime(entry.time),
    topPct: toPercent(Math.min(offset, AXIS_MINUTES)),
    heightPct: 0,
    running: false,
    outOfAxis: offset > AXIS_MINUTES,
    colour: null,
    index,
    raw,
  };
}

function activityBlock(
  entry: ActivityEntry,
  now: number,
  tagColours: Record<string, string>,
  index: number,
  raw: string,
): PositionedBlock {
  const endMinutes = entry.end ?? now;
  const startOffset = axisOffset(entry.start);
  const length = (axisOffset(endMinutes) - startOffset + MINUTES_PER_DAY) % MINUTES_PER_DAY;

  const visibleStart = Math.min(startOffset, AXIS_MINUTES);
  const visibleEnd = Math.min(startOffset + length, AXIS_MINUTES);
  const endText = entry.end === null ? "now" : formatTime(entry.end);

  return {
    kind: "activity",
    label: entry.label,
    timeText: `${formatTime(entry.start)}-${endText}`,
    topPct: toPercent(visibleStart),
    heightPct: toPercent(visibleEnd - visibleStart),
    running: entry.end === null,
    outOfAxis: startOffset > AXIS_MINUTES,
    colour: colourForLabel(entry.label, tagColours),
    index,
    raw,
  };
}

/**
 * Converts the timeline into positioned blocks. A running activity runs up to `now`.
 * `tagColours` maps tag names to colours. Malformed lines are skipped here; they are
 * reported by validateTimeline instead.
 */
export function layoutTimeline(
  timeline: TimelineLine[],
  now: number,
  tagColours: Record<string, string> = {},
): PositionedBlock[] {
  const blocks: PositionedBlock[] = [];
  timeline.forEach((line, index) => {
    const entry = line.entry;
    if (!entry) return;
    blocks.push(
      entry.kind === "note"
        ? noteBlock(entry, index, line.raw)
        : activityBlock(entry, now, tagColours, index, line.raw),
    );
  });
  return blocks;
}

/** Hour labels at their positions on the axis. */
export function hourMarks(): HourMark[] {
  return HOUR_LABELS.map((hour) => ({
    text: String(hour),
    topPct: toPercent(axisOffset(hour * 60)),
  }));
}

/**
 * Draws positioned blocks into the timeline column and the notes column. Clicking a block
 * calls `onEdit` with it, so the caller can open an editor.
 */
export function renderBlocks(
  timelineEl: HTMLElement,
  notesEl: HTMLElement,
  blocks: PositionedBlock[],
  onEdit?: (block: PositionedBlock) => void,
  onPlan?: (minute: number) => void,
): void {
  // A tap on empty timeline, not on a block, plans a block at that time.
  if (onPlan) {
    timelineEl.classList.add("is-plannable");
    timelineEl.addEventListener("click", (event) => {
      if (event.target !== timelineEl) return;
      const box = timelineEl.getBoundingClientRect();
      if (box.height === 0) return;
      onPlan(minuteAtFraction((event.clientY - box.top) / box.height));
    });
  }

  for (const block of blocks) {
    if (block.kind === "note") {
      const el = document.createElement("div");
      el.className = "daily-page__note";
      // Placed by percentage here, then snapped to the grid once the page has its size (keepFitted).
      el.style.top = `${block.topPct}%`;
      el.dataset.topPct = String(block.topPct);
      // The time is its own element, so it can be styled apart from the note's text. The space after it
      // keeps the text readable when it is copied.
      const time = document.createElement("span");
      time.className = "daily-page__note-time";
      time.textContent = block.timeText;
      // The text is its own element too, so a note that wraps lines up under its first line, not under the time.
      const text = document.createElement("span");
      text.className = "daily-page__note-text";
      text.textContent = ` ${block.label}`;
      el.append(time, text);
      if (block.outOfAxis) el.classList.add("daily-page__out-of-axis");
      if (onEdit) makeClickable(el, () => onEdit(block));
      notesEl.appendChild(el);
      continue;
    }

    const el = document.createElement("div");
    el.className = "daily-page__block";
    if (block.running) el.classList.add("is-running");
    if (block.outOfAxis) el.classList.add("daily-page__out-of-axis");
    el.style.top = `${block.topPct}%`;
    el.style.height = `${block.heightPct}%`;
    if (block.colour) el.style.setProperty("--dp-block-accent", block.colour);
    // Short blocks keep their colour strip at part width, and their label sits to the right.
    if (block.heightPct < SHORT_BLOCK_PCT) el.classList.add("is-short");
    // The text wraps when the block is narrow. The full label is also on hover.
    const full = `${block.timeText}  ${block.label}`;
    el.title = full;
    const label = document.createElement("span");
    label.className = "daily-page__block-label";
    label.textContent = full;
    el.appendChild(label);
    if (onEdit) makeClickable(el, () => onEdit(block));
    timelineEl.appendChild(el);
  }
}

