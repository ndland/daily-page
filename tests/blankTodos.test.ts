// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { CHECKLIST_LIMIT } from "../src/entries/format";
import { readChecklist, renderChecklist } from "../src/render/checklist";

function draw(note: string[], onAdd?: () => void): HTMLElement {
  const parent = document.createElement("div");
  renderChecklist(parent, readChecklist(note), undefined, onAdd);
  return parent;
}

const rows = (parent: HTMLElement) => parent.querySelectorAll(".daily-page__checklist li");
const blanks = (parent: HTMLElement) => parent.querySelectorAll(".daily-page__checklist-blank");

describe("the todo list's empty boxes", () => {
  it("shows a full set of empty boxes when there are no todos, as the Hobonichi page does", () => {
    const parent = draw(["## Checklist"]);
    expect(rows(parent)).toHaveLength(CHECKLIST_LIMIT);
    expect(blanks(parent)).toHaveLength(CHECKLIST_LIMIT);
  });

  it("fills a box for each open todo and leaves the rest empty", () => {
    const parent = draw(["## Checklist", "- [ ] Walk", "- [ ] Call Mum"]);
    expect(rows(parent)).toHaveLength(CHECKLIST_LIMIT);
    expect(blanks(parent)).toHaveLength(CHECKLIST_LIMIT - 2);
  });

  it("does not count finished todos, since they move to the Done line", () => {
    const parent = draw(["## Checklist", "- [x] Walk", "- [ ] Call Mum"]);
    expect(blanks(parent)).toHaveLength(CHECKLIST_LIMIT - 1);
  });

  it("has no empty box when the list is full", () => {
    const note = ["## Checklist", ...Array.from({ length: CHECKLIST_LIMIT }, (_, i) => `- [ ] Todo ${i}`)];
    const parent = draw(note);
    expect(rows(parent)).toHaveLength(CHECKLIST_LIMIT);
    expect(blanks(parent)).toHaveLength(0);
  });

  it("keeps the list at the limit when there are more todos than fit, with the more row in the last place", () => {
    const note = ["## Checklist", ...Array.from({ length: CHECKLIST_LIMIT + 2 }, (_, i) => `- [ ] Todo ${i}`)];
    const parent = draw(note);
    expect(rows(parent)).toHaveLength(CHECKLIST_LIMIT);
    expect(blanks(parent)).toHaveLength(0);
    expect(parent.querySelector(".daily-page__checklist-more")?.textContent).toBe("+3 more");
  });

  it("asks to add a todo when an empty box is tapped", () => {
    const onAdd = vi.fn();
    const parent = draw(["## Checklist"], onAdd);
    (blanks(parent)[0] as HTMLElement).click();
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("is not tappable when nothing can add a todo", () => {
    const parent = draw(["## Checklist"]);
    expect(blanks(parent)[0].classList.contains("is-clickable")).toBe(false);
    expect(blanks(parent)[0].hasAttribute("aria-label")).toBe(false);
  });

  it("is named for a screen reader, since an empty box has no text", () => {
    const parent = draw(["## Checklist"], vi.fn());
    for (const blank of blanks(parent)) expect(blank.getAttribute("aria-label")).toBe("Add a todo");
  });

  it("asks to add a todo from the keyboard too, once per press", () => {
    const onAdd = vi.fn();
    const blank = blanks(draw(["## Checklist"], onAdd))[0] as HTMLElement;
    blank.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    blank.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    expect(onAdd).toHaveBeenCalledTimes(2);
  });

  it("leaves room for empty boxes when finished todos are in the list", () => {
    // Finished todos move to the Done line, so four open todos next to three finished ones leave one empty box.
    const note = ["## Checklist", "- [x] A", "- [x] B", "- [x] C", ...[1, 2, 3, 4].map((n) => `- [ ] Open ${n}`)];
    expect(blanks(draw(note))).toHaveLength(1);
    // Five open todos fill the list however many are finished, with no "more" row.
    const full = ["## Checklist", "- [x] A", "- [x] B", ...[1, 2, 3, 4, 5].map((n) => `- [ ] Open ${n}`)];
    const parent = draw(full);
    expect(blanks(parent)).toHaveLength(0);
    expect(parent.querySelector(".daily-page__checklist-more")).toBeNull();
  });

  it("does not make a todo's own box add a todo", () => {
    const onToggle = vi.fn();
    const onAdd = vi.fn();
    const parent = document.createElement("div");
    renderChecklist(parent, readChecklist(["## Checklist", "- [ ] Walk"]), onToggle, onAdd);
    parent.querySelector<HTMLElement>(".daily-page__box")!.click();
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onAdd).not.toHaveBeenCalled();
  });
});
