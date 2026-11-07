// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderMiniCalendar } from "../src/render/dateBlock";

describe("renderMiniCalendar", () => {
  it("highlights exactly the day given, and numbers the weeks by ISO week", () => {
    const parent = document.createElement("div");
    renderMiniCalendar(parent, new Date(2026, 10, 6));

    const today = parent.querySelectorAll(".daily-page__calendar-cell.is-today");
    expect(today).toHaveLength(1);
    expect(today[0].textContent).toBe("6");

    // November 2026 starts on a Sunday, so its first row is the week of 26 October (ISO week 44).
    // The second row is the week of Monday 2 November, which is ISO week 45.
    const weeks = [...parent.querySelectorAll(".daily-page__calendar-week")].map((el) => el.textContent);
    expect(weeks[0]).toBe("44");
    expect(weeks[1]).toBe("45");
  });
});
