import type { TFile, Vault } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { appendChecklistItem, setChecklistItem } from "../src/entries/edit";
import { UndoSlot, applyNoteEdit, undoEdit } from "../src/vault/noteEdit";

const NOW = new Date(2026, 10, 6, 11, 0);
const FILE = {} as TFile;

/**
 * A stand-in for the vault. Writes go through vault.process, which runs after the one before it, as
 * Obsidian serialises writes to a file. read returns the note, as the write path reads it first.
 * modify fails if called, so a write that bypasses process is caught.
 */
class FakeVault {
  content: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(content: string) {
    this.content = content;
  }

  process(_file: TFile, edit: (data: string) => string): Promise<string> {
    const run = this.queue.then(() => {
      this.content = edit(this.content);
      return this.content;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Reads the note, as the write path does before it writes, to check an edit first. */
  read(): Promise<string> {
    return Promise.resolve(this.content);
  }

  modify(): never {
    throw new Error("applyNoteEdit must write through vault.process, not modify");
  }

  /** Changes the note outside the plugin, as another editor or sync would. */
  external(edit: (data: string) => string): void {
    this.content = edit(this.content);
  }

  asVault(): Vault {
    return this as unknown as Vault;
  }
}

const NOTE = [
  "# Friday",
  "",
  "```daily-page",
  "## Timeline",
  "- 09:00-10:00 Email",
  "## Checklist",
  "- [ ] Walk",
  "```",
  "",
  "Free text outside the page.",
].join("\n");

describe("applyNoteEdit", () => {
  it("lets two overlapping edits both survive", async () => {
    const vault = new FakeVault(NOTE);
    const add = (scope: string[]) => appendChecklistItem(scope, "Read");
    const tick = (scope: string[]) => setChecklistItem(scope, { raw: "- [ ] Walk", index: 0 }, true);

    const [a, b] = await Promise.all([
      applyNoteEdit(vault.asVault(), FILE, add, NOW),
      applyNoteEdit(vault.asVault(), FILE, tick, NOW),
    ]);

    expect(a.ok && b.ok).toBe(true);
    expect(vault.content).toContain("- [ ] Read");
    expect(vault.content).toContain("- [x] Walk");
  });

  it("keeps CRLF line endings", async () => {
    const vault = new FakeVault(NOTE.replace(/\n/g, "\r\n"));
    await applyNoteEdit(vault.asVault(), FILE, (scope) => appendChecklistItem(scope, "Read"), NOW);

    expect(vault.content).toContain("- [ ] Read\r\n");
    expect(vault.content.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("leaves the note unchanged when the edit is refused", async () => {
    const vault = new FakeVault(NOTE);
    const stale = (scope: string[]) => setChecklistItem(scope, { raw: "- [ ] Gone", index: 0 }, true);

    const result = await applyNoteEdit(vault.asVault(), FILE, stale, NOW);

    expect(result.ok).toBe(false);
    expect(vault.content).toBe(NOTE);
  });

  it("returns the page's lines before and after the edit", async () => {
    const vault = new FakeVault(NOTE);
    const result = await applyNoteEdit(vault.asVault(), FILE, (scope) => appendChecklistItem(scope, "Read"), NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.before).toEqual(["## Timeline", "- 09:00-10:00 Email", "## Checklist", "- [ ] Walk"]);
    expect(result.after).toEqual([...result.before, "- [ ] Read"]);
  });
});

describe("undoEdit", () => {
  it("puts back the page as it was before the edit", async () => {
    const vault = new FakeVault(NOTE);
    const applied = await applyNoteEdit(vault.asVault(), FILE, (scope) => appendChecklistItem(scope, "Read"), NOW);
    if (!applied.ok) throw new Error("setup edit should apply");

    const undone = await applyNoteEdit(
      vault.asVault(),
      FILE,
      undoEdit({ path: "x.md", before: applied.before, after: applied.after }),
      NOW,
    );

    expect(undone.ok).toBe(true);
    expect(vault.content).toBe(NOTE);
  });

  it("keeps text typed outside the page, which the old whole-file undo would have lost", async () => {
    const vault = new FakeVault(NOTE);
    const applied = await applyNoteEdit(vault.asVault(), FILE, (scope) => appendChecklistItem(scope, "Read"), NOW);
    if (!applied.ok) throw new Error("setup edit should apply");

    // The reader types below the page after the edit.
    vault.external((data) => `${data}\nA line typed later.`);
    await applyNoteEdit(
      vault.asVault(),
      FILE,
      undoEdit({ path: "x.md", before: applied.before, after: applied.after }),
      NOW,
    );

    expect(vault.content).not.toContain("- [ ] Read");
    expect(vault.content).toContain("A line typed later.");
    expect(vault.content).toContain("Free text outside the page.");
  });

  it("refuses to undo when the page changed after the edit, and keeps that change", async () => {
    const vault = new FakeVault(NOTE);
    const applied = await applyNoteEdit(vault.asVault(), FILE, (scope) => appendChecklistItem(scope, "Read"), NOW);
    if (!applied.ok) throw new Error("setup edit should apply");

    // A tick made in the Dataview view after the edit.
    await applyNoteEdit(vault.asVault(), FILE, (scope) => setChecklistItem(scope, { raw: "- [ ] Walk", index: 0 }, true), NOW);
    const before = vault.content;

    const undone = await applyNoteEdit(
      vault.asVault(),
      FILE,
      undoEdit({ path: "x.md", before: applied.before, after: applied.after }),
      NOW,
    );

    expect(undone.ok).toBe(false);
    expect(vault.content).toBe(before);
    expect(vault.content).toContain("- [x] Walk");
  });
});

describe("applyNoteEdit, further cases", () => {
  it("keeps one checklist when a note mixes CRLF and LF line endings", async () => {
    // The heading ends in LF, the rest in CRLF. The page must still find its one checklist.
    const mixed = "## Timeline\r\n- 09:00-10:00 Email\n## Checklist\r\n- [ ] Walk\r\n";
    const vault = new FakeVault(mixed);
    const result = await applyNoteEdit(vault.asVault(), FILE, (scope) => appendChecklistItem(scope, "Read"), NOW);

    expect(result.ok).toBe(true);
    expect(vault.content.match(/## Checklist/g)).toHaveLength(1);
    expect(vault.content).toContain("- [ ] Walk\r\n- [ ] Read");
  });

  it("does not write the note when the edit is refused", async () => {
    const vault = new FakeVault(NOTE);
    const process = vi.spyOn(vault, "process");
    await applyNoteEdit(vault.asVault(), FILE, (scope) => setChecklistItem(scope, { raw: "- [ ] Gone", index: 0 }, true), NOW);

    expect(process).not.toHaveBeenCalled();
  });

  it("does not write the note when the edit changes nothing, and reports it as unchanged", async () => {
    const vault = new FakeVault(NOTE);
    const process = vi.spyOn(vault, "process");
    const result = await applyNoteEdit(vault.asVault(), FILE, (scope) => ({ ok: true, lines: scope }), NOW);

    expect(result.ok && result.changed).toBe(false);
    expect(process).not.toHaveBeenCalled();
  });

  it("lets a repeat tick, such as a double click, pass as a no-op, so only the first is recorded", async () => {
    const vault = new FakeVault(NOTE);
    const tick = (scope: string[]) => setChecklistItem(scope, { raw: "- [ ] Walk", index: 0 }, true);

    const [first, second] = await Promise.all([
      applyNoteEdit(vault.asVault(), FILE, tick, NOW),
      applyNoteEdit(vault.asVault(), FILE, tick, NOW),
    ]);

    expect(first.ok && first.changed).toBe(true);
    expect(second.ok && second.changed).toBe(false);
    expect(vault.content.match(/- \[x\] Walk/g)).toHaveLength(1);
  });

  it("rejects when the write itself fails, so the caller can tell the reader", async () => {
    const vault = new FakeVault(NOTE);
    vi.spyOn(vault, "process").mockRejectedValueOnce(new Error("file is locked"));

    await expect(
      applyNoteEdit(vault.asVault(), FILE, (scope) => appendChecklistItem(scope, "Read"), NOW),
    ).rejects.toThrow("file is locked");
    expect(vault.content).toBe(NOTE);
  });

  it("undoes an edit that created the Checklist section, removing the heading again", async () => {
    const noChecklist = ["# Friday", "", "```daily-page", "## Timeline", "- 09:00-10:00 Email", "```"].join("\n");
    const vault = new FakeVault(noChecklist);
    const applied = await applyNoteEdit(vault.asVault(), FILE, (scope) => appendChecklistItem(scope, "Read"), NOW);
    if (!applied.ok) throw new Error("setup edit should apply");
    expect(vault.content).toContain("## Checklist");

    await applyNoteEdit(vault.asVault(), FILE, undoEdit({ path: "x.md", before: applied.before, after: applied.after }), NOW);

    expect(vault.content).toBe(noChecklist);
  });

  it("undoes only the latest of two edits, through the undo slot", async () => {
    const vault = new FakeVault(NOTE);
    const slot = new UndoSlot();
    const first = await applyNoteEdit(vault.asVault(), FILE, (scope) => appendChecklistItem(scope, "Read"), NOW);
    if (!first.ok) throw new Error("setup edit should apply");
    slot.remember({ path: "x.md", before: first.before, after: first.after });
    const second = await applyNoteEdit(vault.asVault(), FILE, (scope) => appendChecklistItem(scope, "Water"), NOW);
    if (!second.ok) throw new Error("setup edit should apply");
    slot.remember({ path: "x.md", before: second.before, after: second.after });

    const record = slot.take();
    if (!record) throw new Error("an undo record should be kept");
    await applyNoteEdit(vault.asVault(), FILE, undoEdit(record), NOW);

    expect(vault.content).toContain("- [ ] Read");
    expect(vault.content).not.toContain("- [ ] Water");
  });
});
