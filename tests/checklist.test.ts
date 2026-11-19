import { describe, expect, it } from "vitest";
import { readChecklist } from "../src/render/checklist";

describe("readChecklist", () => {
  it("reads open, checked, and cancelled items from the Checklist section", () => {
    const note = [
      "## Timeline",
      "- 09:00- Email",
      "",
      "## Checklist",
      "- [ ] Walk",
      "- [x] Water",
      "- [X] Stretch",
      "- [-] Skip the errand",
    ];
    expect(readChecklist(note)).toEqual([
      { text: "Walk", status: "open", raw: "- [ ] Walk", index: 0 },
      { text: "Water", status: "done", raw: "- [x] Water", index: 1 },
      { text: "Stretch", status: "done", raw: "- [X] Stretch", index: 2 },
      { text: "Skip the errand", status: "cancelled", raw: "- [-] Skip the errand", index: 3 },
    ]);
  });

  it("ignores lines that are not checklist tasks, and numbers items by their line in the section", () => {
    const note = ["## Checklist", "- Not a task", "- [ ] Real task", "plain text"];
    expect(readChecklist(note)).toEqual([{ text: "Real task", status: "open", raw: "- [ ] Real task", index: 1 }]);
  });

  it("returns no items when the section is missing", () => {
    expect(readChecklist(["## Timeline", "- [ ] not in this section"])).toEqual([]);
  });
});
