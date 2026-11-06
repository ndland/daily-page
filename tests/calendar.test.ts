import { describe, expect, it } from "vitest";
import { dateBlock, dayOfYear, monthGrid } from "../src/logic/calendar";
import { moonPhase } from "../src/logic/moon";

describe("dateBlock", () => {
  it("shows month, day, weekday, and day of year for 2026-07-23", () => {
    expect(dateBlock(new Date(2026, 6, 23))).toEqual({
      month: "JUL",
      day: "23",
      weekday: "THU",
      dayOfYear: 204,
    });
  });

  it("shows Friday 2026-11-06", () => {
    expect(dateBlock(new Date(2026, 10, 6)).weekday).toBe("FRI");
  });
});

describe("dayOfYear", () => {
  it("counts from 1 on 1 January", () => {
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1);
  });

  it("counts 366 on 31 December of a leap year", () => {
    expect(dayOfYear(new Date(2024, 11, 31))).toBe(366);
  });
});

describe("monthGrid", () => {
  it("starts November 2026 with six blanks, since 1 November is a Sunday", () => {
    const rows = monthGrid(2026, 10);
    expect(rows[0]).toEqual([null, null, null, null, null, null, 1]);
  });

  it("pads the last row to seven cells and keeps every day once", () => {
    const rows = monthGrid(2026, 10);
    expect(rows.every((row) => row.length === 7)).toBe(true);
    const days = rows.flat().filter((cell): cell is number => cell !== null);
    expect(days).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it("starts February 2026 on a Sunday, so the first row has six blanks", () => {
    // 1 February 2026 is a Sunday.
    expect(monthGrid(2026, 1)[0]).toEqual([null, null, null, null, null, null, 1]);
  });
});

describe("moonPhase", () => {
  it("reports a new moon at the reference date", () => {
    expect(moonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14))).name).toBe("New moon");
  });

  it("reports a full moon about half a cycle later", () => {
    // Full moon on 2000-01-21, about 14.4 days after the reference new moon.
    expect(moonPhase(new Date(Date.UTC(2000, 0, 21, 4, 40))).name).toBe("Full moon");
  });
});
