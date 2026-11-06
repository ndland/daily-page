import { describe, expect, it } from "vitest";
import { formatTime, parseTime } from "../src/logic/time";

describe("parseTime", () => {
  it("converts HH:MM to minutes from midnight", () => {
    expect(parseTime("00:00")).toBe(0);
    expect(parseTime("09:40")).toBe(580);
    expect(parseTime("23:59")).toBe(1439);
  });

  it("rejects text that is not a valid time", () => {
    expect(parseTime("9:40")).toBeNull();
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("09:60")).toBeNull();
    expect(parseTime("noon")).toBeNull();
    expect(parseTime("")).toBeNull();
  });
});

describe("formatTime", () => {
  it("pads hours and minutes to two digits", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(580)).toBe("09:40");
    expect(formatTime(1439)).toBe("23:59");
  });

  it("round-trips with parseTime", () => {
    for (const text of ["00:00", "06:05", "13:30", "23:59"]) {
      expect(formatTime(parseTime(text) as number)).toBe(text);
    }
  });

  it("throws for values outside one day", () => {
    expect(() => formatTime(-1)).toThrow(RangeError);
    expect(() => formatTime(1440)).toThrow(RangeError);
    expect(() => formatTime(1.5)).toThrow(RangeError);
  });
});
