// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { GREAT_THINGS_LIMIT, readGreatThings, renderGreatThings } from "../src/render/greatThings";

describe("three things", () => {
  it("reads the bullets under the Three things heading, with their lines and positions", () => {
    const note = ["## Timeline", "- 09:00- Email", "## Three things", "- Finish the draft", "- Walk", "- Call Mum"];
    expect(readGreatThings(note)).toEqual([
      { text: "Finish the draft", raw: "- Finish the draft", index: 0 },
      { text: "Walk", raw: "- Walk", index: 1 },
      { text: "Call Mum", raw: "- Call Mum", index: 2 },
    ]);
  });

  it("skips blank bullets and keeps the positions of the rest", () => {
    const note = ["## Three things", "- ", "- One", "- Two", "- Three", "- Four"];
    const items = readGreatThings(note);
    expect(items.map((item) => item.text)).toEqual(["One", "Two", "Three", "Four"]);
    expect(items[0].index).toBe(1);
    expect(GREAT_THINGS_LIMIT).toBe(3);
  });

  it("shows three bullets and a '+N more' row for the rest, so none vanishes silently", () => {
    const parent = document.createElement("div");
    renderGreatThings(parent, readGreatThings(["## Three things", "- One", "- Two", "- Three", "- Four", "- Five"]));
    const rows = [...parent.querySelectorAll(".daily-page__great-list li")].map((li) => li.textContent);
    expect(rows).toEqual(["One", "Two", "Three", "+2 more"]);
  });

  it("returns nothing when the section is missing", () => {
    expect(readGreatThings(["## Timeline"])).toEqual([]);
  });

  it("shows the title and a hint when nothing is filled in", () => {
    const parent = document.createElement("div");
    renderGreatThings(parent, []);
    expect(parent.querySelector(".daily-page__great-title")?.textContent).toBe("Three things to make my day great");
    expect(parent.querySelector(".daily-page__great-hint")).not.toBeNull();
  });

  it("shows each bullet", () => {
    const parent = document.createElement("div");
    renderGreatThings(parent, readGreatThings(["## Three things", "- One", "- Two"]));
    expect(parent.querySelectorAll(".daily-page__great-list li")).toHaveLength(2);
  });

  it("makes each bullet clickable and passes it to onEdit when clicked", () => {
    const parent = document.createElement("div");
    const onEdit = vi.fn();
    renderGreatThings(parent, readGreatThings(["## Three things", "- One", "- Two"]), onEdit);

    const rows = parent.querySelectorAll<HTMLElement>(".daily-page__great-list li");
    expect(rows[0].classList.contains("is-clickable")).toBe(true);
    rows[1].click();
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ text: "Two", raw: "- Two", index: 1 }));
  });

  it("leaves bullets inert when no handler is given", () => {
    const parent = document.createElement("div");
    renderGreatThings(parent, readGreatThings(["## Three things", "- One"]));
    expect(parent.querySelector(".is-clickable")).toBeNull();
  });
});
