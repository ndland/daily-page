// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderPage } from "../src/render/page";

describe("side note time", () => {
  it("is its own element, so it can be styled apart from the note's text", () => {
    const root = document.createElement("div");
    renderPage(root, ["## Timeline", "- 09:40 note: idea for the proposal"], new Date(2026, 10, 6, 11, 0), null);

    const note = root.querySelector<HTMLElement>(".daily-page__note")!;
    expect(note.querySelector(".daily-page__note-time")?.textContent).toBe("09:40");
    expect(note.textContent).toBe("09:40 idea for the proposal");
  });
});
