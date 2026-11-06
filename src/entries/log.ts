import { ActivityEntry, TimelineLine, formatEntry, toTimelineLine } from "./format";

export type LogOutcome =
  | { ok: true; timeline: TimelineLine[] }
  | { ok: false; message: string };

function succeed(timeline: TimelineLine[]): LogOutcome {
  return { ok: true, timeline };
}

function fail(message: string): LogOutcome {
  return { ok: false, message };
}

/** Collapses whitespace so user input always stays on one line. */
function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
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
    const running = timeline[index].entry as ActivityEntry;
    if (now < running.start) {
      return fail("That time is earlier than the running activity's start.");
    }
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

  const running = timeline[index].entry as ActivityEntry;
  if (now < running.start) {
    return fail("That time is earlier than the running activity's start.");
  }
  return succeed(endAt(timeline, index, now));
}
