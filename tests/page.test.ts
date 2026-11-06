// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderPage } from "../src/render/page";

const note = [
  "## Timeline",
  "- 09:00-10:15 Email",
  "- 09:40 note: idea for the proposal",
  "- 10:15- Proposal draft",
  "",
  "## Checklist",
  "- [ ] Walk",
  "- [x] Water",
];

describe("renderPage", () => {
  it("draws every part of the page in order", () => {
    const root = document.createElement("div");
    renderPage(root, note, new Date(2026, 10, 6, 11, 0), null);

    const page = root.querySelector(".daily-page");
    expect(page).not.toBeNull();
    expect(page!.querySelector(".daily-page__date")).not.toBeNull();
    expect(page!.querySelectorAll(".daily-page__checklist li")).toHaveLength(2);
    expect(page!.querySelectorAll(".daily-page__hour-label")).toHaveLength(8);
    expect(page!.querySelector(".daily-page__divider")).not.toBeNull();
    expect(page!.querySelector(".daily-page__calendar")).not.toBeNull();
  });

  it("puts activities in the timeline column and side notes in the notes column", () => {
    const root = document.createElement("div");
    renderPage(root, note, new Date(2026, 10, 6, 11, 0), null);

    const timeline = root.querySelector(".daily-page__timeline")!;
    const notes = root.querySelector(".daily-page__notes")!;
    expect(timeline.querySelectorAll(".daily-page__block")).toHaveLength(2);
    expect(notes.querySelectorAll(".daily-page__note")).toHaveLength(1);
  });

  it("marks the running activity", () => {
    const root = document.createElement("div");
    renderPage(root, note, new Date(2026, 10, 6, 11, 0), null);

    const running = root.querySelectorAll(".daily-page__block.is-running");
    expect(running).toHaveLength(1);
    expect(running[0].textContent).toContain("Proposal draft");
  });

  it("renders with no quote and no entries without throwing", () => {
    const root = document.createElement("div");
    expect(() => renderPage(root, [], new Date(2026, 10, 6, 8, 0), null)).not.toThrow();
    expect(root.querySelector(".daily-page__quote")).toBeNull();
    expect(root.querySelectorAll(".daily-page__block")).toHaveLength(0);
  });

  it("shows the quote when one is provided", () => {
    const root = document.createElement("div");
    renderPage(root, [], new Date(2026, 10, 6, 8, 0), {
      date: "2026-11-06",
      text: "Keep going",
      author: "Someone",
    });
    expect(root.querySelector(".daily-page__quote")?.textContent).toContain("Keep going");
  });

  it("replaces the previous page when rendered again", () => {
    const root = document.createElement("div");
    renderPage(root, note, new Date(2026, 10, 6, 11, 0), null);
    renderPage(root, note, new Date(2026, 10, 6, 11, 0), null);
    expect(root.querySelectorAll(".daily-page")).toHaveLength(1);
  });
});
