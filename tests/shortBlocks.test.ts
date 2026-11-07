// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readTimeline } from "../src/entries/format";
import { layoutTimeline, renderBlocks, SHORT_BLOCK_PCT } from "../src/render/timeline";

function blocksFor(lines: string[]) {
  const timeline = document.createElement("div");
  renderBlocks(timeline, document.createElement("div"), layoutTimeline(readTimeline(["## Timeline", ...lines]), 15 * 60));
  return [...timeline.querySelectorAll<HTMLElement>(".daily-page__block")];
}

describe("short blocks", () => {
  it("marks a fifteen-minute block as short", () => {
    const [block] = blocksFor(["- 09:00-09:15 Quick call"]);
    expect(block.classList.contains("is-short")).toBe(true);
  });

  it("marks a thirty-minute block as short", () => {
    const [block] = blocksFor(["- 09:00-09:30 Standup"]);
    expect(block.classList.contains("is-short")).toBe(true);
  });

  it("leaves a forty-five-minute block at full label size", () => {
    const [block] = blocksFor(["- 09:00-09:45 Design review"]);
    expect(block.classList.contains("is-short")).toBe(false);
  });

  it("keeps the full label text in short blocks", () => {
    const [block] = blocksFor(["- 09:00-09:15 Quick call"]);
    expect(block.querySelector(".daily-page__block-label")?.textContent).toContain("Quick call");
    expect(SHORT_BLOCK_PCT).toBeGreaterThan(0);
  });
});
