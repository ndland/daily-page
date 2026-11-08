// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { openFieldsDialog } from "../src/vault/dialog";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("openFieldsDialog extra actions", () => {
  it("adds a button for each action, which closes the dialog and runs with the field values", () => {
    const run = vi.fn();
    const onSave = vi.fn();
    openFieldsDialog("Edit", [{ label: "Text", value: "idea" }], onSave, [{ label: "Start now", run }]);

    const button = document.querySelector<HTMLButtonElement>(".daily-page__dialog-extra")!;
    expect(button.textContent).toBe("Start now");
    button.click();

    expect(run).toHaveBeenCalledWith(["idea"]);
    expect(onSave).not.toHaveBeenCalled();
    expect(document.querySelector(".daily-page__overlay")).toBeNull();
  });

  it("does not run an action when the dialog is closed with Escape", () => {
    const run = vi.fn();
    openFieldsDialog("Edit", [{ label: "Text", value: "idea" }], () => {}, [{ label: "Start now", run }]);
    document.querySelector(".daily-page__overlay")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(run).not.toHaveBeenCalled();
    expect(document.querySelector(".daily-page__overlay")).toBeNull();
  });
});
