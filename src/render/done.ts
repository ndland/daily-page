import type { ChecklistItem } from "./checklist";
import { TextRenderer, renderInline } from "./markdown";

/** Renders done and cancelled todos in the notes column's fitted history. */
export function renderDoneList(
  parent: HTMLElement,
  items: ChecklistItem[],
  renderText: TextRenderer = renderInline,
  onReopen?: (item: ChecklistItem) => void,
): void {
  const history = items.filter((item) => item.status === "done" || item.status === "cancelled");
  if (history.length === 0) return;
  const cancelled = history.filter((item) => item.status === "cancelled");
  const doneCount = history.length - cancelled.length;

  const line = document.createElement("div");
  line.className = "daily-page__done";

  const labelRow = document.createElement("div");
  labelRow.className = "daily-page__done-row daily-page__done-heading";
  if (doneCount) {
    const label = document.createElement("span");
    label.className = "daily-page__done-label";
    label.textContent = `Done (${doneCount})`;
    labelRow.appendChild(label);
  }
  if (cancelled.length) {
    const dialog = cancelledDialog(cancelled, renderText, onReopen);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "daily-page__task-action daily-page__cancelled-count";
    toggle.textContent = `Cancelled (${cancelled.length})`;
    toggle.setAttribute("aria-haspopup", "dialog");
    toggle.addEventListener("click", () => dialog.showModal());
    labelRow.appendChild(toggle);
    line.appendChild(dialog);
  }
  line.appendChild(labelRow);

  const doneNames: string[] = [];
  for (const item of history) {
    const row = document.createElement("div");
    row.className = "daily-page__done-row daily-page__done-item";
    row.classList.toggle("is-cancelled", item.status === "cancelled");
    renderText(row, item.text);
    if (item.status === "done") doneNames.push(row.textContent ?? "");
    line.appendChild(row);
  }

  if (doneCount) line.title = `Done (${doneCount}): ${doneNames.join("  ·  ")}`;

  const more = document.createElement("div");
  more.className = "daily-page__done-row daily-page__done-more";
  more.hidden = true;
  line.appendChild(more);
  parent.appendChild(line);
}

function cancelledDialog(
  items: ChecklistItem[],
  renderText: TextRenderer,
  onReopen?: (item: ChecklistItem) => void,
): HTMLDialogElement {
  const dialog = document.createElement("dialog");
  dialog.className = "daily-page__dialog daily-page__task-dialog daily-page__cancelled-dialog";
  dialog.setAttribute("aria-label", "Cancelled tasks");

  const header = document.createElement("div");
  header.className = "daily-page__cancelled-dialog-header";
  const heading = document.createElement("h3");
  heading.textContent = "Cancelled tasks";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "daily-page__task-action";
  close.textContent = "Close";
  close.autofocus = true;
  close.addEventListener("click", () => dialog.close());
  header.append(heading, close);

  const list = document.createElement("ul");
  for (const item of items) {
    const row = document.createElement("li");
    const text = document.createElement("span");
    renderText(text, item.text);
    row.appendChild(text);
    if (onReopen) {
      const reopen = document.createElement("button");
      reopen.type = "button";
      reopen.className = "daily-page__task-action";
      reopen.textContent = "Reopen";
      reopen.setAttribute("aria-label", `Reopen ${text.textContent}`);
      reopen.addEventListener("click", () => {
        dialog.close();
        onReopen(item);
      });
      row.appendChild(reopen);
    }
    list.appendChild(row);
  }
  dialog.append(header, list);
  return dialog;
}
