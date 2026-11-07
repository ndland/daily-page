import { describe, expect, it } from "vitest";
import { UndoSlot } from "../src/vault/noteEdit";

const EDIT_A = { path: "a.md", before: ["- [ ] Walk"], after: ["- [x] Walk"] };
const EDIT_B = { path: "a.md", before: ["- [x] Walk"], after: ["- [x] Walk", "- [ ] Water"] };

describe("UndoSlot", () => {
  it("gives back the last edit once, then nothing", () => {
    const slot = new UndoSlot();
    slot.remember(EDIT_A);
    expect(slot.take()).toEqual(EDIT_A);
    expect(slot.take()).toBeNull();
  });

  it("holds only the latest edit, so undo reverts only that one", () => {
    const slot = new UndoSlot();
    slot.remember(EDIT_A);
    slot.remember(EDIT_B);
    expect(slot.take()).toEqual(EDIT_B);
    expect(slot.take()).toBeNull();
  });

  it("is empty before any edit", () => {
    expect(new UndoSlot().take()).toBeNull();
  });
});
