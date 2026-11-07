import { describe, expect, it } from "vitest";
import { colourForLabel, extractTags, parseTagColours } from "../src/logic/tags";

describe("extractTags", () => {
  it("finds tags in a label, lowercased and in order", () => {
    expect(extractTags("Email #Work #quick-win")).toEqual(["work", "quick-win"]);
  });

  it("finds nothing in a label without tags", () => {
    expect(extractTags("Plain label")).toEqual([]);
  });

  it("does not treat a hash inside a word as a tag", () => {
    expect(extractTags("issue#42 fixed")).toEqual([]);
  });
});

describe("parseTagColours", () => {
  it("reads tag and colour pairs, one per line", () => {
    expect(parseTagColours("work #8be9fd\ndeep #FF79C6")).toEqual({
      work: "#8be9fd",
      deep: "#ff79c6",
    });
  });

  it("accepts a leading # on the tag name", () => {
    expect(parseTagColours("#work #8be9fd")).toEqual({ work: "#8be9fd" });
  });

  it("ignores lines that are malformed", () => {
    expect(parseTagColours("work\nwork #abc\nwork red\n\ndeep #ff79c6 extra")).toEqual({});
  });
});

describe("colourForLabel", () => {
  const colours = { work: "#8be9fd", deep: "#ff79c6" };

  it("uses the colour of the tag in the label", () => {
    expect(colourForLabel("Email #work", colours)).toBe("#8be9fd");
  });

  it("uses the first tag that has a colour", () => {
    expect(colourForLabel("Draft #unknown #deep #work", colours)).toBe("#ff79c6");
  });

  it("returns null when no tag has a colour", () => {
    expect(colourForLabel("Lunch #food", colours)).toBeNull();
    expect(colourForLabel("Lunch", colours)).toBeNull();
  });
});
