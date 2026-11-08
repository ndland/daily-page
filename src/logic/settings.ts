import { DEFAULT_ACCENT, DEFAULT_TAG_COLOURS, FIRST_TAG_COLOURS } from "../defaults";
import { DEFAULT_DAILY_PATTERN, isSafeVaultPath } from "./paths";
import type { StoredQuote } from "./quoteCache";

/** The plugin's settings, as saved in data.json. */
export interface DailyPageSettings {
  dailyPattern: string;
  /** Quotes by day, keyed by YYYY-MM-DD. Each day keeps the quote fetched on that day. */
  quotes: Record<string, StoredQuote>;
  /** Highlight colour for activity blocks and today's date in the mini calendar. */
  accentColor: string;
  /** One "tag #hex" pair per line. Activities whose label has the tag use that colour. */
  tagColours: string;
  /** Vault path of a note to copy new daily notes from. Empty uses the built-in content. */
  templatePath: string;
}

export const DEFAULT_SETTINGS: DailyPageSettings = {
  dailyPattern: DEFAULT_DAILY_PATTERN,
  quotes: {},
  accentColor: DEFAULT_ACCENT,
  tagColours: DEFAULT_TAG_COLOURS,
  templatePath: "",
};

/** The longest quote and author the plugin will keep, matching the limits on a fetched quote. */
export const MAX_QUOTE_TEXT = 300;
export const MAX_QUOTE_AUTHOR = 100;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

/** A stored quote that fits the limits, or null for anything else. */
function validQuote(value: unknown): StoredQuote | null {
  if (typeof value !== "object" || value === null) return null;
  const quote = value as Record<string, unknown>;
  if (typeof quote.date !== "string" || !DAY.test(quote.date)) return null;
  if (typeof quote.text !== "string" || quote.text.length === 0 || quote.text.length > MAX_QUOTE_TEXT) return null;
  if (typeof quote.author !== "string" || quote.author.length > MAX_QUOTE_AUTHOR) return null;
  return { date: quote.date, text: quote.text, author: quote.author };
}

export interface NormalisedSettings {
  settings: DailyPageSettings;
  /** True when the saved data still has the single `quote` field, so it should be rewritten. */
  migrated: boolean;
}

/**
 * The settings as loaded from data.json, checked before the plugin uses them. A value that does not fit is
 * replaced by its default, and an invalid quote is dropped, so a synced or hand-edited file cannot put bad
 * data on the page. The single quote of earlier versions moves into the per-day store, but never over a
 * quote the day already has.
 */
export function normaliseSettings(loaded: unknown): NormalisedSettings {
  const raw = (typeof loaded === "object" && loaded !== null ? loaded : {}) as Record<string, unknown>;

  const quotes: Record<string, StoredQuote> = {};
  if (typeof raw.quotes === "object" && raw.quotes !== null) {
    for (const [day, value] of Object.entries(raw.quotes)) {
      const quote = validQuote(value);
      if (quote && quote.date === day) quotes[day] = quote;
    }
  }
  const migrated = "quote" in raw;
  const legacy = validQuote(raw.quote);
  if (legacy && quotes[legacy.date] === undefined) quotes[legacy.date] = legacy;

  const pattern = typeof raw.dailyPattern === "string" && isSafeVaultPath(raw.dailyPattern)
    ? raw.dailyPattern
    : DEFAULT_DAILY_PATTERN;
  const accent = typeof raw.accentColor === "string" && HEX_COLOUR.test(raw.accentColor)
    ? raw.accentColor
    : DEFAULT_ACCENT;
  const saved = typeof raw.tagColours === "string" ? raw.tagColours : DEFAULT_TAG_COLOURS;
  // Colours the reader never changed move up to the current defaults, and are saved that way.
  const upgraded = saved.trim().replace(/\r\n/g, "\n") === FIRST_TAG_COLOURS;
  const tags = upgraded ? DEFAULT_TAG_COLOURS : saved;
  const template = typeof raw.templatePath === "string" && isSafeVaultPath(raw.templatePath) ? raw.templatePath : "";

  return {
    settings: { dailyPattern: pattern, quotes, accentColor: accent, tagColours: tags, templatePath: template },
    migrated: migrated || upgraded,
  };
}
