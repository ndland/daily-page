// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderChecklist, readChecklist } from "../src/render/checklist";

const openFive = ["## Checklist", ...Array.from({ length: 5 }, (_, i) => `- [ ] Task ${i + 1}`)];

function rowTexts(parent: HTMLElement): string[] {
  return [...parent.querySelectorAll(".daily-page__checklist li:not(.daily-page__checklist-blank)")].map((li) => li.textContent ?? "");
}

describe("checklist display", () => {
  it("shows all five open todos", () => {
    const parent = document.createElement("div");
    renderChecklist(parent, readChecklist(openFive));
    expect(rowTexts(parent)).toEqual(["Task 1", "Task 2", "Task 3", "Task 4", "Task 5"]);
  });

  it("leaves finished todos out of the rows, so they do not take up open-todo space", () => {
    const note = ["## Checklist", "- [x] Done A", "- [x] Done B", "- [ ] Open C", "- [ ] Open D"];
    const parent = document.createElement("div");
    renderChecklist(parent, readChecklist(note));
    expect(rowTexts(parent)).toEqual(["Open C", "Open D"]);
  });

  it("shows all five open todos even when the note also has finished ones", () => {
    const note = [
      "## Checklist",
      "- [ ] Walk",
      "- [ ] Water",
      "- [x] Read ten pages",
      "- [x] Nice",
      "- [ ] two",
      "- [ ] three",
      "- [ ] four",
    ];
    const parent = document.createElement("div");
    renderChecklist(parent, readChecklist(note));
    expect(rowTexts(parent)).toEqual(["Walk", "Water", "two", "three", "four"]);
  });

  it("never shows more than five rows", () => {
    const note = ["## Checklist", ...Array.from({ length: 7 }, (_, i) => `- [ ] Task ${i + 1}`)];
    const parent = document.createElement("div");
    renderChecklist(parent, readChecklist(note));
    expect(rowTexts(parent)).toHaveLength(5);
  });

  it("says how many open todos are not shown, rather than hiding them silently", () => {
    const seven = ["## Checklist", ...Array.from({ length: 7 }, (_, i) => `- [ ] Task ${i + 1}`)];
    const parent = document.createElement("div");
    renderChecklist(parent, readChecklist(seven));
    const rows = rowTexts(parent);
    expect(rows).toEqual(["Task 1", "Task 2", "Task 3", "Task 4", "+3 more"]);
  });

  it("does not count finished todos in the +N more row", () => {
    const note = [
      "## Checklist",
      ...Array.from({ length: 7 }, (_, i) => `- [ ] Task ${i + 1}`),
      ...Array.from({ length: 5 }, (_, i) => `- [x] Done ${i + 1}`),
    ];
    const parent = document.createElement("div");
    renderChecklist(parent, readChecklist(note));
    expect(rowTexts(parent)).toEqual(["Task 1", "Task 2", "Task 3", "Task 4", "+3 more"]);
  });
});

describe("open-todo overflow", () => {
  it("shows four rows and '+2 more' when six todos are open, counting only open ones", () => {
    const six = ["## Checklist", ...Array.from({ length: 6 }, (_, i) => `- [ ] Task ${i + 1}`)];
    const parent = document.createElement("div");
    renderChecklist(parent, readChecklist(six));
    expect(rowTexts(parent)).toEqual(["Task 1", "Task 2", "Task 3", "Task 4", "+2 more"]);
  });
});
