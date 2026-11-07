import type { QuoteSource } from "./quoteCache";

/**
 * Wraps a source so that, after an attempt, it refuses further attempts for `minIntervalMs`.
 * Without this, every render of a note during an outage would call the API again. The
 * refusal is an ordinary error, so the caller falls back to the cached quote.
 */
export function throttled(
  source: QuoteSource,
  minIntervalMs: number,
  clock: () => number = Date.now,
): QuoteSource {
  let lastAttempt: number | null = null;

  return {
    async fetchQuote() {
      const now = clock();
      if (lastAttempt !== null && now - lastAttempt < minIntervalMs) {
        throw new Error("Quote fetch throttled");
      }
      lastAttempt = now;
      return source.fetchQuote();
    },
  };
}
