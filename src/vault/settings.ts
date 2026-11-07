import { DEFAULT_ACCENT, DEFAULT_TAG_COLOURS } from "../defaults";

/**
 * Settings for the vault view. Change them here, then rebuild with `npm run vault`.
 * The defaults are the same values the plugin's settings start from (src/defaults.ts).
 */
export const VIEW_SETTINGS = {
  /** Highlight colour for activity blocks and today's date. */
  accent: DEFAULT_ACCENT,
  /** One "tag #hex" pair per line. */
  tagColours: DEFAULT_TAG_COLOURS,
};
