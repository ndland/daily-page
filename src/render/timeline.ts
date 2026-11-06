import { ActivityEntry, NoteEntry, TimelineLine } from "../entries/format";
import { MINUTES_PER_DAY, formatTime } from "../logic/time";

/** The visual axis runs from 06:00 down to 03:00 the next day: 21 hours. */
export const AXIS_START = 6 * 60;
export const AXIS_MINUTES = 21 * 60;

/** Hour labels as they appear in the reference page, top to bottom. */
const HOUR_LABELS = [6, 9, 12, 15, 18, 21, 0, 3];

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

function noteBlock(entry: NoteEntry): PositionedBlock {
  const offset = axisOffset(entry.time);
  return {
    kind: "note",
    label: entry.text,
    timeText: formatTime(entry.time),
    topPct: toPercent(Math.min(offset, AXIS_MINUTES)),
    heightPct: 0,
    running: false,
    outOfAxis: offset > AXIS_MINUTES,
  };
}

function activityBlock(entry: ActivityEntry, now: number): PositionedBlock {
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
  };
}

/**
 * Converts the timeline into positioned blocks. A running activity runs up to `now`.
 * Malformed lines are skipped here; they are reported by validateTimeline instead.
 */
export function layoutTimeline(timeline: TimelineLine[], now: number): PositionedBlock[] {
  const blocks: PositionedBlock[] = [];
  for (const line of timeline) {
    const entry = line.entry;
    if (!entry) continue;
    blocks.push(entry.kind === "note" ? noteBlock(entry) : activityBlock(entry, now));
  }
  return blocks;
}

/** Hour labels at their positions on the axis. */
export function hourMarks(): HourMark[] {
  return HOUR_LABELS.map((hour) => ({
    text: String(hour),
    topPct: toPercent(axisOffset(hour * 60)),
  }));
}

/** Draws positioned blocks into the timeline column and the notes column. */
export function renderBlocks(
  timelineEl: HTMLElement,
  notesEl: HTMLElement,
  blocks: PositionedBlock[],
): void {
  for (const block of blocks) {
    if (block.kind === "note") {
      const el = document.createElement("div");
      el.className = "daily-page__note";
      el.style.top = `${block.topPct}%`;
      el.textContent = `${block.timeText}  ${block.label}`;
      if (block.outOfAxis) el.classList.add("daily-page__out-of-axis");
      notesEl.appendChild(el);
      continue;
    }

    const el = document.createElement("div");
    el.className = "daily-page__block";
    if (block.running) el.classList.add("is-running");
    if (block.outOfAxis) el.classList.add("daily-page__out-of-axis");
    el.style.top = `${block.topPct}%`;
    el.style.height = `${block.heightPct}%`;
    el.textContent = `${block.timeText}  ${block.label}`;
    timelineEl.appendChild(el);
  }
}
