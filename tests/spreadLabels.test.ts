// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readTimeline } from "../src/entries/format";
import { LABEL_GAP_PX, layoutTimeline, renderBlocks, spreadShortLabels } from "../src/render/timeline";

/** A timeline of a given pixel height, with the short entries laid out in it. */
function timelineWith(lines: string[], height: number): HTMLElement {
  const timeline = document.createElement("div");
  timeline.className = "daily-page__timeline";
  Object.defineProperty(timeline, "clientHeight", { value: height });
  renderBlocks(timeline, document.createElement("div"), layoutTimeline(readTimeline(["## Timeline", ...lines]), 15 * 60));
  return timeline;
}

/** The centre of a short label, in pixels from the top of the timeline. */
function labelCentre(timeline: HTMLElement, index: number): number {
  const block = timeline.querySelectorAll<HTMLElement>(".daily-page__block.is-short")[index];
  const label = block.querySelector<HTMLElement>(".daily-page__block-label")!;
  const blockTop = (parseFloat(block.style.top) / 100) * 1000;
  return blockTop + parseFloat(label.style.top || "0");
}

describe("spreadShortLabels", () => {
  it("keeps back-to-back short labels at least the gap apart", () => {
    const timeline = timelineWith(
      ["- 13:00-13:30 Review notes", "- 13:30-13:45 Quick call", "- 13:45-14:15 Standup"],
      1000,
    );
    spreadShortLabels(timeline);
    const centres = [0, 1, 2].map((i) => labelCentre(timeline, i));
    expect(centres[1] - centres[0]).toBeGreaterThanOrEqual(LABEL_GAP_PX - 0.01);
    expect(centres[2] - centres[1]).toBeGreaterThanOrEqual(LABEL_GAP_PX - 0.01);
  });

  it("leaves labels that are already far apart at their block centres", () => {
    const timeline = timelineWith(["- 09:00-09:15 Call", "- 11:00-11:15 Other call"], 1000);
    spreadShortLabels(timeline);
    // Each fifteen-minute block is 11.9px tall, so its centre is 5.95px down the block.
    const labels = [...timeline.querySelectorAll<HTMLElement>(".daily-page__block-label")];
    expect(parseFloat(labels[0].style.top)).toBeCloseTo(5.95, 1);
    expect(parseFloat(labels[1].style.top)).toBeCloseTo(5.95, 1);
  });

  it("does nothing while the timeline has no height yet", () => {
    const timeline = timelineWith(["- 13:30-13:45 Quick call"], 0);
    spreadShortLabels(timeline);
    expect(timeline.querySelector<HTMLElement>(".daily-page__block-label")!.style.top).toBe("");
  });
});

describe("spreadShortLabels at the bottom of the axis", () => {
  it("keeps a cluster of labels near the bottom inside the axis", () => {
    // Four short blocks in the last hour of a 1000px axis, which would be pushed past the bottom.
    const timeline = timelineWith(
      ["- 02:30-02:45 One", "- 02:45-03:00 Two", "- 03:00-03:10 Three", "- 03:10-03:15 Four"],
      1000,
    );
    spreadShortLabels(timeline);
    for (let i = 0; i < 4; i++) {
      expect(labelCentre(timeline, i)).toBeLessThanOrEqual(1000 + 0.01);
    }
    const centres = [0, 1, 2, 3].map((i) => labelCentre(timeline, i));
    for (let i = 1; i < centres.length; i++) {
      expect(centres[i] - centres[i - 1]).toBeGreaterThanOrEqual(LABEL_GAP_PX - 0.01);
    }
  });
});
