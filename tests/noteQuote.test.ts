import { describe, expect, it, vi } from "vitest";
import { drawNoteQuote } from "../src/logic/noteQuote";
import { QuoteSource, QuoteStore, StoredQuote } from "../src/logic/quoteCache";

const now = new Date(2026, 10, 7, 9, 0);
const earlierDay = new Date(2026, 10, 5, 12, 0);
const kept: StoredQuote = { date: "2026-11-05", text: "Kept line", author: "Someone" };
const todayQuote: StoredQuote = { date: "2026-11-07", text: "Today's line", author: "Author" };

function store(initial: StoredQuote[] = []): QuoteStore & { set: ReturnType<typeof vi.fn> } {
  const byDay = new Map(initial.map((quote) => [quote.date, quote]));
  return {
    get: (day) => byDay.get(day) ?? null,
    set: vi.fn(async (quote: StoredQuote) => {
      byDay.set(quote.date, quote);
    }),
  };
}

function fetching(): QuoteSource & { fetchQuote: ReturnType<typeof vi.fn> } {
  return { fetchQuote: vi.fn(async () => ({ text: "Today's line", author: "Author" })) };
}

describe("drawNoteQuote", () => {
  it("does not fetch for an earlier day with no kept quote, and draws nothing", async () => {
    const src = fetching();
    const s = store([kept]);
    const draw = vi.fn();
    await drawNoteQuote({ store: s, source: src, noteDay: new Date(2026, 10, 4, 12), namedByPath: true, now, draw, stillShown: () => true });
    expect(draw.mock.calls).toEqual([[null]]);
    expect(src.fetchQuote).not.toHaveBeenCalled();
    expect(s.set).not.toHaveBeenCalled();
  });

  it("shows the quote kept for an earlier day, without fetching", async () => {
    const src = fetching();
    const draw = vi.fn();
    await drawNoteQuote({ store: store([kept]), source: src, noteDay: earlierDay, namedByPath: true, now, draw, stillShown: () => true });
    expect(draw.mock.calls).toEqual([[kept]]);
    expect(src.fetchQuote).not.toHaveBeenCalled();
  });

  it("draws today's kept quote straight away, without fetching again", async () => {
    const src = fetching();
    const draw = vi.fn();
    await drawNoteQuote({ store: store([todayQuote]), source: src, noteDay: now, namedByPath: true, now, draw, stillShown: () => true });
    expect(draw.mock.calls).toEqual([[todayQuote]]);
    expect(src.fetchQuote).not.toHaveBeenCalled();
  });

  it("draws the page without a quote before the fetch resolves, then redraws when it arrives", async () => {
    let finish!: (value: { text: string; author: string }) => void;
    const src: QuoteSource = { fetchQuote: () => new Promise((resolve) => { finish = resolve; }) };
    const draw = vi.fn();
    const done = drawNoteQuote({ store: store(), source: src, noteDay: now, namedByPath: true, now, draw, stillShown: () => true });
    expect(draw.mock.calls).toEqual([[null]]);
    finish({ text: "Today's line", author: "Author" });
    await done;
    expect(draw.mock.calls).toEqual([[null], [{ date: "2026-11-07", text: "Today's line", author: "Author" }]]);
  });

  it("does not fetch for a note whose day came only from its creation time, even when that is today", async () => {
    const src = fetching();
    const draw = vi.fn();
    await drawNoteQuote({ store: store(), source: src, noteDay: now, namedByPath: false, now, draw, stillShown: () => true });
    expect(src.fetchQuote).not.toHaveBeenCalled();
    expect(draw.mock.calls).toEqual([[null]]);
  });

  it("does not draw a late quote into a page that has been left", async () => {
    const src = fetching();
    const draw = vi.fn();
    await drawNoteQuote({ store: store(), source: src, noteDay: now, namedByPath: true, now, draw, stillShown: () => false });
    expect(draw.mock.calls).toEqual([[null]]);
  });
});
