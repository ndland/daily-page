import { describe, expect, it } from "vitest";
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
