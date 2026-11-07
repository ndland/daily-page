import { describe, expect, it } from "vitest";
import { readTimeline, writeTimeline } from "../src/entries/format";
import { endRunning, logActivity } from "../src/entries/log";

const at = (hour: number, minute: number) => hour * 60 + minute;

function timelineWith(lines: string[]) {
  return readTimeline(["## Timeline", ...lines]);
}

describe("logging a new activity over a running one", () => {
  it("ends the running activity at the new time when the span is valid", () => {
    const outcome = logActivity(timelineWith(["- 09:00- Email"]), "Walk", at(10, 0));
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(writeTimeline(["## Timeline"], outcome.timeline)).toContain("- 09:00-10:00 Email");
  });

  it("refuses to log twice in the same minute, rather than write a zero-length activity", () => {
    const outcome = logActivity(timelineWith(["- 10:00- Email"]), "Walk", at(10, 0));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).toContain("started this minute");
  });

  it("refuses to end a running activity that has run for more than 12 hours", () => {
    const outcome = logActivity(timelineWith(["- 06:00- Email"]), "Walk", at(19, 0));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).toContain("at most 12 hours");
  });
});

describe("ending the running activity", () => {
  it("ends it when the span is valid", () => {
    const outcome = endRunning(timelineWith(["- 09:00- Email"]), at(9, 45));
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(writeTimeline(["## Timeline"], outcome.timeline)).toContain("- 09:00-09:45 Email");
  });

  it("refuses an end in the same minute as the start", () => {
    expect(endRunning(timelineWith(["- 09:00- Email"]), at(9, 0)).ok).toBe(false);
  });
});
