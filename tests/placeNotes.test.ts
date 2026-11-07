// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { placeNotes } from "../src/render/fit";

const UNIT = 10;

/**
 * A page with a timeline (1000px tall, starting at the window's top) and a notes area that starts
 * 100px down, 800px tall. One timed note is added for each percentage in `topPcts`.
 */
function pageWithNotes(topPcts: number[], areaHeight = 800): HTMLElement[] {
  const page = document.createElement("div");
  page.className = "daily-page";

  const axis = document.createElement("div");
  axis.className = "daily-page__timeline";
  Object.defineProperty(axis, "clientHeight", { value: 1000 });
  axis.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  page.appendChild(axis);

  const area = document.createElement("div");
  area.className = "daily-page__notes-area";
  Object.defineProperty(area, "clientHeight", { value: areaHeight });
  area.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
  page.appendChild(area);

  const notes = topPcts.map((pct) => {
    const note = document.createElement("div");
    note.className = "daily-page__note";
    note.dataset.topPct = String(pct);
    area.appendChild(note);
    return note;
  });

  document.body.appendChild(page);
  placeNotes(page, UNIT);
  return notes;
}

describe("placeNotes", () => {
  it("places a note at its time on the axis, measured from the top of the notes area", () => {
    // 50% of the axis is 500px down the window; the area starts 100px down, so 400px into it.
    const [note] = pageWithNotes([50]);
    expect(note.style.top).toBe("400px");
  });

  it("moves notes whose time falls under the Three things box down to the top of the notes area", () => {
    const notes = pageWithNotes([0, 5]);
    // Both times sit above the area. The first takes its top, the second clears it.
    expect(notes.map((note) => note.style.top)).toEqual(["0px", "20px"]);
  });

  it("keeps a note near the bottom inside the notes area", () => {
    const [note] = pageWithNotes([100]);
    // The area holds 80 grid units, and a note is two units tall, so its top is at most 78.
    expect(note.style.top).toBe("780px");
  });

  it("keeps every note inside a zero-height notes area, at or below the top of the area", () => {
    const notes = pageWithNotes([0, 50, 100], 0);
    for (const note of notes) {
      expect(parseFloat(note.style.top)).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps each note at its own time when they are listed out of time order", () => {
    const [later, earlier] = pageWithNotes([50, 20]);
    expect(later.style.top).toBe("400px");
    expect(earlier.style.top).toBe("100px");
  });
});
