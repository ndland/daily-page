export interface StoredQuote {
  /** Local calendar date the quote was fetched for, as YYYY-MM-DD. */
  date: string;
  text: string;
  author: string;
}

export interface QuoteSource {
  fetchQuote(): Promise<{ text: string; author: string }>;
}

export interface QuoteStore {
  get(): StoredQuote | null;
  set(quote: StoredQuote): Promise<void>;
}

/** Local calendar date as YYYY-MM-DD. */
export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** True when the cached quote is from `today` and no fetch is needed. */
export function isFreshForDay(cache: StoredQuote | null, today: Date): boolean {
  return cache !== null && cache.date === dateKey(today);
}

/**
 * Returns the quote to show. The source is asked only when no quote for today is cached. If the
 * request fails, or the new quote cannot be stored, the most recent cached quote is shown; with no
 * cache, nothing is shown. A failed request is not retried by this function. The source itself
 * limits how often it really asks (see throttle.ts), so an outage costs one request per interval,
 * not one per render.
 */
export async function loadDailyQuote(
  store: QuoteStore,
  source: QuoteSource | null,
  today: Date,
): Promise<StoredQuote | null> {
  const cached = store.get();
  if (isFreshForDay(cached, today) || source === null) {
    return cached;
  }

  try {
    const fetched = await source.fetchQuote();
    const quote: StoredQuote = { date: dateKey(today), text: fetched.text, author: fetched.author };
    await store.set(quote);
    return quote;
  } catch {
    return cached;
  }
}
