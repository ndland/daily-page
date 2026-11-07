// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readTimeline } from "../src/entries/format";
import { layoutTimeline, renderBlocks, spreadShortLabels } from "../src/render/timeline";

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

describe("spreadShortLabels with more labels than the axis can hold", () => {
  it("keeps every label's centre on the axis, from its top to its bottom", () => {
    const lines = Array.from({ length: 40 }, (_, i) => {
      const start = 9 * 60 + i * 4;
      return `- ${clock(start)}-${clock(start + 3)} Label ${i}`;
    });
    const timeline = document.createElement("div");
    timeline.className = "daily-page__timeline";
    Object.defineProperty(timeline, "clientHeight", { value: 300 });
    renderBlocks(timeline, document.createElement("div"), layoutTimeline(readTimeline(["## Timeline", ...lines]), 15 * 60));

    spreadShortLabels(timeline);

    for (const block of timeline.querySelectorAll<HTMLElement>(".daily-page__block.is-short")) {
      const top = (parseFloat(block.style.top) / 100) * 300;
      const label = block.querySelector<HTMLElement>(".daily-page__block-label")!;
      const centre = top + parseFloat(label.style.top || "0");
      expect(centre).toBeGreaterThanOrEqual(-0.01);
      expect(centre).toBeLessThanOrEqual(300.01);
    }
  });
});
