// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { makeClickable } from "../src/render/access";

describe("makeClickable with a held key", () => {
  it("does not activate again for each repeat of a held Enter", () => {
    const el = document.createElement("span");
    const onActivate = vi.fn();
    makeClickable(el, onActivate);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true, cancelable: true }));
    expect(onActivate).not.toHaveBeenCalled();
  });
});
