const FENCE_OPEN = /^```daily-page\s*$/;
const FENCE_CLOSE = /^```\s*$/;
const PAGE_HEADING = /^## (Timeline|Checklist|Three things|Quote)$/;

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
 * Returns the lines the page reads and edits. That is the content of the daily-page block when
 * it holds a page section (Timeline, Checklist, Three things or Quote). Otherwise it is the
 * whole note, so notes written before the block existed still show and edit as before.
 */
export function scopeOf(lines: string[]): { start: number; end: number } {
  const block = findDailyPageBlock(lines);
  if (block && lines.slice(block.start, block.end).some((line) => PAGE_HEADING.test(line.trim()))) {
    return block;
  }
  return { start: 0, end: lines.length };
}

/** Replaces the edited scope with new lines, leaving the rest of the note as it was. */
export function replaceScope(lines: string[], scope: { start: number; end: number }, next: string[]): string[] {
  return [...lines.slice(0, scope.start), ...next, ...lines.slice(scope.end)];
}
