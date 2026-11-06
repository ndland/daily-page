import { describe, expect, it } from "vitest";
import { readTimeline } from "../src/entries/format";
import { axisOffset, AXIS_MINUTES, hourMarks, layoutTimeline } from "../src/render/timeline";
import { parseTime } from "../src/logic/time";

const at = (text: string) => parseTime(text) as number;
const pctOf = (minutes: number) => (minutes / AXIS_MINUTES) * 100;

describe("axisOffset", () => {
  it("measures from 06:00 and wraps at midnight", () => {
    expect(axisOffset(at("06:00"))).toBe(0);
    expect(axisOffset(at("09:00"))).toBe(180);
    expect(axisOffset(at("00:00"))).toBe(18 * 60);
    expect(axisOffset(at("03:00"))).toBe(21 * 60);
  });
});

describe("layoutTimeline", () => {
  it("places an activity from 09:00 to 13:30 on the axis", () => {
    const [block] = layoutTimeline(readTimeline(["## Timeline", "- 09:00-13:30 Deep work"]), at("14:00"));
    expect(block.topPct).toBeCloseTo(pctOf(180));
    expect(block.heightPct).toBeCloseTo(pctOf(270));
    expect(block.running).toBe(false);
    expect(block.outOfAxis).toBe(false);
  });

  it("places a side note at its timestamp", () => {
    const [block] = layoutTimeline(readTimeline(["## Timeline", "- 09:40 note: idea"]), at("10:00"));
    expect(block.kind).toBe("note");
    expect(block.topPct).toBeCloseTo(pctOf(220));
    expect(block.heightPct).toBe(0);
  });

  it("runs a running activity up to now", () => {
    const [block] = layoutTimeline(readTimeline(["## Timeline", "- 10:00- Draft"]), at("10:45"));
    expect(block.running).toBe(true);
    expect(block.heightPct).toBeCloseTo(pctOf(45));
    expect(block.timeText).toBe("10:00-now");
  });

  it("clips an activity that runs past 03:00 at the bottom of the axis", () => {
    const [block] = layoutTimeline(readTimeline(["## Timeline", "- 02:00-04:00 Late"]), at("05:00"));
    expect(block.topPct).toBeCloseTo(pctOf(1200));
    expect(block.heightPct).toBeCloseTo(pctOf(AXIS_MINUTES - 1200));
  });

  it("marks entries that start between 03:00 and 06:00 as outside the axis", () => {
    const [block] = layoutTimeline(readTimeline(["## Timeline", "- 03:30-05:00 Sleep check"]), at("05:30"));
    expect(block.outOfAxis).toBe(true);
    expect(block.topPct).toBe(100);
  });

  it("skips lines that are not valid entries", () => {
    const blocks = layoutTimeline(readTimeline(["## Timeline", "- 25:00-26:00 Broken", ""]), at("10:00"));
    expect(blocks).toEqual([]);
  });
});

describe("hourMarks", () => {
  it("labels the axis 6, 9, 12, 15, 18, 21, 0, 3 from the top", () => {
    const marks = hourMarks();
    expect(marks.map((mark) => mark.text)).toEqual(["6", "9", "12", "15", "18", "21", "0", "3"]);
    expect(marks[0].topPct).toBe(0);
    expect(marks[6].topPct).toBeCloseTo(pctOf(18 * 60));
    expect(marks[7].topPct).toBe(100);
  });
});
