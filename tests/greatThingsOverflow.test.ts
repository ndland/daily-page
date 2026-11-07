// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readGreatThings, renderGreatThings } from "../src/render/greatThings";

function rowsFor(bullets: string[]): (string | null)[] {
  const parent = document.createElement("div");
  renderGreatThings(parent, readGreatThings(["## Three things", ...bullets]));
  return [...parent.querySelectorAll(".daily-page__great-list li")].map((li) => li.textContent);
}

describe("three things, the rows shown", () => {
  it("shows no more row with three bullets", () => {
    expect(rowsFor(["- One", "- Two", "- Three"])).toEqual(["One", "Two", "Three"]);
  });

  it("shows a '+1 more' row for a fourth bullet", () => {
    expect(rowsFor(["- One", "- Two", "- Three", "- Four"])).toEqual(["One", "Two", "Three", "+1 more"]);
  });
});
