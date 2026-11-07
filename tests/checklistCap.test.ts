import { describe, expect, it } from "vitest";
import { appendChecklistItem, setChecklistItem } from "../src/entries/edit";

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
