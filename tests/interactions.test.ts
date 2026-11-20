// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderPage } from "../src/render/page";

const note = [
  "## Timeline",
  "- 09:00-10:15 Email #work",
  "- 09:40 note: idea for the proposal",
  "## Checklist",
  "- [ ] Walk",
  "- [x] Water",
];

const now = new Date(2026, 10, 6, 11, 0);

describe("clicks on the page", () => {
  it("passes the exact checklist line when Done is chosen from the task box", () => {
    const root = document.createElement("div");
    const onChecklistStatus = vi.fn();
    const open = ["## Checklist", "- [ ] Walk", "- [ ] Water"];
    renderPage(root, open, now, null, { handlers: { onChecklistStatus } });

    const boxes = root.querySelectorAll<HTMLButtonElement>(".daily-page__status-box");
    const dialog = root.querySelector("dialog")!;
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    for (const box of boxes) {
      box.click();
      dialog.querySelector("button")!.click();
    }

    expect(onChecklistStatus).toHaveBeenNthCalledWith(1, expect.objectContaining({ raw: "- [ ] Walk" }), "done", true);
    expect(onChecklistStatus).toHaveBeenNthCalledWith(2, expect.objectContaining({ raw: "- [ ] Water" }), "done", true);
  });

  it("passes the clicked activity with its line and index", () => {
    const root = document.createElement("div");
    const onEdit = vi.fn();
    renderPage(root, note, now, null, { handlers: { onEdit } });

    root.querySelector<HTMLElement>(".daily-page__block")!.click();

    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "activity", raw: "- 09:00-10:15 Email #work", index: 0 }),
      expect.any(Boolean),
    );
  });

  it("passes the clicked side note with its line and index", () => {
    const root = document.createElement("div");
    const onEdit = vi.fn();
    renderPage(root, note, now, null, { handlers: { onEdit } });

    root.querySelector<HTMLElement>(".daily-page__note")!.click();

    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "note", raw: "- 09:40 note: idea for the proposal", index: 1 }),
      expect.any(Boolean),
    );
  });

  it("marks clickable parts only when a handler is given", () => {
    const plain = document.createElement("div");
    renderPage(plain, note, now, null);
    expect(plain.querySelector(".is-clickable")).toBeNull();

    const interactive = document.createElement("div");
    renderPage(interactive, note, now, null, { handlers: { onEdit: () => {}, onChecklistStatus: () => {} } });
    expect(interactive.querySelectorAll(".is-clickable").length).toBeGreaterThan(0);
  });
});
