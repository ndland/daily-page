import { spreadShortLabels } from "./timeline";
import { gridLinePositions, gridUnitPx, layOutRows } from "../logic/grid";

/** Space kept clear below the page, so its bottom border stays visible. */
const RESERVE_PX = 16;

/** Below this height the page is allowed to scroll rather than squash its contents. */
const MIN_HEIGHT_PX = 320;

/** Obsidian's reading-view scroller. Its padding surrounds the note, so the fit must respect it. */
const READING_SCROLLER = ".markdown-preview-view";

/**
 * Space the note holds below the page: the scroller's bottom padding, plus the height and
 * margins of everything after the page on the way up to the scroller. This reads the DOM
 * directly, so the page's own height does not affect the result.
 */
function spaceBelowPage(page: HTMLElement, scroller: HTMLElement): number {
  let below = parseFloat(getComputedStyle(scroller).paddingBottom) || 0;
  for (let el: HTMLElement = page; el !== scroller && el.parentElement; el = el.parentElement) {
    below += parseFloat(getComputedStyle(el).marginBottom) || 0;
    for (let sibling = el.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
      below += (sibling as HTMLElement).offsetHeight;
    }
  }
  return below;
}

/**
 * Sizes the page to the note's visible area below the page's top, less the space the note
 * holds below the page and the reserve at the bottom.
 */
function fitToNote(page: HTMLElement, scroller: HTMLElement): void {
  const pageTop = page.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  const available = scroller.clientHeight - pageTop - spaceBelowPage(page, scroller) - RESERVE_PX;
  page.style.height = `${Math.max(available, MIN_HEIGHT_PX)}px`;
}

/** Fallback for a page that is not inside a reading view: fill the window below its top. */
function fitToWindow(page: HTMLElement, win: Window): void {
  const top = Math.max(0, page.getBoundingClientRect().top);
  const available = win.innerHeight - top - RESERVE_PX;
  page.style.height = `${Math.max(available, MIN_HEIGHT_PX)}px`;
}

/**
 * Sizes the page so the note fits on screen without scrolling. Inside a reading view, the
 * page fits the note's visible area. Elsewhere, it fits the window.
 */
export function fitPage(page: HTMLElement, win: Window = window): void {
  const scroller = page.closest<HTMLElement>(READING_SCROLLER);
  if (scroller) {
    fitToNote(page, scroller);
  } else {
    fitToWindow(page, win);
  }
}

/**
 * Sets the grid unit from the page's content height, in whole pixels, and returns it. Returns
 * null when the page has no height yet (it is hidden or not laid out), so no unit is guessed.
 */
function setGridUnit(page: HTMLElement): number | null {
  const height = page.getBoundingClientRect().height;
  if (height <= 0) return null;
  const style = getComputedStyle(page);
  const frame =
    parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) +
    parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
  const unit = gridUnitPx(height - frame);
  page.style.setProperty("--dp-dot-size", `${unit}px`);
  return unit;
}

/**
 * Draws the dotted grid behind the notes column: one dotted line per grid unit, in both
 * directions, at exact pixel positions so every line meets the text on the grid.
 */
function drawGrid(notes: HTMLElement, unit: number): void {
  let grid = notes.querySelector<HTMLElement>(".daily-page__grid");
  if (!grid) {
    grid = document.createElement("div");
    grid.className = "daily-page__grid";
    notes.prepend(grid);
  }
  // The lines are kept and moved, not rebuilt, so a window drag costs a few style writes a frame.
  syncLines(grid, "daily-page__grid-row", gridLinePositions(notes.clientHeight, unit), (el, top) => {
    el.style.top = `${top}px`;
  });
  syncLines(grid, "daily-page__grid-col", gridLinePositions(notes.clientWidth, unit), (el, left) => {
    el.style.left = `${left}px`;
  });
}

/** Makes `parent` hold one element of `className` for each position, reusing those already there. */
function syncLines(parent: HTMLElement, className: string, positions: number[], place: (el: HTMLElement, at: number) => void): void {
  const existing = [...parent.querySelectorAll<HTMLElement>(`.${className}`)];
  positions.forEach((at, i) => {
    let el = existing[i];
    if (!el) {
      el = document.createElement("div");
      el.className = className;
      parent.appendChild(el);
    }
    place(el, at);
  });
  for (const extra of existing.slice(positions.length)) extra.remove();
}

/** Rows of the notes column kept free for timed notes, so the finished todos never take all the space. */
const MIN_NOTES_ROWS = 6;

/**
 * Shows as many finished todos as fit below the three things box, and a "+N more" row for the
 * rest. Rows are hidden, not removed, so the count and names stay in the page.
 */
function fitDoneList(notes: HTMLElement, unit: number): void {
  const done = notes.querySelector<HTMLElement>(".daily-page__done");
  if (!done) return;
  const items = [...done.querySelectorAll<HTMLElement>(".daily-page__done-item")];
  const more = done.querySelector<HTMLElement>(".daily-page__done-more");
  for (const item of items) item.hidden = false;
  if (more) more.hidden = true;

  const great = notes.querySelector<HTMLElement>(".daily-page__great");
  // Two gaps (above and below the notes area) and the minimum notes space come off the column.
  const budget = notes.clientHeight - (great?.offsetHeight ?? 0) - 2 * unit - MIN_NOTES_ROWS * unit;
  const shown = doneItemsShown(items.length, budget, unit);
  if (shown === items.length) return;

  for (const item of items.slice(shown)) item.hidden = true;
  if (more) {
    more.textContent = `+${items.length - shown} more`;
    more.hidden = false;
  }
}

/**
 * How many finished todos fit in `budgetPx` of the notes column, one row each of `unit` pixels. All
 * of them when they fit. Otherwise one row goes to the label and one to "+N more", and the rest of
 * the rows show todos.
 */
export function doneItemsShown(total: number, budgetPx: number, unit: number): number {
  const rowsAvailable = Math.floor(budgetPx / unit); // includes the label row
  if (total <= rowsAvailable - 1) return total;
  return Math.max(0, rowsAvailable - 2);
}

/**
 * Moves each text row so its baseline sits on the nearest grid line. The baseline is measured in
 * the browser, so this holds for whatever font and theme the note uses.
 */
function snapBaselines(notes: HTMLElement, unit: number): void {
  const rows = [
    ...notes.querySelectorAll<HTMLElement>(
      ".daily-page__great-title, .daily-page__great-list li, .daily-page__note, .daily-page__done-row",
    ),
  ].filter((row) => !row.hidden);

  // All offsets are cleared, then every baseline is measured, and only then are offsets written.
  // Interleaving the two would force the browser to lay the page out again for every row.
  for (const row of rows) row.style.translate = "";
  const origin = notes.getBoundingClientRect().top;
  const probes = rows.map((row) => {
    const probe = document.createElement("span");
    probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
    row.appendChild(probe);
    return probe;
  });
  const baselines = probes.map((probe) => probe.getBoundingClientRect().top - origin);
  for (const probe of probes) probe.remove();

  rows.forEach((row, i) => {
    const target = Math.round(baselines[i] / unit) * unit;
    row.style.translate = `0 ${target - baselines[i]}px`;
  });
}

/** Height of a timed note, in grid units. Matches its line-height in daily-page.css. */
const NOTE_ROWS = 2;

/**
 * Places each timed note at its time on the timeline's axis, in pixels from the top of the notes
 * area. The notes area sits below the Three things box, so a note whose time falls under that box
 * is moved down to just below it, and the notes around it move with it. Every other note keeps
 * its exact time.
 */
export function placeNotes(page: HTMLElement, unit: number): void {
  const area = page.querySelector<HTMLElement>(".daily-page__notes-area");
  const axis = page.querySelector<HTMLElement>(".daily-page__timeline");
  if (!area || !axis) return;
  const notes = [...page.querySelectorAll<HTMLElement>(".daily-page__note")].filter(
    (note) => note.dataset.topPct !== undefined,
  );
  if (notes.length === 0) return;

  // Wanted rows: where each note's time falls on the axis, measured from the top of the notes area.
  const areaTop = area.getBoundingClientRect().top;
  const axisTop = axis.getBoundingClientRect().top;
  const wanted = notes.map((note) => {
    const axisOffsetPx = (Number(note.dataset.topPct) / 100) * axis.clientHeight;
    return Math.round((axisOffsetPx + axisTop - areaTop) / unit);
  });

  const starts = layOutRows(wanted, NOTE_ROWS, 0, Math.floor(area.clientHeight / unit));
  notes.forEach((note, i) => {
    note.style.top = `${starts[i] * unit}px`;
  });
}

/** The phone breakpoint. Keep in step with the 500px media query in styles/daily-page.css. */
const PHONE_QUERY = "(max-width: 500px)";

/** True on a narrow screen, where the page scrolls rather than fitting the window. */
function isPhone(win: Window): boolean {
  return win.matchMedia?.(PHONE_QUERY).matches ?? false;
}

/**
 * Fits the page to the screen and lays out the desktop grid: the grid unit, the grid lines, the
 * notes at their times, the finished todos, and the baselines. Returns false when the page has no
 * height yet, so nothing is placed.
 */
function fitToScreen(page: HTMLElement): boolean {
  fitPage(page);
  const unit = setGridUnit(page);
  if (unit === null) return false;
  const notes = page.querySelector<HTMLElement>(".daily-page__notes");
  if (notes) drawGrid(notes, unit);
  if (notes) fitDoneList(notes, unit);
  placeNotes(page, unit);
  if (notes) snapBaselines(notes, unit);
  return true;
}

/**
 * Undoes the desktop fit, for a narrow screen. The page takes its natural height and every text
 * row is laid out in flow, so nothing is cut short: every finished todo is shown, and the grid,
 * the note positions and the baseline offsets are removed.
 */
export function clearFit(page: HTMLElement): void {
  page.style.height = "";
  page.style.removeProperty("--dp-dot-size");
  page.querySelector(".daily-page__grid")?.remove();
  for (const note of page.querySelectorAll<HTMLElement>(".daily-page__note")) note.style.top = "";
  for (const row of page.querySelectorAll<HTMLElement>(
    ".daily-page__great-title, .daily-page__great-list li, .daily-page__note, .daily-page__done-row",
  )) {
    row.style.translate = "";
  }
  for (const item of page.querySelectorAll<HTMLElement>(".daily-page__done-item")) item.hidden = false;
  const more = page.querySelector<HTMLElement>(".daily-page__done-more");
  if (more) more.hidden = true;
}

/**
 * The observer watching each scroller. A note re-renders its page on every edit, so the observer
 * for the scroller is replaced rather than stacked, and a stale one never outlives its page.
 */
const watchers = new WeakMap<Element, ResizeObserver>();

/**
 * Fits the page now and again whenever the window is resized. Re-rendering the page replaces the
 * watcher for its scroller, and a watcher whose page has left the note disconnects itself.
 */
export function keepFitted(page: HTMLElement): void {
  // Labels are spread after the page is sized, since their positions depend on its height.
  const refresh = (): void => {
    if (isPhone(window)) {
      // On a narrow screen the page scrolls, so nothing is fitted or cut short.
      clearFit(page);
    } else if (!fitToScreen(page)) {
      // Not laid out yet: the observer below runs this again once the note has a size.
      return;
    }
    const timeline = page.querySelector<HTMLElement>(".daily-page__timeline");
    if (timeline) spreadShortLabels(timeline);
  };
  // Obsidian can draw a view before it has a size, and window resizes alone do not catch that.
  // Watching the note's scroller catches the first real layout, and every later resize.
  const target = page.closest<HTMLElement>(READING_SCROLLER) ?? page.parentElement ?? page;
  watchers.get(target)?.disconnect();
  // A drag resizes the window many times a frame. One redraw per frame is enough, and the last one
  // wins, so the page is never drawn for a size that has already gone.
  let frame: number | null = null;
  const scheduleRefresh = (): void => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      refresh();
    });
  };
  const observer = new ResizeObserver(() => {
    if (!page.isConnected) {
      observer.disconnect();
      if (watchers.get(target) === observer) watchers.delete(target);
      return;
    }
    scheduleRefresh();
  });
  observer.observe(target);
  watchers.set(target, observer);
  refresh();
  // Text is measured against the font in use. Obsidian can swap in its own font after the first
  // draw, which moves every baseline, so align again once the fonts have loaded.
  void document.fonts?.ready.then(refresh);
}
