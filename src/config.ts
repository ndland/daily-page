import { zenQuotesSource } from "./quoteSource";
import type { QuoteSource } from "./logic/quoteCache";

/**
 * The footer quote source: ZenQuotes' quote of the day, fetched at most once per day.
 * ZenQuotes' free tier requires attribution, which render/quote.ts shows with each quote.
 * Set to null to turn fetching off; each page then shows only the quote kept for its own day.
 */
export const QUOTE_SOURCE: QuoteSource | null = zenQuotesSource;
