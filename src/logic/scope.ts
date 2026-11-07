const FENCE_OPEN = /^```daily-page\s*$/;
const FENCE_CLOSE = /^```\s*$/;

/** Shown in place of the page when a note has no complete daily-page block to show or edit. */
export const NO_PAGE_MESSAGE = "This note has no complete daily page, so there is nothing to show or edit. Check its daily-page block.";

/**
 * Finds the first `daily-page` block. Returns the line range of its content, [start, end),
 * or null when the note has no such block, or when the block is opened but never closed.
 */
export function findDailyPageBlock(lines: string[]): { start: number; end: number } | null {
  const open = lines.findIndex((line) => FENCE_OPEN.test(line));
  if (open === -1) return null;
  for (let i = open + 1; i < lines.length; i++) {
    if (FENCE_CLOSE.test(lines[i])) return { start: open + 1, end: i };
  }
  return null;
}

/**
 * How many `daily-page` blocks the note has. The page edits the first one, so a second block
 * would show the same page without being editable on its own. The plugin reports that instead.
 */
export function countDailyPageBlocks(lines: string[]): number {
  return lines.filter((line) => FENCE_OPEN.test(line)).length;
}

/**
 * Returns the lines the page reads and edits, or null when there is no page to show or edit.
 *
 * The page is the content of a closed `daily-page` block, and only that. Edits never reach text
 * outside the block, so a note's own headings and lists are never changed. An empty closed block is
 * still a page, and sections added to it are created inside it. A note with no block, or with a block
 * that is opened but never closed, has no page, so nothing is written to it.
 */
export function scopeOf(lines: string[]): { start: number; end: number } | null {
  return findDailyPageBlock(lines);
}

/** Replaces the edited scope with new lines, leaving the rest of the note as it was. */
export function replaceScope(lines: string[], scope: { start: number; end: number }, next: string[]): string[] {
  return [...lines.slice(0, scope.start), ...next, ...lines.slice(scope.end)];
}
