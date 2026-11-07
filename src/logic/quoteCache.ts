export interface StoredQuote {
  /** Local calendar date the quote belongs to, as YYYY-MM-DD. */
  date: string;
  text: string;
  author: string;
}

export interface QuoteSource {
  fetchQuote(): Promise<{ text: string; author: string }>;
}

/**
 * Quotes stored by day. Each day keeps the quote fetched on that day, so a note shows its own quote and
 * an earlier day never takes on a later day's quote.
 */
export interface QuoteStore {
  /** The quote stored for a day, as YYYY-MM-DD, or null when none was stored for that day. */
  get(day: string): StoredQuote | null;
  set(quote: StoredQuote): Promise<void>;
}

/** How many days of quotes are kept. Older days are dropped, so the saved settings stay small. */
export const KEEP_QUOTE_DAYS = 400;

/** Local calendar date as YYYY-MM-DD. */
export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The quote stored for the day a note is for, or null. Never fetches: an earlier day cannot be fetched. */
export function storedQuoteFor(store: QuoteStore, day: Date): StoredQuote | null {
  return store.get(dateKey(day));
}

/** The quote kept for a day, from the quotes saved in the plugin's settings, or null. */
export function storedQuoteFromSettings(quotes: Record<string, StoredQuote> | undefined, day: Date): StoredQuote | null {
  return quotes?.[dateKey(day)] ?? null;
}

/** The quotes without any day older than the kept window. Day keys are ISO dates, so they compare as text. */
export function pruneQuotes(quotes: Record<string, StoredQuote>, today: Date, keepDays = KEEP_QUOTE_DAYS): Record<string, StoredQuote> {
  const oldest = new Date(today.getFullYear(), today.getMonth(), today.getDate() - keepDays);
  const cutoff = dateKey(oldest);
  const kept: Record<string, StoredQuote> = {};
  for (const [day, quote] of Object.entries(quotes)) {
    if (day >= cutoff) kept[day] = quote;
  }
  return kept;
}

/** The request for each day that is being fetched now, per store, so concurrent loads share one request. */
const inFlight = new WeakMap<QuoteStore, Map<string, Promise<StoredQuote | null>>>();

/** Asks the source for a day's quote, and keeps it. A failed request gives null; a failed save still shows it. */
async function fetchAndStore(store: QuoteStore, source: QuoteSource, day: string): Promise<StoredQuote | null> {
  let fetched: { text: string; author: string };
  try {
    fetched = await source.fetchQuote();
  } catch {
    return null;
  }
  const quote: StoredQuote = { date: day, text: fetched.text, author: fetched.author };
  try {
    await store.set(quote);
  } catch {
    // The quote is still shown, even if it could not be kept for next time.
  }
  return quote;
}

/**
 * The quote for today. A quote stored for today is returned as it is. Otherwise the source is asked once,
 * and the answer is stored under today's date. Loads that start before that answer arrives share it, so every
 * one of them shows the same quote. If the request fails there is nothing to show for today, so null is
 * returned. The source itself limits how often it really asks (see throttle.ts), so an outage costs one
 * request per interval, not one per render.
 */
export async function loadDailyQuote(
  store: QuoteStore,
  source: QuoteSource | null,
  today: Date,
): Promise<StoredQuote | null> {
  const day = dateKey(today);
  const stored = store.get(day);
  if (stored !== null || source === null) return stored;

  let pending = inFlight.get(store)?.get(day);
  if (!pending) {
    const requests = inFlight.get(store) ?? new Map<string, Promise<StoredQuote | null>>();
    inFlight.set(store, requests);
    pending = fetchAndStore(store, source, day);
    requests.set(day, pending);
    void pending.then(() => requests.delete(day));
  }
  return pending;
}
