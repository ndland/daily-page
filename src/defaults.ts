/**
 * Defaults shared by the plugin and the vault view, so the two show the same colours until the
 * reader changes them. This file imports nothing, so the view bundle stays free of Obsidian.
 */

/** Highlight colour for activity blocks and today's date. */
export const DEFAULT_ACCENT = "#bd93f9";

/**
 * The tag colours the plugin started with. A saved setting that is exactly this was never changed by the reader,
 * so it moves up to the current defaults. Anything else the reader wrote is kept.
 */
export const FIRST_TAG_COLOURS = "work #8be9fd\ndeep #ff79c6";

/** One "tag #hex" pair per line. */
export const DEFAULT_TAG_COLOURS = [
  "work #8be9fd",
  "deep #ff79c6",
  "meeting #ffb86c",
  "admin #f1fa8c",
  "health #50fa7b",
  "family #ff5555",
  "rest #6272a4",
].join("\n");
