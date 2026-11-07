// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { makeClickable } from "../src/render/access";

describe("makeClickable", () => {
  it("can be reached with Tab and is announced with its role", () => {
    const el = document.createElement("span");
    makeClickable(el, () => {}, "checkbox");
    expect(el.tabIndex).toBe(0);
    expect(el.getAttribute("role")).toBe("checkbox");
    expect(el.classList.contains("is-clickable")).toBe(true);
  });

  it("runs on click, and on Enter or Space from the keyboard", () => {
    const el = document.createElement("span");
    const onActivate = vi.fn();
    makeClickable(el, onActivate);

    el.click();
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
    expect(onActivate).toHaveBeenCalledTimes(3);
  });

  it("ignores other keys", () => {
    const el = document.createElement("span");
    const onActivate = vi.fn();
    makeClickable(el, onActivate);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    expect(onActivate).not.toHaveBeenCalled();
  });
});
