import { describe, expect, it } from "vitest";
import { parseZenQuote } from "../src/logic/zenquotes";

describe("parseZenQuote", () => {
  it("reads the quote and author from the first item", () => {
    const body = [{ q: "Keep going.", a: "Someone", h: "<blockquote>Keep going.</blockquote>" }];
    expect(parseZenQuote(body)).toEqual({ text: "Keep going.", author: "Someone" });
  });

  it("also accepts a single object, as the live endpoint returns", () => {
    expect(parseZenQuote({ q: "Doubts limit.", a: "Robert Kiyosaki", h: "<blockquote/>" })).toEqual({
      text: "Doubts limit.",
      author: "Robert Kiyosaki",
    });
  });

  it("uses a placeholder when the author is missing", () => {
    expect(parseZenQuote([{ q: "Anonymous words." }]).author).toBe("Unknown");
  });

  it("rejects responses that are neither an object nor an array", () => {
    expect(() => parseZenQuote("<html>error</html>")).toThrow();
    expect(() => parseZenQuote(null)).toThrow();
  });

  it("rejects an empty array", () => {
    expect(() => parseZenQuote([])).toThrow();
  });

  it("rejects an item with no quote text", () => {
    expect(() => parseZenQuote([{ a: "Someone" }])).toThrow();
    expect(() => parseZenQuote([{ q: "   ", a: "Someone" }])).toThrow();
  });
});

describe("parseZenQuote, length", () => {
  it("refuses a quote far longer than any real one, so a clipped quote is never shown", () => {
    expect(() => parseZenQuote([{ q: "x".repeat(301), a: "Someone" }])).toThrow("longer than expected");
  });

  it("refuses an author name far longer than any real one", () => {
    expect(() => parseZenQuote([{ q: "Short.", a: "y".repeat(101) }])).toThrow("longer than expected");
  });
});
