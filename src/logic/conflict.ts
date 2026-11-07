/** Shown instead of writing when a note holds unresolved git merge conflict markers. */
export const CONFLICT_MESSAGE =
  "This note has an unresolved sync conflict (<<<<<<< markers). Resolve it, then try again.";

/**
 * Whether the note holds git conflict markers: an opening `<<<<<<<` line followed later by a closing
 * `>>>>>>>` line. Both are required, so a lone `=======` (a heading underline) or a stray `<<<<<<<` in
 * prose is not mistaken for a conflict.
 */
export function hasConflictMarkers(lines: string[]): boolean {
  const open = lines.findIndex((line) => /^<{7}(\s|$)/.test(line));
  if (open === -1) return false;
  return lines.slice(open + 1).some((line) => /^>{7}(\s|$)/.test(line));
}
