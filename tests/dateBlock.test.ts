// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderDateBlock } from "../src/render/dateBlock";
import { moonPhase } from "../src/logic/moon";

describe("renderDateBlock", () => {
  it("names the moon phase in visible text, beside the day of the year", () => {
    const parent = document.createElement("div");
    renderDateBlock(parent, new Date(2026, 10, 6, 9, 0));

    const phase = parent.querySelector(".daily-page__moon-phase");
    expect(phase?.textContent).toBe("Waning crescent");
    expect(parent.querySelector(".daily-page__date-side .daily-page__doy")?.textContent).toBe("310");
    expect(parent.querySelector(".daily-page__moon")?.textContent).toBe("🌘");
  });

  it("keeps the phase name in step with the moon's icon for the same day", () => {
    const date = new Date(2026, 10, 6, 9, 0);
    const parent = document.createElement("div");
    renderDateBlock(parent, date);
    expect(parent.querySelector(".daily-page__moon-phase")?.textContent).toBe(moonPhase(date).name);
  });
});
