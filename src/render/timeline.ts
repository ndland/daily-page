import { ActivityEntry, NoteEntry, TimelineLine } from "../entries/format";
import { MINUTES_PER_DAY, formatTime } from "../logic/time";
import { colourForLabel } from "../logic/tags";
import { makeClickable } from "./access";

/** The visual axis runs from 06:00 down to 03:00 the next day: 21 hours. */
export const AXIS_START = 6 * 60;
export const AXIS_MINUTES = 21 * 60;

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

  // Push each label down until it clears the one before, then pull back any label that would run
  // past the bottom of the axis, from the bottom up, as the notes are laid out.
  const centres: number[] = [];
  let previous = -Infinity;
  for (const item of items) {
    previous = Math.max(item.centre, previous + LABEL_GAP_PX);
    centres.push(previous);
  }
  let limit = height;
  for (let i = centres.length - 1; i >= 0; i--) {
    centres[i] = Math.min(centres[i], limit);
    limit = centres[i] - LABEL_GAP_PX;
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
): void {
  for (const block of blocks) {
    if (block.kind === "note") {
      const el = document.createElement("div");
      el.className = "daily-page__note";
      // Placed by percentage here, then snapped to the grid once the page has its size (keepFitted).
      el.style.top = `${block.topPct}%`;
      el.dataset.topPct = String(block.topPct);
      el.textContent = `${block.timeText}  ${block.label}`;
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
    // Otherwise, one line of text, cut with an ellipsis if the block is too narrow for it.
    // The full label is on hover.
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

