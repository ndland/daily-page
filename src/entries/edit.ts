import {
  CHECKLIST_HEADING,
  CHECKLIST_LIMIT,
  CHECKLIST_LINE,
  GREAT_THINGS_HEADING,
  GREAT_THINGS_LIMIT,
  findSection,
  formatEntry,
  readTimeline,
  RUNNING_CONFLICT,
  TimelineLine,
  toTimelineLine,
  validateTimeline,
  writeTimeline,
} from "./format";
import { MINUTES_PER_DAY, parseTime } from "../logic/time";

export type EditOutcome = { ok: true; lines: string[] } | { ok: false; message: string };

/** An edit to the lines of a note's page scope. `minute` is the current minute of the day. */
export type ScopeEdit = (scope: string[], minute: number) => EditOutcome;

/**
 * A line the reader clicked. `raw` is its exact text, and `index` its position within its
 * section. Both must still match, so a stale click cannot change a different line that
 * happens to have the same text.
 */
export interface LineRef {
  raw: string;
  index: number;
}

export const STALE = "That entry changed in the note. Reload the note and try again.";
const RUNNING_TWICE = "Only one activity can be running at a time.";
export const SPAN_RULE = "An activity must end after it starts, and last at most 12 hours.";
const RUNNING_SPAN_RULE = "A running activity must have started by now, within the last 12 hours.";
const MAX_ACTIVITY_MINUTES = 12 * 60;

function fail(message: string): EditOutcome {
  return { ok: false, message };
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Whether an activity from start to end is a valid span. It may cross midnight (23:00 to
 * 01:00 is fine), but it must last more than nothing and at most 12 hours. A longer span is
 * almost always a time typed for the wrong half of the day.
 */
export function isValidSpan(start: number, end: number): boolean {
  const length = (end - start + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return length > 0 && length <= MAX_ACTIVITY_MINUTES;
}

/** Number of "more than one running activity" problems in a timeline. */
function runningConflicts(timeline: TimelineLine[]): number {
  return validateTimeline(timeline).filter((issue) => issue.message === RUNNING_CONFLICT).length;
}

export interface TimelineEdit {
  label: string;
  /** "HH:MM". */
  start: string;
  /** "HH:MM", or blank to make the activity running. */
  end: string;
}

/**
 * Changes an activity's label and times. `expected` must still match the line as it was
 * rendered, so a stale click cannot overwrite a newer edit.
 */
export function editTimelineEntry(
  scope: string[],
  expected: LineRef,
  edit: TimelineEdit,
  minute: number,
): EditOutcome {
  const timeline = readTimeline(scope);
  const current = timeline[expected.index];
  if (current?.raw !== expected.raw || current.entry?.kind !== "activity") return fail(STALE);

  const label = cleanText(edit.label);
  if (!label) return fail("Enter a label for the activity.");

  const start = parseTime(edit.start.trim());
  if (start === null) return fail("Start time must be HH:MM.");

  let end: number | null = null;
  if (edit.end.trim() !== "") {
    end = parseTime(edit.end.trim());
    if (end === null) return fail("End time must be HH:MM, or blank for a running activity.");
    if (!isValidSpan(start, end)) return fail(SPAN_RULE);
  } else if (start !== minute && !isValidSpan(start, minute)) {
    // A running activity runs up to now, so its start must be within the last 12 hours. A start
    // in the future would draw a block nearly a whole day tall. A start of exactly now is fine:
    // it is what the hotkey writes, so it must stay editable in the minute it was logged.
    return fail(RUNNING_SPAN_RULE);
  }

  const next = timeline.map((line, i) =>
    i === expected.index ? toTimelineLine(formatEntry({ kind: "activity", start, end, label })) : line,
  );

  // Refuse only when this edit adds a second running activity. A timeline that already has
  // one must still be editable, so the reader can repair it.
  if (runningConflicts(next) > runningConflicts(timeline)) return fail(RUNNING_TWICE);

  return { ok: true, lines: writeTimeline(scope, next) };
}

/** Changes the text of a side note, keeping its time. */
export function editNoteText(scope: string[], expected: LineRef, text: string): EditOutcome {
  const timeline = readTimeline(scope);
  if (timeline[expected.index]?.raw !== expected.raw) return fail(STALE);

  const note = cleanText(text);
  if (!note) return fail("Enter text for the side note.");

  const current = timeline[expected.index].entry;
  if (!current || current.kind !== "note") return fail(STALE);

  const next = timeline.map((line, i) =>
    i === expected.index ? toTimelineLine(formatEntry({ kind: "note", time: current.time, text: note })) : line,
  );
  return { ok: true, lines: writeTimeline(scope, next) };
}

/** The checklist's open todos, as lines of its section. */
function openTodoCount(sectionLines: string[]): number {
  return sectionLines.filter((line) => {
    const match = CHECKLIST_LINE.exec(line);
    return match !== null && match[1] === " ";
  }).length;
}

function limitReached(): EditOutcome {
  return fail(`The checklist already has ${CHECKLIST_LIMIT} open todos. Finish or remove one first.`);
}

/**
 * Ticks or unticks a checklist item. Unticking makes it open again, so it is refused when the
 * checklist already holds the open-todo limit, just as adding one would be.
 */
export function setChecklistItem(scope: string[], expected: LineRef, checked: boolean): EditOutcome {
  const section = findSection(scope, CHECKLIST_HEADING);
  if (!section) return fail(STALE);

  const body = scope.slice(section.start, section.end);
  const match = CHECKLIST_LINE.exec(expected.raw);
  if (!match) return fail(STALE);
  const ticked = `- [${checked ? "x" : " "}] ${match[2]}`;

  // A repeat of a tick that already happened (a double click, say) changes nothing. It is not an
  // error, because the todo is already in the state the reader asked for.
  if (body[expected.index] === ticked) return { ok: true, lines: scope };
  if (body[expected.index] !== expected.raw) return fail(STALE);

  const wasChecked = match[1].toLowerCase() === "x";
  if (wasChecked && !checked && openTodoCount(body) >= CHECKLIST_LIMIT) return limitReached();

  const lineIndex = section.start + expected.index;
  return { ok: true, lines: scope.map((line, i) => (i === lineIndex ? ticked : line)) };
}

/**
 * Adds an open todo at the end of the Checklist section, creating the section if the block
 * does not have one yet. The limit applies to open todos only, so finished ones make room.
 */
export function appendChecklistItem(scope: string[], text: string): EditOutcome {
  const label = cleanText(text);
  if (!label) return fail("Enter the todo's text.");

  const line = `- [ ] ${label}`;
  const section = findSection(scope, CHECKLIST_HEADING);
  if (!section) {
    return { ok: true, lines: [...scope, CHECKLIST_HEADING, line] };
  }

  if (openTodoCount(scope.slice(section.start, section.end)) >= CHECKLIST_LIMIT) return limitReached();

  return { ok: true, lines: insertAfterContent(scope, section, line) };
}

/** Inserts a line after the last non-blank line of a section, or straight after its heading. */
function insertAfterContent(scope: string[], section: { start: number; end: number }, line: string): string[] {
  let insertAt = section.start;
  for (let i = section.start; i < section.end; i++) {
    if (scope[i].trim() !== "") insertAt = i + 1;
  }
  return [...scope.slice(0, insertAt), line, ...scope.slice(insertAt)];
}

/**
 * Changes one bullet of the Three things box. `expected` must still match the line as it was
 * rendered. Blank text removes the bullet.
 */
export function editGreatThing(scope: string[], expected: LineRef, text: string): EditOutcome {
  const section = findSection(scope, GREAT_THINGS_HEADING);
  if (!section) return fail(STALE);

  const body = scope.slice(section.start, section.end);
  if (body[expected.index] !== expected.raw) return fail(STALE);

  const lineIndex = section.start + expected.index;
  const label = cleanText(text);
  if (!label) return { ok: true, lines: scope.filter((_, i) => i !== lineIndex) };
  return { ok: true, lines: scope.map((line, i) => (i === lineIndex ? `- ${label}` : line)) };
}

/** Number of bullets in the Three things box that have text. Blank bullets do not count. */
function filledBulletCount(body: string[]): number {
  return body.filter((line) => (/^- (.*)$/.exec(line)?.[1]?.trim() ?? "") !== "").length;
}

/**
 * Adds a bullet to the Three things box, creating the section if the block does not have one.
 * The box shows three, so a fourth is refused until one is removed or edited in the note.
 */
export function appendGreatThing(scope: string[], text: string): EditOutcome {
  const label = cleanText(text);
  if (!label) return fail("Enter the thing to add.");

  const line = `- ${label}`;
  const section = findSection(scope, GREAT_THINGS_HEADING);
  if (!section) {
    return { ok: true, lines: [...scope, GREAT_THINGS_HEADING, line] };
  }

  if (filledBulletCount(scope.slice(section.start, section.end)) >= GREAT_THINGS_LIMIT) {
    return fail(`The Three things box already has ${GREAT_THINGS_LIMIT}. Edit or remove one in the note first.`);
  }
  return { ok: true, lines: insertAfterContent(scope, section, line) };
}
