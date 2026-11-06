import { describe, expect, it } from "vitest";
import { DEFAULT_DAILY_PATTERN, dailyNotePath, folderChain, folderOf } from "../src/logic/paths";

describe("dailyNotePath", () => {
  it("builds the default path for a date", () => {
    expect(dailyNotePath(new Date(2026, 10, 6), DEFAULT_DAILY_PATTERN)).toBe(
      "05_Daily/2026/11-November/2026-11-06.md",
    );
  });

  it("pads single-digit months and days", () => {
    expect(dailyNotePath(new Date(2026, 0, 3), DEFAULT_DAILY_PATTERN)).toBe(
      "05_Daily/2026/01-January/2026-01-03.md",
    );
  });
});

describe("folderOf and folderChain", () => {
  it("returns the folder part of a path", () => {
    expect(folderOf("05_Daily/2026/11-November/2026-11-06.md")).toBe("05_Daily/2026/11-November");
    expect(folderOf("note.md")).toBe("");
  });

  it("lists each folder from the top down", () => {
    expect(folderChain("05_Daily/2026/11-November/2026-11-06.md")).toEqual([
      "05_Daily",
      "05_Daily/2026",
      "05_Daily/2026/11-November",
    ]);
    expect(folderChain("note.md")).toEqual([]);
  });
});
