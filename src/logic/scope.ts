const FENCE_OPEN = /^```daily-page\s*$/;
const FENCE_CLOSE = /^```\s*$/;
const PAGE_HEADING = /^## (Timeline|Checklist|Three things|Quote)$/;

/** Shown in place of the page when a note has no complete daily-page block to show or edit. */
export const NO_PAGE_MESSAGE = "This note has no complete daily page, so there is nothing to show or edit. Check its daily-page block.";

/**
 * Finds the first `daily-page` block. Returns the line range of its content, [start, end),
 * or null when the note has no such block.
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
 * Returns the lines the page reads and edits, or null when the note has no page to show or edit.
 *
 * - A block that is opened but never closed gives no page, so nothing is written to the note.
 * - A closed block holds the page. If the block holds no page section, but the note has page
 *   sections outside an empty block, those sections are the page, as they were before the block.
 * - A note with no block at all is an older page, and is the whole note, but only if it has a
 *   Timeline section. Any other note, such as the reader's own notes, is not edited.
 */
export function scopeOf(lines: string[]): { start: number; end: number } | null {
  const opened = lines.some((line) => FENCE_OPEN.test(line));
  const block = findDailyPageBlock(lines);
  if (opened && !block) return null;
  if (block) {
    if (lines.slice(block.start, block.end).some((line) => PAGE_HEADING.test(line.trim()))) return block;
    // Notes from before the block held their sections outside an empty block.
    return lines.some((line) => PAGE_HEADING.test(line.trim())) ? { start: 0, end: lines.length } : block;
  }
  return lines.some((line) => line.trim() === "## Timeline") ? { start: 0, end: lines.length } : null;
}

/** Replaces the edited scope with new lines, leaving the rest of the note as it was. */
export function replaceScope(lines: string[], scope: { start: number; end: number }, next: string[]): string[] {
  return [...lines.slice(0, scope.start), ...next, ...lines.slice(scope.end)];
}
