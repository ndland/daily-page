// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openFieldsDialog } from "../src/vault/dialog";

const overlay = () => document.querySelector<HTMLElement>(".daily-page__overlay");
const input = (i: number) => document.querySelectorAll<HTMLInputElement>(".daily-page__dialog input")[i];
const saveButton = () => document.querySelector<HTMLButtonElement>(".daily-page__dialog-save")!;
const key = (target: HTMLElement, key: string) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("openFieldsDialog", () => {
  it("is announced as a labelled dialog, with its fields labelled", () => {
    openFieldsDialog("Edit side note", [{ label: "Text", value: "idea" }], () => {});
    const box = document.querySelector<HTMLElement>(".daily-page__dialog")!;
    expect(box.getAttribute("role")).toBe("dialog");
    expect(box.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(box.getAttribute("aria-labelledby")!)?.textContent).toBe("Edit side note");
    expect(document.querySelector("label")?.htmlFor).toBe(input(0).id);
  });

  it("closes on Escape without saving", () => {
    const onSave = vi.fn();
    openFieldsDialog("Edit", [{ label: "Text", value: "idea" }], onSave);
    key(input(0), "Escape");
    expect(overlay()).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves the typed text on Enter", () => {
    const onSave = vi.fn();
    openFieldsDialog("Edit", [{ label: "Text", value: "idea" }], onSave);
    input(0).value = "new";
    key(input(0), "Enter");
    expect(onSave).toHaveBeenCalledWith(["new"]);
    expect(overlay()).toBeNull();
  });

  it("saves every field when Save is clicked", () => {
    const onSave = vi.fn();
    openFieldsDialog(
      "Edit activity",
      [
        { label: "Label", value: "Email" },
        { label: "Start", value: "09:00" },
      ],
      onSave,
    );
    input(1).value = "09:30";
    saveButton().click();
    expect(onSave).toHaveBeenCalledWith(["Email", "09:30"]);
  });

  it("closes on a click outside the box, without saving", () => {
    const onSave = vi.fn();
    openFieldsDialog("Edit", [{ label: "Text", value: "idea" }], onSave);
    overlay()!.click();
    expect(overlay()).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps Tab inside the dialog: Tab on Save goes to the first field, and Shift+Tab on it goes back to Save", () => {
    openFieldsDialog("Edit", [{ label: "Text", value: "idea" }], () => {});
    saveButton().focus();
    const forward = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    saveButton().dispatchEvent(forward);
    expect(document.activeElement).toBe(input(0));
    expect(forward.defaultPrevented).toBe(true);

    const back = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true });
    input(0).dispatchEvent(back);
    expect(document.activeElement).toBe(saveButton());
  });

  it("returns focus to what had it before the dialog opened", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    openFieldsDialog("Edit", [{ label: "Text", value: "idea" }], () => {});
    key(input(0), "Escape");
    expect(document.activeElement).toBe(opener);
  });
});
