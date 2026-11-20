import { describe, expect, it } from "vitest";
import { changeChecklistStatus } from "../src/entries/checklist";
import { editTimelineEntry, STALE } from "../src/entries/edit";
import { readTimeline, writeTimeline } from "../src/entries/format";
import { endRunning, logActivity } from "../src/entries/log";
import { readChecklist } from "../src/render/checklist";

const note = ["## Timeline", "", "## Checklist", "- [ ] Write **notes** #work", "- [ ] Write **notes** #work"];
const at = (hour: number, minute = 0): number => hour * 60 + minute;

function lines(outcome: ReturnType<typeof changeChecklistStatus>): string[] {
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.lines;
}

describe("checklist timing", () => {
  it("starts and completes exactly the selected task and its timeline block", () => {
    const started = lines(changeChecklistStatus(note, readChecklist(note)[1], "in-progress", at(9)));
    expect(readChecklist(started).map((task) => [task.text, task.status])).toEqual([
      ["Write **notes** #work", "open"],
      ["Write **notes** #work", "in-progress"],
    ]);
    expect(readTimeline(started)[0].entry).toMatchObject({ start: at(9), end: null, label: "Write **notes** #work" });

    const finished = lines(changeChecklistStatus(started, readChecklist(started)[1], "done", at(9, 20)));
    expect(readTimeline(finished)[0].entry).toMatchObject({ start: at(9), end: at(9, 20), label: "Write **notes** #work" });
    expect(readChecklist(finished).map((task) => task.status)).toEqual(["open", "done"]);
  });

  it("keeps the association when the running block's label is edited", () => {
    const started = lines(changeChecklistStatus(note, readChecklist(note)[0], "in-progress", at(9)));
    const running = { raw: readTimeline(started)[0].raw, index: 0 };
    const renamed = lines(editTimelineEntry(started, running, { label: "New label", start: "09:00", end: "" }, at(9, 10)));
    const cancelled = lines(changeChecklistStatus(renamed, readChecklist(renamed)[0], "cancelled", at(9, 20)));
    expect(readTimeline(cancelled)[0].entry).toMatchObject({ end: at(9, 20), label: "New label" });
    expect(readChecklist(cancelled)[0].status).toBe("cancelled");
  });

  it("returns a stopped task to To do when the timeline timer is ended separately", () => {
    const started = lines(changeChecklistStatus(note, readChecklist(note)[0], "in-progress", at(9)));
    const ended = endRunning(readTimeline(started), at(9, 15));
    if (!ended.ok) throw new Error(ended.message);
    expect(readChecklist(writeTimeline(started, ended.timeline))[0].status).toBe("open");
  });

  it("leaves a different running activity alone when directly completing a task", () => {
    const started = logActivity(readTimeline(note), "Write **notes** #work", at(9));
    if (!started.ok) throw new Error(started.message);
    const other = writeTimeline(note, started.timeline);
    const finished = lines(changeChecklistStatus(other, readChecklist(other)[0], "done", at(9, 20)));
    expect(readTimeline(finished)).toEqual(started.timeline);
  });

  it("runs tasks in parallel with each other and the regular activity", () => {
    const other = ["## Timeline", "- 08:30- Planning", ...note.slice(2)];
    const first = lines(changeChecklistStatus(other, readChecklist(other)[0], "in-progress", at(9)));
    const both = lines(changeChecklistStatus(first, readChecklist(first)[1], "in-progress", at(9)));
    expect(readChecklist(both).map((task) => task.status)).toEqual(["in-progress", "in-progress"]);
    expect(readTimeline(both).filter(({ entry }) => entry?.kind === "activity" && entry.end === null)).toHaveLength(3);

    const next = logActivity(readTimeline(both), "New regular activity", at(9, 5));
    if (!next.ok) throw new Error(next.message);
    const switched = writeTimeline(both, next.timeline);
    const finished = lines(changeChecklistStatus(switched, readChecklist(switched)[1], "done", at(9, 10)));
    expect(readChecklist(finished).map((task) => task.status)).toEqual(["in-progress", "done"]);
    expect(readTimeline(finished).map(({ entry }) => entry?.kind === "activity" && entry.end))
      .toEqual([at(9, 5), null, at(9, 10), null]);
  });

  it("can complete a task in the same minute it started", () => {
    const started = lines(changeChecklistStatus(note, readChecklist(note)[0], "in-progress", at(9)));
    const finished = lines(changeChecklistStatus(started, readChecklist(started)[0], "done", at(9)));
    expect(readTimeline(finished)[0].entry).toMatchObject({ start: at(9), end: at(9) });
    expect(readChecklist(finished)[0].status).toBe("done");
  });

  it("refuses a stale start and leaves both sections untouched when timing fails", () => {
    const task = readChecklist(note)[0];
    expect(changeChecklistStatus(note, { ...task, raw: "- [ ] Moved" }, "in-progress", at(9)))
      .toEqual({ ok: false, message: STALE });
    const started = lines(changeChecklistStatus(note, task, "in-progress", at(9)));
    const result = changeChecklistStatus(started, readChecklist(started)[0], "done", at(22));
    expect(result.ok).toBe(false);
    expect(readChecklist(started)[0].status).toBe("in-progress");
  });
});
