import { CHECKLIST_HEADING, CHECKLIST_LIMIT, CHECKLIST_LINE, findSection } from "../entries/format";
import { makeClickable } from "./access";

export interface ChecklistItem {
  text: string;
  checked: boolean;
  /** The exact line as written in the note, used to check it is still the same line when editing. */
  raw: string;
  /** Position of the line within the Checklist section, used to find it again when editing. */
  index: number;
}

/** Reads the Checklist section. Non-task lines are ignored. A missing section gives no items. */
export function readChecklist(noteLines: string[]): ChecklistItem[] {
  const section = findSection(noteLines, CHECKLIST_HEADING);
  if (!section) return [];

  const items: ChecklistItem[] = [];
  noteLines.slice(section.start, section.end).forEach((line, index) => {
    const match = CHECKLIST_LINE.exec(line);
    if (match) {
      items.push({ text: match[2], checked: match[1].toLowerCase() === "x", raw: line, index });
    }
  });
  return items;
}

/** A row of the list: a box, then a second element for the todo's text, or for the line of an empty row. */
function checklistRow(): [row: HTMLLIElement, box: HTMLElement, second: HTMLElement] {
  const row = document.createElement("li");
  const box = document.createElement("span");
  box.className = "daily-page__box";
  const second = document.createElement("span");
  row.append(box, second);
  return [row, box, second];
}

/**
 * Renders the open todos into `parent`, one row each. Finished todos leave these rows and are
 * listed in the Done line instead (see renderDoneList). Open todos are capped at CHECKLIST_LIMIT
 * when added, so they fit; past the limit, the last row says how many are not shown. Clicking a
 * box calls `onToggle` with the new state, which is always "finished". Rows with no todo are drawn as empty
 * boxes, and clicking one calls `onAdd`.
 */
export function renderChecklist(
  parent: HTMLElement,
  items: ChecklistItem[],
  onToggle?: (item: ChecklistItem, checked: boolean) => void,
  onAdd?: () => void,
): void {
  const list = document.createElement("ul");
  list.className = "daily-page__checklist";

  const open = items.filter((item) => !item.checked);
  // Past the limit, the last row says how many are not shown, so no todo vanishes silently.
  const overflow = open.length > CHECKLIST_LIMIT;
  const shown = overflow ? open.slice(0, CHECKLIST_LIMIT - 1) : open;
  for (const item of shown) {
    const [row, box, text] = checklistRow();
    if (onToggle) {
      makeClickable(box, () => onToggle(item, true), "checkbox");
      box.setAttribute("aria-checked", "false");
      box.setAttribute("aria-label", `Finish ${item.text}`);
    }
    text.textContent = item.text;
    list.appendChild(row);
  }
  if (overflow) {
    const more = document.createElement("li");
    more.className = "daily-page__checklist-more";
    more.textContent = `+${open.length - shown.length} more`;
    list.appendChild(more);
  }
  // As on the Hobonichi page, the list is always CHECKLIST_LIMIT rows: the todos, then empty boxes to fill in.
  // Tapping an empty row adds a todo.
  for (let blank = shown.length + (overflow ? 1 : 0); blank < CHECKLIST_LIMIT; blank++) {
    const [row, , line] = checklistRow();
    row.className = "daily-page__checklist-blank";
    line.className = "daily-page__todo-line";
    if (onAdd) {
      makeClickable(row, onAdd);
      // The row has no text, so name the button for a screen reader.
      row.setAttribute("aria-label", "Add a todo");
    }
    list.appendChild(row);
  }

  parent.appendChild(list);
}
