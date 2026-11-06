import type { QuoteSource } from "./logic/quoteCache";

/**
 * The footer quote source. It stays null until a provider is chosen and vetted for
 * reliability, display licence, rate limits, and attribution. With null, the page shows
 * the most recent cached quote, or no quote at all.
 */
export const QUOTE_SOURCE: QuoteSource | null = null;
