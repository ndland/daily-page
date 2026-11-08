import { ActivityEntry, TimelineLine, formatEntry, readTimeline, toTimelineLine, writeTimeline } from "./format";
import { EditOutcome, LineRef, STALE, SPAN_RULE, TimelineEdit, cleanText, isValidSpan } from "./edit";
import { parseTime } from "../logic/time";

export type LogOutcome =
  | { ok: true; timeline: TimelineLine[] }
  | { ok: false; message: string };

function succeed(timeline: TimelineLine[]): LogOutcome {
  return { ok: true, timeline };
}

/** A refusal. Its shape is shared by LogOutcome and EditOutcome, so either can return it. */
function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

function runningIndex(timeline: TimelineLine[]): number {
  return timeline.findIndex(
    (line) => line.entry?.kind === "activity" && line.entry.end === null,
  );
}

/**
 * Appends a new entry after the last entry line. Blank spacer lines at the end of the
 * section stay below the new entry.
 */
function appendEntry(timeline: TimelineLine[], line: TimelineLine): TimelineLine[] {
  let last = -1;
  timeline.forEach((existing, index) => {
    if (existing.raw.trim() !== "") last = index;
  });
  return [...timeline.slice(0, last + 1), line, ...timeline.slice(last + 1)];
}

/**
 * Why a running activity cannot end at `now`, or null when it can. It must end after it started and
 * last at most 12 hours, the same rule the editor applies, so a logged line is always one the
 * editor accepts. A same-minute log has nothing to end, so it gets its own message.
 */
function endProblem(running: ActivityEntry, now: number): string | null {
  if (now === running.start) return "The running activity started this minute. Log the next one a minute later.";
  // A span that crosses midnight is valid, so an activity from 23:30 can end at 00:10.
  if (isValidSpan(running.start, now)) return null;
  if (now < running.start) return "That time is earlier than the running activity's start.";
  return SPAN_RULE;
}

/** Returns a copy of the timeline with the running activity at `index` ended at `now`. */
function endAt(timeline: TimelineLine[], index: number, now: number): TimelineLine[] {
  const running = timeline[index].entry as ActivityEntry;
  const closed = formatEntry({ ...running, end: now });
  return timeline.map((line, i) => (i === index ? toTimelineLine(closed) : line));
}

/**
 * Starts a new activity. Any running activity ends at `now`.
 * Never mutates the input, so the caller can keep the previous timeline for undo.
 */
export function logActivity(timeline: TimelineLine[], label: string, now: number): LogOutcome {
  const text = cleanText(label);
  if (!text) return fail("Enter a label for the activity.");

  let next = timeline;
  const index = runningIndex(timeline);
  if (index !== -1) {
    const problem = endProblem(timeline[index].entry as ActivityEntry, now);
    if (problem) return fail(problem);
    next = endAt(timeline, index, now);
  }

  const started = formatEntry({ kind: "activity", start: now, end: null, label: text });
  return succeed(appendEntry(next, toTimelineLine(started)));
}

/** Adds an instant side note. No activity's end time changes. */
export function logNote(timeline: TimelineLine[], text: string, now: number): LogOutcome {
  const note = cleanText(text);
  if (!note) return fail("Enter text for the side note.");

  const noted = formatEntry({ kind: "note", time: now, text: note });
  return succeed(appendEntry(timeline, toTimelineLine(noted)));
}

/** Ends the running activity at `now` without starting another. */
export function endRunning(timeline: TimelineLine[], now: number): LogOutcome {
  const index = runningIndex(timeline);
  if (index === -1) return fail("Nothing is running.");

  const problem = endProblem(timeline[index].entry as ActivityEntry, now);
  if (problem) return fail(problem);
  return succeed(endAt(timeline, index, now));
}

/**
 * Plans a block: adds a closed activity for a span the reader already knows they will fill. It is
 * an ordinary closed entry, so it may overlap other entries or lie in the past, and it never counts
 * as the running activity.
 */
export function planBlock(scope: string[], edit: TimelineEdit): EditOutcome {
  const label = cleanText(edit.label);
  if (!label) return fail("Enter a label for the block.");

  const start = parseTime(edit.start.trim());
  if (start === null) return fail("Start time must be HH:MM.");
  const end = parseTime(edit.end.trim());
  if (end === null) return fail("End time must be HH:MM.");
  if (!isValidSpan(start, end)) return fail(SPAN_RULE);

  const line = toTimelineLine(formatEntry({ kind: "activity", start, end, label }));
  return { ok: true, lines: writeTimeline(scope, appendEntry(readTimeline(scope), line)) };
}

/**
 * Starts a planned (closed) block now: it becomes the running activity, starting at `now`, with `label` when one
 * is given. Any other running activity ends at `now` first, so only one runs at a time.
 */
export function startPlannedBlock(scope: string[], expected: LineRef, now: number, label?: string): EditOutcome {
  const timeline = readTimeline(scope);
  const current = timeline[expected.index];
  if (current?.raw !== expected.raw || current.entry?.kind !== "activity") return fail(STALE);
  if (current.entry.end === null) return fail("That activity is already running.");

  let next = timeline;
  const running = runningIndex(timeline);
  if (running !== -1) {
    const problem = endProblem(timeline[running].entry as ActivityEntry, now);
    if (problem) return fail(problem);
    next = endAt(timeline, running, now);
  }

  // A label the reader changed in the dialog before pressing Start now is kept. A blank one keeps the old label.
  const newLabel = label === undefined ? "" : cleanText(label);
  const started = toTimelineLine(
    formatEntry({ ...current.entry, start: now, end: null, label: newLabel || current.entry.label }),
  );
  return { ok: true, lines: writeTimeline(scope, next.map((line, i) => (i === expected.index ? started : line))) };
}
