import type { TFile, Vault } from "obsidian";
import { describe, expect, it } from "vitest";
import { appendChecklistItem } from "../src/entries/edit";
import { CONFLICT_MESSAGE, hasConflictMarkers } from "../src/logic/conflict";
import { resolveReadOnly } from "../src/logic/readOnly";
import { PageEditor, READ_ONLY_MESSAGE } from "../src/vault/editFlow";
import { applyToText } from "../src/vault/noteEdit";

const NOW = new Date(2026, 10, 6, 11, 0);
const FILE = { path: "daily.md" } as TFile;
const PAGE = ["```daily-page", "## Checklist", "- [ ] Walk", "```"];

describe("hasConflictMarkers", () => {
  it("finds a full conflict", () => {
    expect(hasConflictMarkers(["a", "<<<<<<< HEAD", "x", "=======", "y", ">>>>>>> origin/main"])).toBe(true);
  });
  it("ignores a lone setext underline or a stray opener", () => {
    expect(hasConflictMarkers(["Title", "======="])).toBe(false);
    expect(hasConflictMarkers(["<<<<<<< not closed", "text"])).toBe(false);
    expect(hasConflictMarkers(["text", ">>>>>>> before opener", "<<<<<<< x"])).toBe(false);
  });
});

describe("applyToText with a conflict", () => {
  it("refuses to edit and leaves the text alone", () => {
    const text = [...PAGE, "<<<<<<< HEAD", "a", "=======", "b", ">>>>>>> other"].join("\n");
    const result = applyToText(text, (scope) => appendChecklistItem(scope, "Read"), 660);
    expect(result).toEqual({ ok: false, message: CONFLICT_MESSAGE });
  });
});

describe("resolveReadOnly", () => {
  it("defaults to read-only on mobile only, and lets the stored choice win", () => {
    expect(resolveReadOnly(null, true)).toBe(true);
    expect(resolveReadOnly(null, false)).toBe(false);
    expect(resolveReadOnly("off", true)).toBe(false);
    expect(resolveReadOnly("on", false)).toBe(true);
  });
});

describe("PageEditor read-only", () => {
  it("writes nothing and says why", async () => {
    let touched = false;
    const vault = {
      read: () => {
        touched = true;
        return Promise.resolve(PAGE.join("\n"));
      },
      process: () => {
        touched = true;
        return Promise.resolve("");
      },
    } as unknown as Vault;
    const editor = new PageEditor(vault, () => NOW, () => true);

    expect(await editor.edit(FILE, (scope) => appendChecklistItem(scope, "Read"))).toBe(READ_ONLY_MESSAGE);
    expect(await editor.undo(() => FILE)).toBe(READ_ONLY_MESSAGE);
    expect(touched).toBe(false);
  });
});
