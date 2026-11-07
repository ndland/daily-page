import { requestUrl } from "obsidian";
import { ZEN_QUOTES_TODAY_URL, parseZenQuote } from "./logic/zenquotes";
import { throttled } from "./logic/throttle";
import type { QuoteSource } from "./logic/quoteCache";

/** At most one attempt every 15 minutes, so an outage cannot exhaust the 5-requests-per-30-seconds limit. */
const MIN_ATTEMPT_INTERVAL_MS = 15 * 60 * 1000;

/** A request that has not answered by then is given up on. The cached quote stays on the page. */
const REQUEST_TIMEOUT_MS = 5000;

/** A real reply is a few hundred bytes. Anything far larger is not the quote, so it is refused. */
const MAX_RESPONSE_LENGTH = 4096;

/** Rejects after `ms`, so a stalled request cannot hold the footer's update forever. */
export function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("ZenQuotes: request timed out")), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/**
 * A ZenQuotes source for the footer. It uses Obsidian's request API, which is not subject to
 * the browser CORS restriction that ZenQuotes documents for browser use.
 */
export const zenQuotesSource: QuoteSource = throttled(
  {
    async fetchQuote() {
      const response = await withTimeout(
        requestUrl({ url: ZEN_QUOTES_TODAY_URL, method: "GET" }),
        REQUEST_TIMEOUT_MS,
      );
      // The reply is checked for size before it is parsed. The request itself still downloads the whole
      // body first, so this bounds what is parsed, not what is received.
      if (response.text.length > MAX_RESPONSE_LENGTH) throw new Error("ZenQuotes: response was too large");
      return parseZenQuote(response.json);
    },
  },
  MIN_ATTEMPT_INTERVAL_MS,
);
