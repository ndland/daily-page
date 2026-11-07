import { describe, expect, it } from "vitest";
import { dateBlock, dayOfYear, isoWeek, monthGrid } from "../src/logic/calendar";
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

describe("isoWeek", () => {
  it("gives week 45 for Friday 2026-11-06", () => {
    expect(isoWeek(new Date(2026, 10, 6))).toBe(45);
  });

  it("puts Monday 2026-11-02 and Sunday 2026-11-08 in the same week", () => {
    expect(isoWeek(new Date(2026, 10, 2))).toBe(isoWeek(new Date(2026, 10, 8)));
  });

  it("gives week 1 for 1 January 2026, a Thursday", () => {
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1);
  });

  it("gives week 1 for Monday 29 December 2025, which belongs to 2026's week 1", () => {
    expect(isoWeek(new Date(2025, 11, 29))).toBe(1);
  });

  it("gives week 53 for 1 January 2027, since 2026 has 53 ISO weeks", () => {
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53);
  });

  it("gives week 1 for Monday 30 December 2024, since 2025 starts on a Wednesday", () => {
    expect(isoWeek(new Date(2024, 11, 30))).toBe(1);
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
