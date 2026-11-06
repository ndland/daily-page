import { describe, expect, it } from "vitest";
import { readChecklist } from "../src/render/checklist";

describe("readChecklist", () => {
  it("reads open and checked items from the Checklist section", () => {
    const note = [
      "## Timeline",
      "- 09:00- Email",
      "",
      "## Checklist",
      "- [ ] Walk",
      "- [x] Water",
      "- [X] Stretch",
    ];
    expect(readChecklist(note)).toEqual([
      { text: "Walk", checked: false },
      { text: "Water", checked: true },
      { text: "Stretch", checked: true },
    ]);
  });

  it("ignores lines that are not checklist tasks", () => {
    const note = ["## Checklist", "- Not a task", "- [ ] Real task", "plain text"];
    expect(readChecklist(note)).toEqual([{ text: "Real task", checked: false }]);
  });

  it("returns no items when the section is missing", () => {
    expect(readChecklist(["## Timeline", "- [ ] not in this section"])).toEqual([]);
  });
});
