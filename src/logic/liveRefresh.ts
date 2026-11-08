/**
 * Whether a note's text has an activity still running, such as "- 10:00- Draft". Only then does the page
 * change as the minutes pass, so only then does it need drawing again on a timer.
 */
export function hasRunningActivity(text: string): boolean {
  return /^- \d{1,2}:\d{2}-(?!\d)/m.test(text);
}

/** How often a page with a running activity is drawn again, so its block keeps up with the clock. */
export const REFRESH_MS = 60_000;
