/** The A6 page's height in millimetres, and the grid unit on that page. */
const PAGE_HEIGHT_MM = 148;
const GRID_UNIT_MM = 3;

/**
 * The grid unit in whole pixels, for a page of the given content height. The paper's 3 mm grid on
 * a 148 mm page is 3/148 of the height. Rounding to whole pixels keeps every line on a pixel
 * boundary, so the grid looks even at any window size.
 */
export function gridUnitPx(contentHeightPx: number): number {
  return Math.max(6, Math.round((contentHeightPx * GRID_UNIT_MM) / PAGE_HEIGHT_MM));
}

/** Pixel offsets of the grid lines across a length: 0, one unit, two units, and so on, up to the length. */
export function gridLinePositions(lengthPx: number, unitPx: number): number[] {
  const lines: number[] = [];
  for (let at = 0; at <= lengthPx; at += unitPx) lines.push(at);
  return lines;
}

/**
 * Places rows that are `height` units tall. Each row starts as near its wanted unit as it can,
 * without overlapping another row, and inside [first, end). Rows keep their order in time. A row
 * that would fall past `end` is pulled back, and the rows above it move up with it. Returns each
 * row's start unit, in the same order as `wanted`.
 */
export function layOutRows(wanted: number[], height: number, first: number, end: number): number[] {
  const order = wanted.map((_, i) => i).sort((a, b) => wanted[a] - wanted[b] || a - b);
  const starts: number[] = new Array(wanted.length);

  // Push each row down until it clears the one before it.
  let previousEnd = first;
  for (const i of order) {
    starts[i] = Math.max(wanted[i], previousEnd);
    previousEnd = starts[i] + height;
  }

  // Pull back any row that runs past the end, from the bottom up. When the rows cannot all fit,
  // they overlap, but none starts above `first`.
  let limit = end - height;
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k];
    starts[i] = Math.max(first, Math.min(starts[i], limit));
    limit = starts[i] - height;
  }
  return starts;
}
