import { DAY_END_MINUTE } from "../logic/time";
import { STALE, setChecklistStatus, type EditOutcome, type LineRef } from "./edit";
import {
  CHECKLIST_HEADING, CHECKLIST_LINE, CHECKLIST_MARKERS, findSection,
  readTaskLink, readTimeline, writeTaskLink, writeTimeline, type TaskStatus, type TimelineLine,
} from "./format";
import { endRunning, logActivity } from "./log";

export function runningTaskIds(timeline: TimelineLine[]): Set<string> {
  return new Set(timeline.flatMap(({ entry }) =>
    entry?.kind === "activity" && entry.end === null && entry.taskId ? [entry.taskId] : [],
  ));
}

/** Apply the checklist status and any matching timer change in a single note edit. */
export function changeChecklistStatus(
  scope: string[],
  expected: LineRef,
  status: TaskStatus,
  minute: number,
  isToday = true,
): EditOutcome {
  const match = CHECKLIST_LINE.exec(expected.raw);
  if (!match) return { ok: false, message: STALE };
  const { text, taskId } = readTaskLink(match[2]);
  const timeline = readTimeline(scope);
  const running = taskId !== undefined && runningTaskIds(timeline).has(taskId);

  if (status !== "in-progress") {
    const updated = setChecklistStatus(scope, expected, status);
    if (!updated.ok || !running) return updated;
    const ended = endRunning(timeline, isToday ? minute : DAY_END_MINUTE, taskId);
    return ended.ok ? { ok: true, lines: writeTimeline(updated.lines, ended.timeline) } : ended;
  }

  if (!isToday) return { ok: false, message: "Start task timers on today's page." };
  const section = findSection(scope, CHECKLIST_HEADING);
  const index = section ? section.start + expected.index : -1;
  if (!section || index < section.start || index >= section.end ||
      scope[index] !== expected.raw || match[1] !== CHECKLIST_MARKERS.open) {
    return { ok: false, message: STALE };
  }
  if (running) return { ok: true, lines: scope };

  const id = taskId ?? nextTaskId(scope.slice(section.start, section.end), timeline);
  const started = logActivity(timeline, text, minute, id);
  if (!started.ok) return started;
  const linked = taskId ? scope : scope.map((line, i) => (i === index ? writeTaskLink(line, id) : line));
  return { ok: true, lines: writeTimeline(linked, started.timeline) };
}

function nextTaskId(checklist: string[], timeline: TimelineLine[]): string {
  const used = new Set(checklist.map((line) => readTaskLink(line).taskId));
  for (const { entry } of timeline) {
    if (entry?.kind === "activity") used.add(entry.taskId);
  }
  let id = 1;
  while (used.has(String(id))) id++;
  return String(id);
}
