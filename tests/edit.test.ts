import { describe, expect, it } from "vitest";
import { type LineRef, editNoteText, editTimelineEntry as editEntry, isValidSpan, setChecklistItem } from "../src/entries/edit";

/** The time of day these tests run at, 10:30, so a running activity starts before it. */
const NOON_ISH = 10 * 60 + 30;

function editTimelineEntry(scope: string[], expected: LineRef, edit: { label: string; start: string; end: string }) {
  return editEntry(scope, expected, edit, NOON_ISH);
}

const scope = [
  "## Timeline",
  "- 09:00-10:15 Email #work",
  "- 09:40 note: idea for the proposal",
  "- 10:15- Proposal draft",
  "## Checklist",
  "- [ ] Walk",
  "- [x] Water",
];

// References to the lines as the page would have rendered them: exact text and position in section.
const EMAIL: LineRef = { raw: "- 09:00-10:15 Email #work", index: 0 };
const NOTE: LineRef = { raw: "- 09:40 note: idea for the proposal", index: 1 };
const WALK: LineRef = { raw: "- [ ] Walk", index: 0 };
const WATER: LineRef = { raw: "- [x] Water", index: 1 };

describe("editTimelineEntry", () => {
  it("changes the label and times of one entry and keeps the others", () => {
    const result = editTimelineEntry(scope, EMAIL, { label: "Inbox zero #work", start: "09:05", end: "10:00" });
    expect(result).toEqual({
      ok: true,
      lines: [
        "## Timeline",
        "- 09:05-10:00 Inbox zero #work",
        "- 09:40 note: idea for the proposal",
        "- 10:15- Proposal draft",
        "## Checklist",
        "- [ ] Walk",
        "- [x] Water",
      ],
    });
  });

  it("makes an activity running when the end time is blank and nothing else is running", () => {
    // Close the running "Proposal draft" first, so there is room for one running activity.
    const closed = [...scope.slice(0, 3), "- 10:15-11:00 Proposal draft", ...scope.slice(4)];
    const result = editTimelineEntry(closed, EMAIL, { label: "Email", start: "09:00", end: "" });
    expect(result.ok && result.lines[1]).toBe("- 09:00- Email");
  });

  it("refuses an edit when the line has changed since it was rendered", () => {
    const result = editTimelineEntry(scope, { raw: "- 08:00-08:30 Old line", index: 0 }, {
      label: "x",
      start: "09:00",
      end: "10:00",
    });
    expect(result.ok).toBe(false);
  });

  it("refuses an empty label and bad times", () => {
    expect(editTimelineEntry(scope, EMAIL, { label: " ", start: "09:00", end: "10:00" }).ok).toBe(false);
    expect(editTimelineEntry(scope, EMAIL, { label: "Email", start: "9am", end: "10:00" }).ok).toBe(false);
    expect(editTimelineEntry(scope, EMAIL, { label: "Email", start: "09:00", end: "later" }).ok).toBe(false);
  });

  it("refuses to make an activity running while another one is running", () => {
    // The shared scope already has "Proposal draft" running.
    const result = editTimelineEntry(scope, EMAIL, { label: "Email", start: "09:00", end: "" });
    expect(result.ok).toBe(false);
  });

  it("refuses an end time before the start, which would span the axis", () => {
    const result = editTimelineEntry(scope, EMAIL, { label: "Email", start: "15:00", end: "09:00" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("must end after it starts");
  });

  it("accepts an activity that runs past midnight", () => {
    const result = editTimelineEntry(scope, EMAIL, { label: "Late", start: "23:00", end: "01:00" });
    expect(result.ok && result.lines[1]).toBe("- 23:00-01:00 Late");
  });

  it("allows editing a line while the timeline already has two running activities", () => {
    // An older note with two running lines. Editing the label of one must still work.
    const twoRunning = ["## Timeline", "- 09:00- Email", "- 10:00- Draft"];
    const result = editTimelineEntry(twoRunning, { raw: "- 09:00- Email", index: 0 }, {
      label: "Mail",
      start: "09:00",
      end: "",
    });
    expect(result.ok && result.lines[1]).toBe("- 09:00- Mail");
  });

  it("lets the reader close one of two running activities", () => {
    const twoRunning = ["## Timeline", "- 09:00- Email", "- 10:00- Draft"];
    const result = editTimelineEntry(twoRunning, { raw: "- 10:00- Draft", index: 1 }, {
      label: "Draft",
      start: "10:00",
      end: "11:00",
    });
    expect(result.ok && result.lines[2]).toBe("- 10:00-11:00 Draft");
  });
});

describe("isValidSpan", () => {
  it("accepts spans up to twelve hours, including ones across midnight", () => {
    expect(isValidSpan(9 * 60, 10 * 60)).toBe(true);
    expect(isValidSpan(6 * 60, 18 * 60)).toBe(true); // exactly 12 hours
    expect(isValidSpan(23 * 60, 60)).toBe(true);
  });

  it("refuses zero-length spans and spans longer than twelve hours", () => {
    expect(isValidSpan(10 * 60, 10 * 60)).toBe(false);
    expect(isValidSpan(6 * 60, 19 * 60)).toBe(false); // 13 hours
    expect(isValidSpan(15 * 60, 9 * 60)).toBe(false); // 18 hours
  });
});

describe("editNoteText", () => {
  it("changes the text of a side note and keeps its time", () => {
    const result = editNoteText(scope, NOTE, "better idea");
    expect(result.ok && result.lines[2]).toBe("- 09:40 note: better idea");
  });

  it("refuses to edit a line that is not a side note", () => {
    expect(editNoteText(scope, EMAIL, "x").ok).toBe(false);
  });

  it("refuses an empty note", () => {
    expect(editNoteText(scope, NOTE, "   ").ok).toBe(false);
  });
});

describe("setChecklistItem", () => {
  it("ticks an open item", () => {
    const result = setChecklistItem(scope, WALK, true);
    expect(result.ok && result.lines[5]).toBe("- [x] Walk");
  });

  it("unticks a ticked item when a slot is free", () => {
    const result = setChecklistItem(scope, WATER, false);
    expect(result.ok && result.lines[6]).toBe("- [ ] Water");
  });

  it("refuses a line that is not in the checklist", () => {
    expect(setChecklistItem(scope, EMAIL, true).ok).toBe(false);
  });

  it("changes only the box that was clicked when two lines have the same text", () => {
    const duplicates = ["## Checklist", "- [ ] Walk", "- [ ] Walk"];
    const result = setChecklistItem(duplicates, { raw: "- [ ] Walk", index: 1 }, true);
    expect(result.ok && result.lines).toEqual(["## Checklist", "- [ ] Walk", "- [x] Walk"]);
  });

  it("refuses to untick a todo when the checklist already has five open ones", () => {
    const fiveOpenOneDone = ["## Checklist", "- [x] Done", "- [ ] One", "- [ ] Two", "- [ ] Three", "- [ ] Four", "- [ ] Five"];
    const result = setChecklistItem(fiveOpenOneDone, { raw: "- [x] Done", index: 0 }, false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("5 open todos");
  });

  it("allows unticking when a slot is free", () => {
    const fourOpenOneDone = ["## Checklist", "- [x] Done", "- [ ] One", "- [ ] Two", "- [ ] Three", "- [ ] Four"];
    const result = setChecklistItem(fourOpenOneDone, { raw: "- [x] Done", index: 0 }, false);
    expect(result.ok).toBe(true);
  });

  it("allows leaving an open todo open when the checklist is full", () => {
    const fiveOpen = ["## Checklist", "- [ ] One", "- [ ] Two", "- [ ] Three", "- [ ] Four", "- [ ] Five"];
    const result = setChecklistItem(fiveOpen, { raw: "- [ ] One", index: 0 }, false);
    expect(result.ok).toBe(true);
  });
});

describe("editTimelineEntry, running spans and kinds", () => {
  const timeline = ["## Timeline", "- 09:00- Email", "- 09:40 note: idea"];

  it("refuses to make a running activity start after the current time", () => {
    // The test runs at 10:30, so a running activity starting at 11:00 would be a future start.
    const result = editEntry(timeline, { raw: "- 09:00- Email", index: 0 }, { label: "Email", start: "11:00", end: "" }, NOON_ISH);
    expect(result.ok).toBe(false);
  });

  it("accepts a running activity that started earlier today", () => {
    const result = editEntry(timeline, { raw: "- 09:00- Email", index: 0 }, { label: "Email", start: "08:00", end: "" }, NOON_ISH);
    expect(result.ok).toBe(true);
  });

  // The hotkey starts an activity at the current minute. Editing it in that same minute (a new
  // label, or a start set to now) must work, because logActivity itself writes that line.
  it("accepts a running activity that starts this minute, as the hotkey creates it", () => {
    const justLogged = ["## Timeline", "- 10:30- Email"];
    const result = editEntry(justLogged, { raw: "- 10:30- Email", index: 0 }, { label: "Email #work", start: "10:30", end: "" }, NOON_ISH);
    expect(result).toEqual({ ok: true, lines: ["## Timeline", "- 10:30- Email #work"] });
  });

  it("moves the start of a running activity to this minute", () => {
    const result = editEntry(timeline, { raw: "- 09:00- Email", index: 0 }, { label: "Email", start: "10:30", end: "" }, NOON_ISH);
    expect(result.ok).toBe(true);
  });

  it("refuses to edit a side note as if it were an activity", () => {
    const result = editEntry(timeline, { raw: "- 09:40 note: idea", index: 2 }, { label: "Idea", start: "09:40", end: "10:00" }, NOON_ISH);
    expect(result).toEqual({ ok: false, message: expect.stringContaining("changed in the note") });
  });
});
