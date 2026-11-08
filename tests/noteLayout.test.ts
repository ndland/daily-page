import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { noteRows } from "../src/render/fit";

describe("noteRows", () => {
  it("gives a one-line note two rows: its text and a gap, as when notes had a two-row line height", () => {
    expect(noteRows(20, 20)).toBe(2);
  });

  it("gives a wrapped note one row per line, and one row of gap below", () => {
    expect(noteRows(40, 20)).toBe(3);
    expect(noteRows(60, 20)).toBe(4);
  });

  it("counts a partly filled line as a line", () => {
    expect(noteRows(41, 20)).toBe(4);
  });

  it("treats a note that cannot be measured as one line", () => {
    expect(noteRows(0, 20)).toBe(2);
  });
});

/** The declarations of the first rule with exactly this selector. */
function rule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

describe("line height of text that can wrap", () => {
  const css = readFileSync("styles/daily-page.css", "utf8").replace(/\r\n/g, "\n");

  // Two grid units per line looked right for one line and left a blank row between every wrapped line.
  it("is one grid unit per line for side notes", () => {
    expect(rule(css, ".daily-page__note")).toContain("line-height: var(--dp-dot-size);");
  });

  it("is one grid unit per line for the Three things title and hint, with half a unit above and below", () => {
    for (const selector of [".daily-page .daily-page__great-title", ".daily-page .daily-page__great-hint"]) {
      const declarations = rule(css, selector);
      expect(declarations, selector).toContain("line-height: var(--dp-dot-size);");
      expect(declarations, selector).toContain("padding: calc(var(--dp-dot-size) / 2) 0;");
    }
  });
});
