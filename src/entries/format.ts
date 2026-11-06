import { formatTime, parseTime } from "../logic/time";

/** An activity that took time. `end` is null while it is still running. */
export interface ActivityEntry {
  kind: "activity";
  start: number;
  end: number | null;
  label: string;
}

/** An instant side note. It never changes an activity's end time. */
export interface NoteEntry {
  kind: "note";
  time: number;
  text: string;
}

export type Entry = ActivityEntry | NoteEntry;

/**
 * One line of the Timeline section. `raw` is always the text as written in the note.
 * `entry` is null when the line is not a valid entry; such lines are kept untouched.
 */
export interface TimelineLine {
  raw: string;
  entry: Entry | null;
}

export interface TimelineIssue {
  index: number;
  message: string;
}

const TIMELINE_HEADING = "## Timeline";
const SECTION_HEADING = /^## /;

const ACTIVITY_CLOSED = /^- (\d{2}:\d{2})-(\d{2}:\d{2}) (.+)$/;
const ACTIVITY_RUNNING = /^- (\d{2}:\d{2})- (.+)$/;
const NOTE = /^- (\d{2}:\d{2}) note: (.+)$/;

/** Parses one line. Returns null for anything that is not a valid entry. */
export function parseEntry(raw: string): Entry | null {
  const closed = ACTIVITY_CLOSED.exec(raw);
  if (closed) {
    const start = parseTime(closed[1]);
    const end = parseTime(closed[2]);
    if (start === null || end === null) return null;
    return { kind: "activity", start, end, label: closed[3] };
  }

  const running = ACTIVITY_RUNNING.exec(raw);
  if (running) {
    const start = parseTime(running[1]);
    if (start === null) return null;
    return { kind: "activity", start, end: null, label: running[2] };
  }

  const note = NOTE.exec(raw);
  if (note) {
    const time = parseTime(note[1]);
    if (time === null) return null;
    return { kind: "note", time, text: note[2] };
  }

  return null;
}

/** Writes an entry in the canonical line format. */
export function formatEntry(entry: Entry): string {
  if (entry.kind === "note") {
    return `- ${formatTime(entry.time)} note: ${entry.text}`;
  }
  if (entry.end === null) {
    return `- ${formatTime(entry.start)}- ${entry.label}`;
  }
  return `- ${formatTime(entry.start)}-${formatTime(entry.end)} ${entry.label}`;
}

export function toTimelineLine(raw: string): TimelineLine {
  return { raw, entry: parseEntry(raw) };
}

/** Returns the line indexes [start, end) of the section under `heading`, or null if it is missing. */
export function findSection(lines: string[], heading: string): { start: number; end: number } | null {
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex === -1) return null;
  let end = headingIndex + 1;
  while (end < lines.length && !SECTION_HEADING.test(lines[end])) end++;
  return { start: headingIndex + 1, end };
}

export function findTimelineSection(lines: string[]): { start: number; end: number } | null {
  return findSection(lines, TIMELINE_HEADING);
}

/** Reads the Timeline section of a note. A missing section reads as an empty timeline. */
export function readTimeline(noteLines: string[]): TimelineLine[] {
  const section = findTimelineSection(noteLines);
  if (!section) return [];
  return noteLines.slice(section.start, section.end).map(toTimelineLine);
}

/**
 * Returns the note's lines with the Timeline section replaced. Everything outside the
 * section is untouched. If the note has no Timeline section, one is appended at the end.
 */
export function writeTimeline(noteLines: string[], timeline: TimelineLine[]): string[] {
  const body = timeline.map((line) => line.raw);
  const section = findTimelineSection(noteLines);
  if (section) {
    return [
      ...noteLines.slice(0, section.start),
      ...body,
      ...noteLines.slice(section.end),
    ];
  }
  const trimmed = noteLines.length > 0 && noteLines[noteLines.length - 1] === "" ? noteLines : [...noteLines, ""];
  return [...trimmed, TIMELINE_HEADING, ...body];
}

/** Problems a user should see. Malformed lines are kept as written, never deleted. */
export function validateTimeline(timeline: TimelineLine[]): TimelineIssue[] {
  const issues: TimelineIssue[] = [];
  let runningSeen = false;

  timeline.forEach((line, index) => {
    if (line.entry === null && line.raw.startsWith("- ")) {
      issues.push({ index, message: "Unrecognised entry; kept as written" });
    }
    if (line.entry?.kind === "activity" && line.entry.end === null) {
      if (runningSeen) {
        issues.push({ index, message: "More than one running activity" });
      }
      runningSeen = true;
    }
  });

  return issues;
}
