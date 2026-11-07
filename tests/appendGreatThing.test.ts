import { describe, expect, it } from "vitest";
import { appendGreatThing } from "../src/entries/edit";
import { readGreatThings } from "../src/render/greatThings";

describe("appendGreatThing", () => {
  it("adds a bullet after the ones already in the Three things box", () => {
    const scope = ["## Timeline", "- 09:00- Email", "", "## Three things", "- Walk"];
    const result = appendGreatThing(scope, "Call Mum");
    expect(result.ok && result.lines).toEqual([
      "## Timeline",
      "- 09:00- Email",
      "",
      "## Three things",
      "- Walk",
      "- Call Mum",
    ]);
  });

  it("creates the Three things section when the block has none", () => {
    const result = appendGreatThing(["## Timeline", "- 09:00- Email"], "Walk");
    expect(result.ok && result.lines).toEqual(["## Timeline", "- 09:00- Email", "## Three things", "- Walk"]);
  });

  it("adds the first bullet straight after an empty Three things heading", () => {
    const result = appendGreatThing(["## Three things", ""], "Walk");
    expect(result.ok && result.lines).toEqual(["## Three things", "- Walk", ""]);
  });

  it("refuses a fourth bullet and leaves the box unchanged", () => {
    const full = ["## Three things", "- One", "- Two", "- Three"];
    const result = appendGreatThing(full, "Four");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("already has 3");
  });

  it("does not count blank bullets towards the three", () => {
    const scope = ["## Three things", "- ", "- One", "- Two"];
    const result = appendGreatThing(scope, "Three");
    expect(result.ok && result.lines).toContain("- Three");
  });

  it("collapses whitespace and refuses empty text", () => {
    expect(appendGreatThing(["## Three things"], "  Buy\n milk  ")).toEqual({
      ok: true,
      lines: ["## Three things", "- Buy milk"],
    });
    expect(appendGreatThing(["## Three things"], "   ").ok).toBe(false);
  });

  it("the new bullet is read back by the box", () => {
    const result = appendGreatThing(["## Three things", "- Walk"], "Call Mum");
    expect(result.ok && readGreatThings(result.lines).map((item) => item.text)).toEqual(["Walk", "Call Mum"]);
  });
});
