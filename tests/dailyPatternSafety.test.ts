import { describe, expect, it } from "vitest";
import { DEFAULT_DAILY_PATTERN, isSafeDailyPattern } from "../src/logic/paths";

describe("isSafeDailyPattern", () => {
  it("accepts paths that stay inside the vault, including the default", () => {
    expect(isSafeDailyPattern(DEFAULT_DAILY_PATTERN)).toBe(true);
    expect(isSafeDailyPattern("Journal/{YYYY}/{MM}-{DD}.md")).toBe(true);
  });

  it("refuses a '..' part, in either slash style", () => {
    expect(isSafeDailyPattern("../outside/{YYYY}.md")).toBe(false);
    expect(isSafeDailyPattern("Journal/../../outside/{YYYY}.md")).toBe(false);
    expect(isSafeDailyPattern("Journal\\..\\outside.md")).toBe(false);
  });

  it("refuses a leading slash, a backslash, or a drive letter", () => {
    expect(isSafeDailyPattern("/etc/{YYYY}.md")).toBe(false);
    expect(isSafeDailyPattern("\\\\server\\share\\{YYYY}.md")).toBe(false);
    expect(isSafeDailyPattern("C:/Users/x/{YYYY}.md")).toBe(false);
  });

  it("accepts a name that merely contains two dots", () => {
    expect(isSafeDailyPattern("Notes/v1..2/{YYYY}.md")).toBe(true);
  });
});
