import { describe, expect, it } from "vitest";
import { doneLayout, doneLayoutByRows } from "../src/render/fit";
import { gridLinePositions, gridUnitPx, layOutRows } from "../src/logic/grid";

describe("gridLinePositions", () => {
  it("places a line every unit, starting at 0, up to the length", () => {
    expect(gridLinePositions(45, 15)).toEqual([0, 15, 30, 45]);
  });

  it("stops before a line that would fall past the length", () => {
    expect(gridLinePositions(44, 15)).toEqual([0, 15, 30]);
  });
});

describe("gridUnitPx", () => {
  it("is 3/148 of the page height, in whole pixels", () => {
    // 732 px of page content: 3 mm of 148 mm is 14.8 px, which rounds to 15.
    expect(gridUnitPx(732)).toBe(15);
  });

  it("grows with the page", () => {
    expect(gridUnitPx(1000)).toBe(20);
  });

  it("never drops below 6 px, so a very short page still has a visible grid", () => {
    expect(gridUnitPx(100)).toBe(6);
  });
});

describe("layOutRows", () => {
  it("starts each row at its wanted unit when the rows already fit", () => {
    expect(layOutRows([5, 12], 2, 0, 20)).toEqual([5, 12]);
  });

  it("pushes a row down until it clears the row above, without overlap", () => {
    expect(layOutRows([5, 5, 5], 2, 0, 20)).toEqual([5, 7, 9]);
  });

  it("keeps rows at their wanted order when wanted units arrive out of order", () => {
    expect(layOutRows([10, 2], 2, 0, 20)).toEqual([10, 2]);
  });

  it("pulls back rows that would run past the end, moving those above them up", () => {
    expect(layOutRows([18, 18, 18], 2, 0, 20)).toEqual([14, 16, 18]);
  });

  it("never starts a row before the first unit", () => {
    expect(layOutRows([-10, -5], 2, 0, 20)).toEqual([0, 2]);
  });

  it("keeps every row inside the area when the rows cannot all fit", () => {
    // Four rows of two units in a five-unit area: they overlap, but none starts above 0.
    const starts = layOutRows([0, 0, 0, 0], 2, 0, 5);
    expect(starts.every((start) => start >= 0 && start <= 3)).toBe(true);
  });

  it("keeps a zero-height area from placing any row above the first unit", () => {
    expect(layOutRows([5], 2, 0, 0)).toEqual([0]);
  });
});

describe("layOutRows with a height for each row", () => {
  it("keeps a tall row clear of the row after it", () => {
    // A wrapped note of four units, then a note that wanted the unit right below its first line.
    expect(layOutRows([5, 7], [4, 2], 0, 20)).toEqual([5, 9]);
  });

  it("pulls a tall row back so it ends inside the area", () => {
    expect(layOutRows([18, 19], [4, 2], 0, 20)).toEqual([14, 18]);
  });
});

describe("doneLayoutByRows", () => {
  it("shows every todo when their rows fit", () => {
    expect(doneLayoutByRows([1, 2, 1], 6 * 10, 10)).toEqual({ shown: 3, more: false });
  });

  it("counts the rows a wrapped todo takes, and stops at the first one that does not fit", () => {
    // Eight rows: the label and "+N more" take two, leaving six. 1 + 3 fit, and the next, of 3, does not.
    expect(doneLayoutByRows([1, 3, 3, 1], 8 * 10, 10)).toEqual({ shown: 2, more: true });
  });

  it("matches doneLayout when every todo takes one row", () => {
    expect(doneLayoutByRows([1, 1, 1, 1, 1], 5 * 10, 10)).toEqual(doneLayout(5, 5 * 10, 10));
  });
});

describe("layOutRows and doneLayoutByRows, edges", () => {
  it("returns no rows for no notes, and treats a number and a matching list alike", () => {
    expect(layOutRows([], [], 0, 20)).toEqual([]);
    expect(layOutRows([3, 3, 9], 2, 0, 20)).toEqual(layOutRows([3, 3, 9], [2, 2, 2], 0, 20));
  });

  it("keeps rows taller than the area inside it, without throwing", () => {
    const starts = layOutRows([0, 0], [30, 30], 0, 20);
    expect(starts.every((start) => start >= 0)).toBe(true);
  });

  it("handles no todos, a first todo too tall for the room, and an exact fit", () => {
    expect(doneLayoutByRows([], 100, 10)).toEqual({ shown: 0, more: false });
    expect(doneLayoutByRows([5, 1], 50, 10)).toEqual({ shown: 0, more: true });
    expect(doneLayoutByRows([1], 10, 10)).toEqual({ shown: 0, more: false });
    expect(doneLayoutByRows([1, 1, 1], 40, 10)).toEqual({ shown: 3, more: false });
  });
});
