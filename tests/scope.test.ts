import { describe, expect, it } from "vitest";
import { findDailyPageBlock, replaceScope, scopeOf } from "../src/logic/scope";

const note = [
  "# Friday",
  "",
  "```daily-page",
  "## Timeline",
  "- 09:00- Email",
  "## Checklist",
  "- [ ] Walk",
  "```",
  "",
  "Trailing words",
];

describe("findDailyPageBlock", () => {
  it("returns the range of lines inside the block", () => {
    expect(findDailyPageBlock(note)).toEqual({ start: 3, end: 7 });
  });

  it("returns null when there is no block", () => {
    expect(findDailyPageBlock(["# Plain note", "## Timeline"])).toBeNull();
  });

  it("returns null for an unclosed block", () => {
    expect(findDailyPageBlock(["```daily-page", "## Timeline"])).toBeNull();
  });
});

describe("scopeOf", () => {
  it("uses the block when there is one", () => {
    expect(scopeOf(note)).toEqual({ start: 3, end: 7 });
  });

  it("falls back to the whole note when there is no block", () => {
    expect(scopeOf(["## Timeline", "- 09:00- Email"])).toEqual({ start: 0, end: 2 });
  });

  it("falls back to the whole note when the block holds no page section", () => {
    // Notes from before the block held the data: the sections sit outside an empty fence.
    const legacy = ["```daily-page", "```", "## Timeline", "- 09:00- Email"];
    expect(scopeOf(legacy)).toEqual({ start: 0, end: 4 });
  });

  it("uses the block when it holds only a Three things section", () => {
    const block = ["```daily-page", "## Three things", "- Walk", "```"];
    expect(scopeOf(block)).toEqual({ start: 1, end: 3 });
  });
});

describe("replaceScope", () => {
  it("changes only the scope and keeps the rest of the note", () => {
    const scope = findDailyPageBlock(note)!;
    const next = replaceScope(note, scope, ["## Timeline", "- 09:00-10:00 Email", "## Checklist"]);
    expect(next.slice(0, 3)).toEqual(["# Friday", "", "```daily-page"]);
    expect(next.slice(3, 6)).toEqual(["## Timeline", "- 09:00-10:00 Email", "## Checklist"]);
    expect(next.slice(6)).toEqual(["```", "", "Trailing words"]);
  });
});

describe("scopeOf, when there is no complete page", () => {
  it("gives no page for a block that is opened but never closed", () => {
    expect(scopeOf(["```daily-page", "## Timeline", "- 09:00- Email"])).toBeNull();
  });

  it("does not treat the reader's own checklist as a page", () => {
    expect(scopeOf(["# Shopping", "## Checklist", "- [ ] Milk"])).toBeNull();
  });
});
