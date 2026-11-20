import { runningTaskIds } from "../entries/checklist";
import {
  CHECKLIST_HEADING, CHECKLIST_LIMIT, CHECKLIST_LINE, CHECKLIST_MARKERS, findSection,
  readTaskLink, readTimeline, type TaskStatus, type TimelineLine,
} from "../entries/format";
import { makeClickable } from "./access";
import { TextRenderer, renderInline } from "./markdown";

export interface ChecklistItem {
  text: string;
  status: TaskStatus;
  /** The exact line as written in the note, used to check it is still the same line when editing. */
  raw: string;
  /** Position of the line within the Checklist section, used to find it again when editing. */
  index: number;
}

/** Reads the Checklist section. Non-task lines are ignored. A missing section gives no items. */
export function readChecklist(noteLines: string[], timeline: TimelineLine[] = readTimeline(noteLines)): ChecklistItem[] {
  const section = findSection(noteLines, CHECKLIST_HEADING);
  if (!section) return [];

  const running = runningTaskIds(timeline);
  const items: ChecklistItem[] = [];
  noteLines.slice(section.start, section.end).forEach((line, index) => {
    const match = CHECKLIST_LINE.exec(line);
    if (match) {
      const { text, taskId } = readTaskLink(match[2]);
      let status: TaskStatus = "done";
      if (match[1] === CHECKLIST_MARKERS.cancelled) status = "cancelled";
      if (match[1] === CHECKLIST_MARKERS.open) status = taskId && running.has(taskId) ? "in-progress" : "open";
      items.push({ text, status, raw: line, index });
    }
  });
  return items;
}

/** A row of the list: a box, then a second element for the todo's text, or for the line of an empty row. */
function checklistRow(hasAction = false): [row: HTMLLIElement, box: HTMLElement, second: HTMLElement] {
  const row = document.createElement("li");
  const box = hasAction ? document.createElement("button") : document.createElement("span");
  box.className = "daily-page__box";
  const second = document.createElement("span");
  row.append(box, second);
  return [row, box, second];
}

/**
 * Renders the open todos into `parent`, one row each. Done and cancelled todos move to history.
 * A task's box opens its status choices. An empty box adds a task.
 */
export function renderChecklist(
  parent: HTMLElement,
  items: ChecklistItem[],
  onStatus?: (item: ChecklistItem, status: TaskStatus) => void,
  onAdd?: () => void,
  renderText: TextRenderer = renderInline,
  isToday = true,
): void {
  const list = document.createElement("ul");
  list.className = "daily-page__checklist";
  list.classList.toggle("has-status-actions", Boolean(onStatus));
  const chooser = onStatus && taskStatusChooser(parent, onStatus, isToday);

  const open = items.filter((item) => item.status === "open" || item.status === "in-progress");
  // Past the limit, the last row says how many are not shown, so no todo vanishes silently.
  const overflow = open.length > CHECKLIST_LIMIT;
  const shown = overflow ? open.slice(0, CHECKLIST_LIMIT - 1) : open;
  for (const item of shown) {
    const [row, box, text] = checklistRow(Boolean(chooser));
    text.className = "daily-page__todo-text";
    renderText(text, item.text);
    const inProgress = item.status === "in-progress";
    box.classList.toggle("is-in-progress", inProgress);
    if (chooser && box instanceof HTMLButtonElement) {
      const name = text.textContent ?? item.text;
      box.type = "button";
      box.classList.add("daily-page__status-box");
      box.setAttribute("aria-haspopup", "dialog");
      box.setAttribute("aria-label", `Status for ${name}, ${inProgress ? "in progress" : "to do"}`);
      box.title = inProgress ? "In progress · Change status" : "Change task status";
      box.dataset.taskIndex = String(item.index);
      box.addEventListener("click", () => chooser(item, name));
    } else if (inProgress) {
      box.setAttribute("role", "img");
      box.setAttribute("aria-label", "In progress");
    }
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

function taskStatusChooser(
  parent: HTMLElement,
  onStatus: (item: ChecklistItem, status: TaskStatus) => void,
  isToday: boolean,
): (item: ChecklistItem, name: string) => void {
  const dialog = document.createElement("dialog");
  dialog.className = "daily-page__dialog daily-page__task-dialog daily-page__status-dialog";
  const heading = document.createElement("h3");
  const actions = document.createElement("div");
  actions.className = "daily-page__status-actions";
  dialog.append(heading, actions);
  parent.appendChild(dialog);

  return (item, name) => {
    heading.textContent = name;
    dialog.setAttribute("aria-label", `Status for ${name}`);
    const choices: [TaskStatus, string][] = [["done", "Done"]];
    if (item.status === "in-progress") choices.push(["open", "Stop timing"]);
    else if (isToday) choices.push(["in-progress", "In progress"]);
    choices.push(["cancelled", "Cancelled"]);

    actions.replaceChildren();
    for (const [status, label] of choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "daily-page__task-action";
      button.textContent = label;
      button.addEventListener("click", () => {
        dialog.close();
        onStatus(item, status);
      });
      actions.appendChild(button);
    }
    const close = document.createElement("button");
    close.type = "button";
    close.className = "daily-page__task-action";
    close.textContent = "Close";
    close.addEventListener("click", () => dialog.close());
    actions.appendChild(close);
    dialog.showModal();
  };
}
