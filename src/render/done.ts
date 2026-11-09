import { ChecklistItem } from "./checklist";
import { TextRenderer, renderInline } from "./markdown";

/**
 * Renders finished todos as one struck-through line in the footer, so they stay in view once
 * they leave the checklist rows. The full list is in the tooltip. With none finished, nothing
 * is drawn.
 */
export function renderDoneList(
  parent: HTMLElement,
  items: ChecklistItem[],
  renderText: TextRenderer = renderInline,
): void {
  const done = items.filter((item) => item.checked);
  if (done.length === 0) return;

  const line = document.createElement("div");
  line.className = "daily-page__done";

  // One grid row for the label, then one row per finished todo. The plugin hides the rows that do
  // not fit and shows a "+N more" row in their place (see fitDoneList in src/render/fit.ts).
  const labelRow = document.createElement("div");
  labelRow.className = "daily-page__done-row";
  const label = document.createElement("span");
  label.className = "daily-page__done-label";
  label.textContent = `Done (${done.length})`;
  labelRow.appendChild(label);
  line.appendChild(labelRow);

  for (const item of done) {
    const row = document.createElement("div");
    row.className = "daily-page__done-row daily-page__done-item";
    renderText(row, item.text);
    line.appendChild(row);
  }

  // The tooltip lists the finished todos as plain text, without markdown marks.
  const names = [...line.querySelectorAll(".daily-page__done-item")].map((row) => row.textContent);
  line.title = `Done (${done.length}): ${names.join("  ·  ")}`;

  const more = document.createElement("div");
  more.className = "daily-page__done-row daily-page__done-more";
  more.hidden = true;
  line.appendChild(more);
  parent.appendChild(line);
}
