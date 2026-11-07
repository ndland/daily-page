// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DAILY_PATTERN } from "../src/logic/paths";
import { createdMsOf, dateFromNotePath, noteDateOf } from "../src/logic/noteDate";
import { renderPage } from "../src/render/page";

const DEFAULT_PATH = "05_Daily/2026/11-November/2026-11-06.md";

/** The calendar day of a date as YYYY-MM-DD, so tests compare whole days rather than parts. */
function ymd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("dateFromNotePath", () => {
  it("reads the full date from a path made with the default pattern", () => {
    expect(ymd(dateFromNotePath(DEFAULT_PATH, DEFAULT_DAILY_PATTERN)!)).toBe("2026-11-06");
  });

  it("reads the full date from a pattern that uses the month name, and from a different folder layout", () => {
    const date = dateFromNotePath("Journal/November 2026/2026-11-06.md", "Journal/{MMMM} {YYYY}/{YYYY}-{MM}-{DD}.md");
    expect(ymd(date!)).toBe("2026-11-06");
  });

  it("accepts a month name in any letter case", () => {
    expect(ymd(dateFromNotePath("j/NOVEMBER 2026 06.md", "j/{MMMM} {YYYY} {DD}.md")!)).toBe("2026-11-06");
  });

  it("refuses a path that does not match the pattern", () => {
    expect(dateFromNotePath("Notes/meeting.md", DEFAULT_DAILY_PATTERN)).toBeNull();
  });

  it("refuses a day that does not exist, such as 31 February", () => {
    expect(dateFromNotePath("05_Daily/2026/02-February/2026-02-31.md", DEFAULT_DAILY_PATTERN)).toBeNull();
  });

  it("refuses 29 February in a year that is not a leap year, and accepts it in one that is", () => {
    expect(dateFromNotePath("2027-02-29.md", "{YYYY}-{MM}-{DD}.md")).toBeNull();
    expect(ymd(dateFromNotePath("2028-02-29.md", "{YYYY}-{MM}-{DD}.md")!)).toBe("2028-02-29");
  });

  it("refuses a path whose month number and month name disagree", () => {
    expect(dateFromNotePath("11-March/2026-11-06.md", "{MM}-{MMMM}/{YYYY}-{MM}-{DD}.md")).toBeNull();
  });

  it("refuses a month name that is not a month", () => {
    expect(dateFromNotePath("Smarch/2026-11-06.md", "{MMMM}/{YYYY}-{MM}-{DD}.md")).toBeNull();
  });

  it("accepts a month number and month name that agree", () => {
    expect(ymd(dateFromNotePath("11-November/2026-11-06.md", "{MM}-{MMMM}/{YYYY}-{MM}-{DD}.md")!)).toBe("2026-11-06");
  });

  it("refuses a pattern with no tokens, since a path cannot name a date", () => {
    expect(dateFromNotePath("Notes/x.md", "Notes/x.md")).toBeNull();
  });

  it("treats the pattern's own dots and brackets as plain text", () => {
    expect(ymd(dateFromNotePath("Log (v2)/2026.11.06.md", "Log (v2)/{YYYY}.{MM}.{DD}.md")!)).toBe("2026-11-06");
  });

  it("returns noon, so no time zone can move the date to another day", () => {
    expect(dateFromNotePath(DEFAULT_PATH, DEFAULT_DAILY_PATTERN)!.getHours()).toBe(12);
  });
});

describe("noteDateOf", () => {
  it("uses the path when it matches, even if the creation time says another day", () => {
    const created = new Date(2030, 0, 1, 9, 0).getTime();
    expect(ymd(noteDateOf(DEFAULT_PATH, DEFAULT_DAILY_PATTERN, created))).toBe("2026-11-06");
  });

  it("uses the creation day when the path does not match", () => {
    const created = new Date(2026, 10, 6, 9, 30).getTime();
    expect(ymd(noteDateOf("Notes/meeting.md", DEFAULT_DAILY_PATTERN, created))).toBe("2026-11-06");
  });

  it("uses the creation day when the path names a day that does not exist", () => {
    const created = new Date(2026, 1, 28, 9, 30).getTime();
    expect(ymd(noteDateOf("05_Daily/2026/02-February/2026-02-31.md", DEFAULT_DAILY_PATTERN, created))).toBe("2026-02-28");
  });

  it("uses the current day when neither the path nor the creation time is known", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 9, 0));
    expect(ymd(noteDateOf("Notes/meeting.md", DEFAULT_DAILY_PATTERN, undefined))).toBe("2026-11-07");
  });
});

describe("createdMsOf", () => {
  it("reads a Dataview-style time that has toMillis", () => {
    expect(createdMsOf({ ctime: { toMillis: () => 1234 } })).toBe(1234);
  });

  it("reads a time that only has toJSDate", () => {
    expect(createdMsOf({ ctime: { toJSDate: () => new Date(5678) } })).toBe(5678);
  });

  it("gives nothing when there is no file, no creation time, or an unusable one", () => {
    expect(createdMsOf(null)).toBeUndefined();
    expect(createdMsOf(undefined)).toBeUndefined();
    expect(createdMsOf({})).toBeUndefined();
    expect(createdMsOf({ ctime: 42 })).toBeUndefined();
  });
});

describe("a page for an earlier note", () => {
  it("shows that note's day, day of the year and moon phase, not today's", () => {
    const root = document.createElement("div");
    // Today is 7 November. The note is for 6 November.
    renderPage(root, ["## Timeline"], new Date(2026, 10, 7, 9, 0), null, {
      date: new Date(2026, 10, 6, 12, 0),
    });

    expect(root.querySelector(".daily-page__date .daily-page__day")?.textContent).toBe("6");
    expect(root.querySelector(".daily-page__doy")?.textContent).toBe("310");
    expect(root.querySelector(".daily-page__moon-phase")?.textContent).toBe("Waning crescent");
    expect(root.querySelector(".daily-page__calendar-cell.is-today")?.textContent).toBe("6");
  });
});
