/** ZenQuotes' quote of the day. Free use requires attribution; see render/quote.ts. */
export const ZEN_QUOTES_TODAY_URL = "https://zenquotes.io/api/today";

export interface FetchedQuote {
  text: string;
  author: string;
}

/**
 * Reads the ZenQuotes response. The entry has `q` (quote) and `a` (author). It may arrive
 * as a single object or as a one-item array, so both shapes are accepted. Anything else is
 * rejected, so a changed API cannot put junk on the page.
 */
export function parseZenQuote(body: unknown): FetchedQuote {
  const entry = Array.isArray(body) ? body[0] : body;
  if (typeof entry !== "object" || entry === null) {
    throw new Error("ZenQuotes: unexpected response shape");
  }
  const fields = entry as Record<string, unknown>;
  const text = typeof fields.q === "string" ? fields.q.trim() : "";
  const author = typeof fields.a === "string" ? fields.a.trim() : "";
  if (!text) {
    throw new Error("ZenQuotes: response had no quote text");
  }
  // A quote that is far longer than any real one is refused, not cut short, so the cached quote
  // stays on the page instead of a clipped one. The stored settings stay small too.
  if (text.length > MAX_QUOTE_LENGTH || author.length > MAX_AUTHOR_LENGTH) {
    throw new Error("ZenQuotes: response was longer than expected");
  }
  return { text, author: author || "Unknown" };
}

const MAX_QUOTE_LENGTH = 300;
const MAX_AUTHOR_LENGTH = 100;
