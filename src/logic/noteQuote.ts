import { dateKey, loadDailyQuote, QuoteSource, QuoteStore, StoredQuote, storedQuoteFor } from "./quoteCache";

export interface NoteQuoteInput {
  store: QuoteStore;
  /** The fetch for today's quote, or null when fetching is off. */
  source: QuoteSource | null;
  /** The day the note is for. */
  noteDay: Date;
  /** True when the note's path names its day, so today's note is the one a fetch belongs to. */
  namedByPath: boolean;
  now: Date;
  draw: (quote: StoredQuote | null) => void;
  /** False once the note has been left, so a late fetch does not draw into a page that is gone. */
  stillShown: () => boolean;
}

/**
 * Draws the note's quote at once, from the quote kept for the note's own day. Only today's note can fetch:
 * an earlier day's quote cannot be fetched again, so it shows what was kept. A note whose day came only from
 * its creation time, not its path, is not treated as today's note, so it never fetches.
 */
export async function drawNoteQuote(input: NoteQuoteInput): Promise<void> {
  const { store, source, noteDay, namedByPath, now, draw, stillShown } = input;
  const cached = storedQuoteFor(store, noteDay);
  draw(cached);
  const isToday = namedByPath && dateKey(noteDay) === dateKey(now);
  if (!isToday) return;
  const quote = await loadDailyQuote(store, source, now);
  if (quote !== cached && stillShown()) draw(quote);
}
