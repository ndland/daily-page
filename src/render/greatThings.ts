import { GREAT_THINGS_HEADING, GREAT_THINGS_LIMIT, findSection } from "../entries/format";
import { makeClickable } from "./access";

export { GREAT_THINGS_HEADING, GREAT_THINGS_LIMIT };

/** One bullet of the Three things box, with the line it came from so it can be edited. */
export interface GreatThing {
  text: string;
  /** The exact line as written in the note. */
  raw: string;
  /** Position of the line within the Three things section. */
  index: number;
}

/**
 * Reads every bullet under the Three things heading that has text. Blank bullets are skipped. A
 * missing section gives no items. The box shows three of them; see renderGreatThings.
 */
export function readGreatThings(noteLines: string[]): GreatThing[] {
  const section = findSection(noteLines, GREAT_THINGS_HEADING);
  if (!section) return [];

  const items: GreatThing[] = [];
  noteLines.slice(section.start, section.end).forEach((line, index) => {
    const text = /^- (.*)$/.exec(line)?.[1]?.trim() ?? "";
    if (text.length > 0) items.push({ text, raw: line, index });
  });
  return items;
}

/**
 * Draws the box: a title, then the bullets, or a hint when none are filled in yet. The box shows
 * the first GREAT_THINGS_LIMIT bullets, and a "+N more" row for any beyond them, so none vanishes
 * silently. Clicking a bullet calls `onEdit` with it, so the reader can change it.
 */
export function renderGreatThings(
  parent: HTMLElement,
  items: GreatThing[],
  onEdit?: (item: GreatThing) => void,
): void {
  const box = document.createElement("section");
  box.className = "daily-page__great";

  const title = document.createElement("h3");
  title.className = "daily-page__great-title";
  title.textContent = "Three things to make my day great";
  box.appendChild(title);

  if (items.length === 0) {
    const hint = document.createElement("p");
    hint.className = "daily-page__great-hint";
    hint.textContent = "Press Alt+Shift+G to add one, or add bullets under \"Three things\" in the note.";
    box.appendChild(hint);
  } else {
    const list = document.createElement("ul");
    list.className = "daily-page__great-list";
    const shown = items.slice(0, GREAT_THINGS_LIMIT);
    for (const item of shown) {
      const row = document.createElement("li");
      row.textContent = item.text;
      if (onEdit) makeClickable(row, () => onEdit(item));
      list.appendChild(row);
    }
    if (items.length > shown.length) {
      const more = document.createElement("li");
      more.className = "daily-page__great-more";
      more.textContent = `+${items.length - shown.length} more`;
      list.appendChild(more);
    }
    box.appendChild(list);
  }
  parent.appendChild(box);
}
