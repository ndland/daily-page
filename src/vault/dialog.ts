/** A field in the dialog: a label, and the text it starts with. */
export interface DialogField {
  label: string;
  value: string;
}

/** An extra button beside Save. It closes the dialog, then runs with the field values. */
export interface DialogAction {
  label: string;
  run: (values: string[]) => void;
}

/**
 * Opens a small dialog with one text box per field. Save, or Enter, passes every value to
 * `onSave`. Escape, or a click outside the box, closes it without saving. The dialog is announced
 * as a dialog, Tab stays inside it while it is open, and focus returns to what had it before.
 *
 * This is plain DOM, so it works inside a Dataview view, where Obsidian's Modal class is not
 * available to the view file.
 */
export function openFieldsDialog(
  title: string,
  fields: DialogField[],
  onSave: (values: string[]) => void,
  extraActions: DialogAction[] = [],
): void {
  const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const overlay = document.createElement("div");
  overlay.className = "daily-page__overlay";

  const box = document.createElement("div");
  box.className = "daily-page__dialog";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");

  const heading = document.createElement("h3");
  heading.id = "daily-page-dialog-title";
  heading.textContent = title;
  box.setAttribute("aria-labelledby", heading.id);
  box.appendChild(heading);

  const inputs = fields.map((field, i) => {
    const row = document.createElement("div");
    row.className = "daily-page__dialog-row";
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "text";
    input.id = `daily-page-dialog-field-${i}`;
    input.value = field.value;
    label.htmlFor = input.id;
    label.textContent = field.label;
    row.append(label, input);
    box.appendChild(row);
    return input;
  });

  const close = (): void => {
    overlay.remove();
    returnFocus?.focus();
  };
  const save = (): void => {
    const values = inputs.map((input) => input.value);
    close();
    onSave(values);
  };

  const button = document.createElement("button");
  button.textContent = "Save";
  button.className = "daily-page__dialog-save";
  button.addEventListener("click", save);
  box.appendChild(button);

  for (const action of extraActions) {
    const extra = document.createElement("button");
    extra.textContent = action.label;
    extra.className = "daily-page__dialog-extra";
    extra.addEventListener("click", () => {
      close();
      action.run(inputs.map((input) => input.value));
    });
    box.appendChild(extra);
  }

  overlay.appendChild(box);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key === "Tab") {
      keepFocusIn(box, event);
      return;
    }
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      save();
    }
  });

  document.body.appendChild(overlay);
  inputs[0]?.focus();
}

/** Moves Tab and Shift+Tab around the focusable parts of `box`, so focus cannot leave the dialog. */
function keepFocusIn(box: HTMLElement, event: KeyboardEvent): void {
  const focusable = [...box.querySelectorAll<HTMLElement>("input, button")];
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
