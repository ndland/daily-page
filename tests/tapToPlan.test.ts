// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderBlocks } from "../src/render/timeline";

function setup(onPlan: (minute: number) => void) {
  const timeline = document.createElement("div");
  timeline.getBoundingClientRect = () => ({ top: 100, height: 2100 }) as DOMRect;
  renderBlocks(timeline, document.createElement("div"), [], undefined, onPlan);
  return timeline;
}

describe("tapping the timeline to plan", () => {
  it("reports the quarter hour under the tap", () => {
    const onPlan = vi.fn();
    const timeline = setup(onPlan);
    // 2100px for 21 hours: 100px an hour. 250px down is 2.5 hours after 06:00.
    timeline.dispatchEvent(new MouseEvent("click", { clientY: 350, bubbles: true }));
    expect(onPlan).toHaveBeenCalledWith(8 * 60 + 30);
  });

  it("ignores a tap on a block", () => {
    const onPlan = vi.fn();
    const timeline = setup(onPlan);
    const block = document.createElement("div");
    timeline.appendChild(block);
    block.dispatchEvent(new MouseEvent("click", { clientY: 350, bubbles: true }));
    expect(onPlan).not.toHaveBeenCalled();
  });
});
