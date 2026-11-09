// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { readTimeline } from "../src/entries/format";
import { layoutTimeline, renderBlocks, spreadShortLabels } from "../src/render/timeline";

/** A timeline with one block per line, whose labels have the given widths, since jsdom does no layout. */
function timelineWith(lines: string[], widths: number[], height = 1000): HTMLElement {
  const timeline = document.createElement("div");
  Object.defineProperty(timeline, "clientHeight", { value: height });
  renderBlocks(timeline, document.createElement("div"), layoutTimeline(readTimeline(["## Timeline", ...lines]), 15 * 60));
  timeline.querySelectorAll<HTMLElement>(".daily-page__block-label").forEach((label, i) => {
    label.getBoundingClientRect = () => ({ width: widths[i] }) as DOMRect;
  });
  return timeline;
}

const SHORT_LINES = ["- 08:00-08:15 Label 0", "- 09:00-09:15 Label 1", "- 10:00-10:15 Label 2"];
const bandText = (timeline: HTMLElement) => timeline.style.getPropertyValue("--dp-band-text");

describe("the width of every block's colour band", () => {
  it("is the width of the longest label, so each label sits fully inside its highlight", () => {
    const timeline = timelineWith(SHORT_LINES, [120, 300, 80]);
    spreadShortLabels(timeline);
    expect(bandText(timeline)).toBe("300px");
  });

  it("counts a tall block's label too, so tall and short bands are the same width", () => {
    const timeline = timelineWith(["- 09:00-11:00 Tall block", "- 13:00-13:15 Short"], [400, 100]);
    spreadShortLabels(timeline);
    expect(bandText(timeline)).toBe("400px");
  });

  it("is measured again each time, so a shorter label list narrows it", () => {
    const timeline = timelineWith(["- 09:00-09:15 Label"], [300]);
    spreadShortLabels(timeline);
    timeline.querySelector<HTMLElement>(".daily-page__block-label")!.getBoundingClientRect = () => ({ width: 90 }) as DOMRect;
    spreadShortLabels(timeline);
    expect(bandText(timeline)).toBe("90px");
  });

  it("rounds a fractional width up, so the text is never clipped", () => {
    const timeline = timelineWith(["- 09:00-09:15 Label"], [300.2]);
    spreadShortLabels(timeline);
    expect(bandText(timeline)).toBe("301px");
  });

  it("is written only when it changes, so a resize that leaves the text as wide costs no layout", () => {
    const timeline = timelineWith(["- 09:00-09:15 Label"], [300]);
    const setProperty = vi.spyOn(timeline.style, "setProperty");
    spreadShortLabels(timeline);
    spreadShortLabels(timeline);
    expect(setProperty).toHaveBeenCalledTimes(1);
  });

  it("is cleared when the labels go, rather than left at an old width", () => {
    const timeline = timelineWith(["- 09:00-09:15 Label"], [300]);
    spreadShortLabels(timeline);
    timeline.querySelector<HTMLElement>(".daily-page__block")!.remove();
    spreadShortLabels(timeline);
    expect(bandText(timeline)).toBe("");
  });

  it("measures the labels while the timeline is marked as measuring", () => {
    const timeline = timelineWith(["- 09:00-09:15 Label"], [300]);
    let markedWhileMeasuring = false;
    timeline.querySelector<HTMLElement>(".daily-page__block-label")!.getBoundingClientRect = () => {
      markedWhileMeasuring = timeline.classList.contains("is-measuring");
      return { width: 300 } as DOMRect;
    };
    spreadShortLabels(timeline);
    expect(markedWhileMeasuring).toBe(true);
  });

  it("waits until the timeline has a height, since nothing is laid out before then", () => {
    const timeline = timelineWith(["- 09:00-09:15 Label"], [300], 0);
    spreadShortLabels(timeline);
    expect(bandText(timeline)).toBe("");
  });

  it("is left for the stylesheet to fill when there is no label to measure", () => {
    const timeline = timelineWith([], []);
    spreadShortLabels(timeline);
    expect(bandText(timeline)).toBe("");
  });

  it("measures labels on one line only while measuring, so the page is left as it was", () => {
    const timeline = timelineWith(SHORT_LINES, [120, 300, 80]);
    spreadShortLabels(timeline);
    expect(timeline.classList.contains("is-measuring")).toBe(false);
  });
});
