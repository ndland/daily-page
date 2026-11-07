// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderDoneList } from "../src/render/done";
import { readChecklist } from "../src/render/checklist";

describe("finished todos line", () => {
  it("lists every finished todo, one row each, with the more row hidden", () => {
    const parent = document.createElement("div");
    const note = ["## Checklist", "- [x] Walk", "- [ ] Water", "- [x] Read ten pages"];
    renderDoneList(parent, readChecklist(note));

    const names = [...parent.querySelectorAll(".daily-page__done-item")].map((el) => el.textContent);
    expect(names).toEqual(["Walk", "Read ten pages"]);
    expect(parent.querySelector(".daily-page__done-label")?.textContent).toBe("Done (2)");
    expect(parent.querySelector<HTMLElement>(".daily-page__done-more")?.hidden).toBe(true);
  });

  it("puts the full list in the tooltip", () => {
    const parent = document.createElement("div");
    renderDoneList(parent, readChecklist(["## Checklist", "- [x] Walk", "- [x] Water"]));
    expect(parent.querySelector<HTMLElement>(".daily-page__done")?.title).toBe("Done (2): Walk  ·  Water");
  });

  it("draws nothing when no todo is finished", () => {
    const parent = document.createElement("div");
    renderDoneList(parent, readChecklist(["## Checklist", "- [ ] Walk"]));
    expect(parent.children).toHaveLength(0);
  });
});
