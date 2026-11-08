import { describe, expect, it } from "vitest";
import { nextHalfHour } from "../src/logic/time";
import { minuteAtFraction } from "../src/render/timeline";
import { planBlock, startPlannedBlock } from "../src/entries/log";

const scope = ["## Timeline", "- 09:00-10:00 Email #work", "- 10:00- Draft", "## Checklist"];

describe("planBlock", () => {
  it("adds a closed block after the last entry", () => {
    const result = planBlock(scope, { label: "Review #meeting", start: "14:00", end: "15:00" });
    expect(result).toEqual({
      ok: true,
      lines: ["## Timeline", "- 09:00-10:00 Email #work", "- 10:00- Draft", "- 14:00-15:00 Review #meeting", "## Checklist"],
    });
  });

  it("does not count as running, and may overlap or lie in the past", () => {
    const result = planBlock(scope, { label: "Early", start: "09:30", end: "09:45" });
    expect(result.ok).toBe(true);
  });

  it("accepts a span that crosses midnight", () => {
    expect(planBlock(scope, { label: "Late", start: "23:00", end: "01:00" }).ok).toBe(true);
  });

  it("refuses a missing label, bad times, a blank end and a span over 12 hours", () => {
    expect(planBlock(scope, { label: " ", start: "14:00", end: "15:00" }).ok).toBe(false);
    expect(planBlock(scope, { label: "x", start: "2pm", end: "15:00" }).ok).toBe(false);
    expect(planBlock(scope, { label: "x", start: "14:00", end: "" }).ok).toBe(false);
    expect(planBlock(scope, { label: "x", start: "06:00", end: "20:00" }).ok).toBe(false);
  });
});

describe("startPlannedBlock", () => {
  const planned = ["## Timeline", "- 09:00-10:00 Email", "- 14:00-15:00 Review #meeting"];
  const REVIEW = { raw: "- 14:00-15:00 Review #meeting", index: 1 };

  it("turns the block into a running activity starting now", () => {
    const result = startPlannedBlock(planned, REVIEW, 13 * 60 + 40);
    expect(result).toEqual({ ok: true, lines: ["## Timeline", "- 09:00-10:00 Email", "- 13:40- Review #meeting"] });
  });

  it("ends the running activity at now first", () => {
    const withRunning = [...planned, "- 12:00- Lunch"];
    const result = startPlannedBlock(withRunning, REVIEW, 13 * 60);
    expect(result).toEqual({
      ok: true,
      lines: ["## Timeline", "- 09:00-10:00 Email", "- 13:00- Review #meeting", "- 12:00-13:00 Lunch"],
    });
  });

  it("refuses a stale click and an activity that is already running", () => {
    expect(startPlannedBlock(planned, { raw: "- 14:00-15:00 Other", index: 1 }, 800).ok).toBe(false);
    const running = ["## Timeline", "- 12:00- Lunch"];
    expect(startPlannedBlock(running, { raw: "- 12:00- Lunch", index: 0 }, 800).ok).toBe(false);
  });
});

describe("nextHalfHour and minuteAtFraction", () => {
  it("rounds up to the next half hour and wraps at midnight", () => {
    expect(nextHalfHour(10 * 60 + 12)).toBe(10 * 60 + 30);
    expect(nextHalfHour(10 * 60 + 30)).toBe(11 * 60);
    expect(nextHalfHour(23 * 60 + 45)).toBe(0);
  });

  it("maps a point on the timeline to a quarter hour, 06:00 at the top", () => {
    expect(minuteAtFraction(0)).toBe(6 * 60);
    expect(minuteAtFraction(1 / 21)).toBe(7 * 60);
    expect(minuteAtFraction(1)).toBe((6 * 60 + 21 * 60 - 15) % 1440);
    expect(minuteAtFraction(-1)).toBe(6 * 60);
  });
});
