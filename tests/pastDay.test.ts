// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderPage } from "../src/render/page";

const note = ["## Timeline", "- 23:00- Forgotten", "", "## Checklist", "", "## Three things"];

function runningBlock(date: Date) {
  const root = document.createElement("div");
  // 14:30 on 6 November 2026.
  renderPage(root, note, new Date(2026, 10, 6, 14, 30), null, { date });
  return root.querySelector<HTMLElement>(".daily-page__block")!;
}

describe("a running activity on a past day's note", () => {
  it("runs to the end of that day, not to the clock", () => {
    const block = runningBlock(new Date(2026, 10, 5));
    expect(parseFloat(block.style.top) + parseFloat(block.style.height)).toBeCloseTo(100, 1);
  });

  it("still runs up to the clock on today's note", () => {
    const block = runningBlock(new Date(2026, 10, 6));
    // Started at 23:00, which is after 14:30, so the span wraps and is drawn long, as before.
    expect(parseFloat(block.style.top) + parseFloat(block.style.height)).toBeGreaterThan(0);
  });

  it("passes isToday to the click handler", () => {
    const seen: boolean[] = [];
    for (const day of [new Date(2026, 10, 5), new Date(2026, 10, 6)]) {
      const root = document.createElement("div");
      renderPage(root, note, new Date(2026, 10, 6, 14, 30), null, {
        date: day,
        handlers: { onEdit: (_block, isToday) => seen.push(isToday) },
      });
      root.querySelector<HTMLElement>(".daily-page__block")!.click();
    }
    expect(seen).toEqual([false, true]);
  });
});
