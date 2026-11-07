import { describe, expect, it, vi } from "vitest";
import {
  QuoteSource,
  QuoteStore,
  StoredQuote,
  loadDailyQuote,
  pruneQuotes,
  storedQuoteFor,
  storedQuoteFromSettings,
} from "../src/logic/quoteCache";

const today = new Date(2026, 10, 7, 9, 0);
const YESTERDAY = "2026-11-06";
const TODAY = "2026-11-07";
const yesterdayQuote: StoredQuote = { date: YESTERDAY, text: "Yesterday's line", author: "Someone" };

/** An in-memory store keyed by day, so tests do not touch plugin data. */
function memoryStore(initial: StoredQuote[] = []): QuoteStore & { saved: StoredQuote[] } {
  const byDay = new Map(initial.map((quote) => [quote.date, quote]));
  const saved: StoredQuote[] = [];
  return {
    saved,
    get: (day) => byDay.get(day) ?? null,
    set: async (quote) => {
      byDay.set(quote.date, quote);
      saved.push(quote);
    },
  };
}

function source(text: string): QuoteSource & { fetchQuote: ReturnType<typeof vi.fn> } {
  return { fetchQuote: vi.fn(async () => ({ text, author: "Author" })) };
}

const failing: QuoteSource = {
  fetchQuote: async () => {
    throw new Error("offline");
  },
};

describe("storedQuoteFor and storedQuoteFromSettings", () => {
  it("returns the quote kept for the note's own day", () => {
    expect(storedQuoteFor(memoryStore([yesterdayQuote]), new Date(2026, 10, 6, 12, 0))).toEqual(yesterdayQuote);
  });

  it("returns nothing for a day with no kept quote, rather than another day's quote", () => {
    expect(storedQuoteFor(memoryStore([yesterdayQuote]), new Date(2026, 10, 5, 12, 0))).toBeNull();
  });

  it("reads a kept quote from the settings, and nothing when there are no settings", () => {
    expect(storedQuoteFromSettings({ [YESTERDAY]: yesterdayQuote }, new Date(2026, 10, 6, 9, 0))).toEqual(yesterdayQuote);
    expect(storedQuoteFromSettings(undefined, today)).toBeNull();
    expect(storedQuoteFromSettings({}, today)).toBeNull();
  });
});

describe("pruneQuotes", () => {
  const old: StoredQuote = { date: "2025-09-01", text: "Old", author: "A" };
  const recent: StoredQuote = { date: TODAY, text: "Recent", author: "B" };

  it("drops days older than the kept window and keeps the rest", () => {
    expect(pruneQuotes({ [old.date]: old, [recent.date]: recent }, today, 400)).toEqual({ [recent.date]: recent });
  });

  it("keeps a day exactly at the edge of the window", () => {
    const edge = new Date(2026, 10, 7 - 400);
    const quote: StoredQuote = { date: `${edge.getFullYear()}-${String(edge.getMonth() + 1).padStart(2, "0")}-${String(edge.getDate()).padStart(2, "0")}`, text: "Edge", author: "C" };
    expect(pruneQuotes({ [quote.date]: quote }, today, 400)).toEqual({ [quote.date]: quote });
  });
});

describe("loadDailyQuote", () => {
  it("fetches today's quote once, and reuses it on later loads", async () => {
    const store = memoryStore();
    const src = source("Hello");

    const first = await loadDailyQuote(store, src, today);
    const second = await loadDailyQuote(store, src, today);

    expect(first?.text).toBe("Hello");
    expect(second?.text).toBe("Hello");
    expect(src.fetchQuote).toHaveBeenCalledTimes(1);
  });

  it("fetches today's quote when only yesterday's is kept, and keeps yesterday's as it was", async () => {
    const store = memoryStore([yesterdayQuote]);
    const quote = await loadDailyQuote(store, source("New day"), today);

    expect(quote).toEqual({ date: TODAY, text: "New day", author: "Author" });
    expect(store.get(YESTERDAY)).toEqual(yesterdayQuote);
    expect(store.get(TODAY)).toEqual(quote);
  });

  it("shows nothing for today when the fetch fails, rather than yesterday's quote", async () => {
    const store = memoryStore([yesterdayQuote]);
    await expect(loadDailyQuote(store, failing, today)).resolves.toBeNull();
    expect(store.saved).toEqual([]);
  });

  it("shows nothing, without an error, when offline with no quote for today", async () => {
    await expect(loadDailyQuote(memoryStore(), failing, today)).resolves.toBeNull();
  });

  it("never fetches when no source is configured, and returns only today's kept quote", async () => {
    const store = memoryStore([yesterdayQuote]);
    await expect(loadDailyQuote(store, null, today)).resolves.toBeNull();
    await expect(loadDailyQuote(store, null, new Date(2026, 10, 6, 9, 0))).resolves.toEqual(yesterdayQuote);
  });

  it("asks the source again on the next load after a failure, since the source limits the rate", async () => {
    const src = { fetchQuote: vi.fn(async () => Promise.reject(new Error("offline"))) };
    const store = memoryStore();
    await loadDailyQuote(store, src, today);
    await loadDailyQuote(store, src, today);
    expect(src.fetchQuote).toHaveBeenCalledTimes(2);
  });

  it("makes one request for two loads that start together, and both show the same quote", async () => {
    const { throttled } = await import("../src/logic/throttle");
    const inner = source("Shared line");
    const limited = throttled(inner, 15 * 60 * 1000);
    const store = memoryStore();

    const [first, second] = await Promise.all([
      loadDailyQuote(store, limited, today),
      loadDailyQuote(store, limited, today),
    ]);

    expect(inner.fetchQuote).toHaveBeenCalledTimes(1);
    expect(first?.text).toBe("Shared line");
    expect(second).toEqual(first);
  });

  it("still shows the fetched quote when it cannot be kept", async () => {
    const store = memoryStore();
    store.set = async () => {
      throw new Error("settings are read-only");
    };
    const quote = await loadDailyQuote(store, source("Kept on screen"), today);
    expect(quote?.text).toBe("Kept on screen");
  });
});
