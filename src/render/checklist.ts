import { findSection } from "../entries/format";

/** Renders checklist items into `parent` as a list. Read-only in this version. */
export function renderChecklist(parent: HTMLElement, items: ChecklistItem[]): void {
  const list = document.createElement("ul");
  list.className = "daily-page__checklist";
  for (const item of items) {
    const row = document.createElement("li");
    const box = document.createElement("span");
    box.className = item.checked ? "daily-page__box is-checked" : "daily-page__box";
    const text = document.createElement("span");
    text.textContent = item.text;
    row.append(box, text);
    list.appendChild(row);
  }
  parent.appendChild(list);
}

export const CHECKLIST_HEADING = "## Checklist";

export interface ChecklistItem {
  text: string;
  checked: boolean;
}

const CHECKLIST_LINE = /^- \[( |x|X)\] (.+)$/;

/** Reads the Checklist section. Non-task lines are ignored. A missing section gives no items. */
export function readChecklist(noteLines: string[]): ChecklistItem[] {
  const section = findSection(noteLines, CHECKLIST_HEADING);
  if (!section) return [];

  const items: ChecklistItem[] = [];
  for (const line of noteLines.slice(section.start, section.end)) {
    const match = CHECKLIST_LINE.exec(line);
    if (match) {
      items.push({ text: match[2], checked: match[1].toLowerCase() === "x" });
    }
  }
  return items;
}
