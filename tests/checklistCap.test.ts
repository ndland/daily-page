import { describe, expect, it } from "vitest";
import { STALE, appendChecklistItem, setChecklistItem, setChecklistStatus } from "../src/entries/edit";

describe("checklist cap", () => {
  it("refuses to untick a finished todo into a sixth open one", () => {
    // Five open, one finished: unticking the finished todo would make six open.
    const full = ["## Checklist", "- [x] Done", "- [ ] One", "- [ ] Two", "- [ ] Three", "- [ ] Four", "- [ ] Five"];
    const result = setChecklistItem(full, { raw: "- [x] Done", index: 0 }, false);
    expect(result.ok).toBe(false);
  });

  it("refuses a sixth open todo and leaves the checklist unchanged", () => {
    const fiveOpen = ["## Checklist", "- [ ] One", "- [ ] Two", "- [ ] Three", "- [ ] Four", "- [ ] Five"];
    const result = appendChecklistItem(fiveOpen, "Six");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("5 open todos");
  });

  it("allows a new todo when finished ones fill the rest of the list", () => {
    const fourOpenOneDone = ["## Checklist", "- [x] Done", "- [ ] One", "- [ ] Two", "- [ ] Three", "- [ ] Four"];
    expect(appendChecklistItem(fourOpenOneDone, "Five").ok).toBe(true);
  });

  it("allows a new todo when five are finished and none are open", () => {
    const fiveDone = ["## Checklist", "- [x] One", "- [x] Two", "- [x] Three", "- [x] Four", "- [x] Five"];
    const result = appendChecklistItem(fiveDone, "Six");
    expect(result.ok && result.lines[result.lines.length - 1]).toBe("- [ ] Six");
  });

  it("counts only todo lines, not other text in the section", () => {
    const withNotes = ["## Checklist", "Some note", "- [ ] One", "- [ ] Two", "- [ ] Three", "- [ ] Four"];
    expect(appendChecklistItem(withNotes, "Five").ok).toBe(true);
  });
});

describe("stale checklist clicks", () => {
  it("refuses a tick aimed at a line that has moved after a todo was added above it", () => {
    const before = ["## Checklist", "- [ ] Walk", "- [ ] Water"];
    // A new todo is inserted above Walk, so the old index now points at the new line.
    const after = ["## Checklist", "- [ ] Read", "- [ ] Walk", "- [ ] Water"];
    const result = setChecklistItem(after, { raw: "- [ ] Walk", index: 0 }, true);
    expect(before[1]).toBe("- [ ] Walk");
    expect(result.ok).toBe(false);
  });
});

describe("cancelled todos", () => {
  it("changes only the marker of the selected duplicate and can reopen it", () => {
    const raw = "- [ ] Call *Mum*  ";
    const scope = ["## Checklist", raw, "Keep this line", raw, "## Three things", "- Read"];
    const expected = { raw, index: 2 };
    const cancelled = setChecklistStatus(scope, expected, "cancelled");
    const cancelledRaw = "- [-] Call *Mum*  ";
    if (!cancelled.ok) throw new Error(cancelled.message);
    expect(cancelled.lines).toEqual(["## Checklist", raw, "Keep this line", cancelledRaw, "## Three things", "- Read"]);
    expect(setChecklistStatus(cancelled.lines, expected, "cancelled")).toEqual(cancelled);
    expect(setChecklistStatus(cancelled.lines, { raw: cancelledRaw, index: 2 }, "open")).toEqual({ ok: true, lines: scope });
  });

  it("refuses to cancel a task that was edited or completed since rendering", () => {
    const expected = { raw: "- [ ] Walk", index: 0 };
    for (const line of ["- [ ] Run", "- [x] Walk"]) {
      expect(setChecklistStatus(["## Checklist", line], expected, "cancelled")).toEqual({ ok: false, message: STALE });
    }
  });

  it("frees a slot at the limit and keeps the task cancelled if its slot was filled", () => {
    const scope = ["## Checklist", ...["One", "Two", "Three", "Four", "Five"].map((name) => `- [ ] ${name}`)];
    const cancelled = setChecklistStatus(scope, { raw: "- [ ] One", index: 0 }, "cancelled");
    if (!cancelled.ok) throw new Error(cancelled.message);
    const added = appendChecklistItem(cancelled.lines, "Six");
    if (!added.ok) throw new Error(added.message);
    const reopened = setChecklistStatus(added.lines, { raw: "- [-] One", index: 0 }, "open");
    expect(reopened).toEqual({ ok: false, message: expect.stringContaining("5 open todos") });
    expect(added.lines[1]).toBe("- [-] One");
  });
});
