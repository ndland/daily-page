import { describe, expect, it } from "vitest";
import { SPAN_RULE } from "../src/entries/edit";
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
  it("rounds up to the next half hour, and stops at 23:30 rather than wrapping", () => {
    expect(nextHalfHour(10 * 60 + 12)).toBe(10 * 60 + 30);
    expect(nextHalfHour(10 * 60 + 30)).toBe(11 * 60);
    expect(nextHalfHour(23 * 60 + 15)).toBe(23 * 60 + 30);
    expect(nextHalfHour(23 * 60 + 45)).toBe(23 * 60 + 30);
  });

  it("maps a point on the timeline to a quarter hour, 06:00 at the top", () => {
    expect(minuteAtFraction(0)).toBe(6 * 60);
    expect(minuteAtFraction(1 / 21)).toBe(7 * 60);
    expect(minuteAtFraction(1)).toBe((6 * 60 + 21 * 60 - 15) % 1440);
    expect(minuteAtFraction(-1)).toBe(6 * 60);
  });
});

describe("startPlannedBlock, running activity in the way", () => {
  const R = { raw: "- 14:00-15:00 R", index: 1 };

  it("refuses when the running activity is over 12 hours old, and changes nothing", () => {
    const result = startPlannedBlock(["## Timeline", "- 08:00- Old", "- 14:00-15:00 R"], R, 21 * 60);
    expect(result).toEqual({ ok: false, message: SPAN_RULE });
  });

  it("refuses when the running activity started this minute", () => {
    const result = startPlannedBlock(["## Timeline", "- 13:00- Lunch", "- 14:00-15:00 R"], R, 13 * 60);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("this minute");
  });

  it("ends a running activity that began before midnight", () => {
    const result = startPlannedBlock(["## Timeline", "- 23:30- Late", "- 14:00-15:00 R"], R, 10);
    expect(result).toEqual({ ok: true, lines: ["## Timeline", "- 23:30-00:10 Late", "- 00:10- R"] });
  });

  it("refuses a side note, an index past the end, and a line that has moved", () => {
    const withNote = ["## Timeline", "- 09:40 note: idea", "- 14:00-15:00 R"];
    expect(startPlannedBlock(withNote, { raw: "- 09:40 note: idea", index: 0 }, 800).ok).toBe(false);
    expect(startPlannedBlock(withNote, { raw: "- 14:00-15:00 R", index: 9 }, 800).ok).toBe(false);
    expect(startPlannedBlock(withNote, { raw: "- 14:00-15:00 R", index: 0 }, 800).ok).toBe(false);
  });
});

describe("planBlock, edges", () => {
  it("adds the first block to an empty timeline", () => {
    expect(planBlock(["## Timeline"], { label: "A", start: "09:00", end: "10:00" })).toEqual({
      ok: true,
      lines: ["## Timeline", "- 09:00-10:00 A"],
    });
  });

  it("accepts exactly 12 hours, refuses a minute more and a zero-length span", () => {
    expect(planBlock(["## Timeline"], { label: "A", start: "06:00", end: "18:00" }).ok).toBe(true);
    expect(planBlock(["## Timeline"], { label: "A", start: "06:00", end: "18:01" }).ok).toBe(false);
    expect(planBlock(["## Timeline"], { label: "A", start: "10:00", end: "10:00" }).ok).toBe(false);
  });

  it("keeps a label on one line, and refuses an end of now", () => {
    const joined = planBlock(["## Timeline"], { label: "a\nb", start: "09:00", end: "10:00" });
    expect(joined).toEqual({ ok: true, lines: ["## Timeline", "- 09:00-10:00 a b"] });
    expect(planBlock(["## Timeline"], { label: "A", start: "09:00", end: "now" }).ok).toBe(false);
  });
});

describe("startPlannedBlock with a new label", () => {
  const planned = ["## Timeline", "- 14:00-15:00 Review #meeting"];
  const REVIEW = { raw: "- 14:00-15:00 Review #meeting", index: 0 };

  it("keeps the label typed before pressing Start now", () => {
    expect(startPlannedBlock(planned, REVIEW, 13 * 60, "Review photos  #family")).toEqual({
      ok: true,
      lines: ["## Timeline", "- 13:00- Review photos #family"],
    });
  });

  it("keeps the old label when the typed one is blank", () => {
    expect(startPlannedBlock(planned, REVIEW, 13 * 60, "  ")).toEqual({
      ok: true,
      lines: ["## Timeline", "- 13:00- Review #meeting"],
    });
  });
});
