import { describe, expect, it } from "vitest";
import { editGreatThing } from "../src/entries/edit";

const scope = ["## Timeline", "- 09:00- Email", "## Three things", "- Finish the draft", "- Walk", "- Call Mum"];

describe("editGreatThing", () => {
  it("changes the text of the bullet that was clicked and keeps the others", () => {
    const result = editGreatThing(scope, { raw: "- Walk", index: 1 }, "Walk the dog");
    expect(result.ok && result.lines).toEqual([
      "## Timeline",
      "- 09:00- Email",
      "## Three things",
      "- Finish the draft",
      "- Walk the dog",
      "- Call Mum",
    ]);
  });

  it("removes the bullet when the text is left blank", () => {
    const result = editGreatThing(scope, { raw: "- Walk", index: 1 }, "   ");
    expect(result.ok && result.lines).toEqual([
      "## Timeline",
      "- 09:00- Email",
      "## Three things",
      "- Finish the draft",
      "- Call Mum",
    ]);
  });

  it("collapses whitespace in the new text", () => {
    const result = editGreatThing(scope, { raw: "- Call Mum", index: 2 }, "  Call\n  Mum tonight ");
    expect(result.ok && result.lines[5]).toBe("- Call Mum tonight");
  });

  it("refuses when the bullet has changed since it was shown", () => {
    const result = editGreatThing(scope, { raw: "- Gone", index: 1 }, "x");
    expect(result.ok).toBe(false);
  });

  it("refuses when there is no Three things section", () => {
    expect(editGreatThing(["## Timeline"], { raw: "- Walk", index: 0 }, "x").ok).toBe(false);
  });

  it("changes the right line when two bullets have the same text", () => {
    const duplicates = ["## Three things", "- Walk", "- Walk"];
    const result = editGreatThing(duplicates, { raw: "- Walk", index: 1 }, "Run");
    expect(result.ok && result.lines).toEqual(["## Three things", "- Walk", "- Run"]);
  });
});
