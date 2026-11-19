// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
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

  it("keeps a separate count and opens a full list with the correct reopen action", () => {
    const parent = document.createElement("div");
    const onReopen = vi.fn();
    const note = ["## Checklist", "- [x] Walk", "- [-] Read *today*", "- [-] Water"];
    renderDoneList(parent, readChecklist(note), undefined, onReopen);

    expect(parent.querySelector(".daily-page__done-label")?.textContent).toBe("Done (1)");
    expect(parent.querySelectorAll(".daily-page__done-item.is-cancelled")).toHaveLength(2);
    const count = parent.querySelector<HTMLButtonElement>("button.daily-page__cancelled-count")!;
    expect(count.textContent).toBe("Cancelled (2)");
    const dialog = parent.querySelector<HTMLDialogElement>("dialog")!;
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    count.click();
    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(dialog.querySelectorAll("li")).toHaveLength(2);
    expect(dialog.querySelector("em")?.textContent).toBe("today");
    dialog.querySelector<HTMLButtonElement>('[aria-label="Reopen Read today"]')!.click();
    expect(onReopen).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ raw: "- [-] Read *today*", index: 1 }));
    expect(dialog.close).toHaveBeenCalledOnce();
  });

  it("offers cancelled history without reopen controls on a read-only page", () => {
    const parent = document.createElement("div");
    renderDoneList(parent, readChecklist(["## Checklist", "- [-] Walk"]));
    const dialog = parent.querySelector<HTMLDialogElement>("dialog")!;
    dialog.showModal = vi.fn();
    parent.querySelector<HTMLButtonElement>("button.daily-page__cancelled-count")!.click();
    expect(dialog.querySelector("li")?.textContent).toBe("Walk");
    expect(dialog.querySelector("button[aria-label^='Reopen']")).toBeNull();
  });
});
