import { describe, expect, it, vi } from "vitest";
import { StoredQuote, QuoteSource, QuoteStore, isFreshForDay, loadDailyQuote } from "../src/logic/quoteCache";

const today = new Date(2026, 10, 6, 9, 0);
const yesterdayQuote: StoredQuote = { date: "2026-11-05", text: "Old line", author: "Someone" };
const todayQuote: StoredQuote = { date: "2026-11-06", text: "Fresh line", author: "Someone Else" };

/** An in-memory store, so tests do not touch plugin data. */
function memoryStore(initial: StoredQuote | null): QuoteStore & { saved: StoredQuote[] } {
  let current = initial;
  const saved: StoredQuote[] = [];
  return {
    saved,
    get: () => current,
    set: async (quote) => {
      current = quote;
      saved.push(quote);
    },
  };
}

function source(text: string): QuoteSource & { fetchQuote: ReturnType<typeof vi.fn> } {
  return {
    fetchQuote: vi.fn(async () => ({ text, author: "Author" })),
  };
}

describe("isFreshForDay", () => {
  it("is true only for a quote from the same local day", () => {
    expect(isFreshForDay(todayQuote, today)).toBe(true);
    expect(isFreshForDay(yesterdayQuote, today)).toBe(false);
    expect(isFreshForDay(null, today)).toBe(false);
  });
});

describe("loadDailyQuote", () => {
  it("fetches once per day and reuses the cache on later loads", async () => {
    const store = memoryStore(null);
    const src = source("Hello");

    const first = await loadDailyQuote(store, src, today);
    const second = await loadDailyQuote(store, src, today);

    expect(first?.text).toBe("Hello");
    expect(second?.text).toBe("Hello");
    expect(src.fetchQuote).toHaveBeenCalledTimes(1);
  });

  it("fetches again on a new day", async () => {
    const store = memoryStore(yesterdayQuote);
    const src = source("New day");

    const quote = await loadDailyQuote(store, src, today);

    expect(quote?.text).toBe("New day");
    expect(quote?.date).toBe("2026-11-06");
    expect(src.fetchQuote).toHaveBeenCalledTimes(1);
  });

  it("falls back to the most recent cached quote when the fetch fails", async () => {
    const store = memoryStore(yesterdayQuote);
    const failing: QuoteSource = {
      fetchQuote: async () => {
        throw new Error("offline");
      },
    };

    const quote = await loadDailyQuote(store, failing, today);

    expect(quote).toEqual(yesterdayQuote);
    expect(store.saved).toEqual([]);
  });

  it("shows nothing, without an error, when offline with no cache", async () => {
    const store = memoryStore(null);
    const failing: QuoteSource = {
      fetchQuote: async () => {
        throw new Error("offline");
      },
    };

    await expect(loadDailyQuote(store, failing, today)).resolves.toBeNull();
  });

  it("uses the cache and never fetches when no source is configured", async () => {
    const store = memoryStore(yesterdayQuote);
    await expect(loadDailyQuote(store, null, today)).resolves.toEqual(yesterdayQuote);
    expect(store.saved).toEqual([]);
  });
});
