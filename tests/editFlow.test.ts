import type { TFile, Vault } from "obsidian";
import { describe, expect, it } from "vitest";
import { appendChecklistItem, setChecklistItem } from "../src/entries/edit";
import { PageEditor, editPage, undoPage } from "../src/vault/editFlow";
import { UndoSlot } from "../src/vault/noteEdit";
import { WriteQueue } from "../src/vault/writeQueue";

const NOW = new Date(2026, 10, 6, 11, 0);
const NOTE = ["```daily-page", "## Timeline", "## Checklist", "- [ ] Walk", "```"].join("\n");
const FILE = { path: "daily.md" } as TFile;

/** A vault with read and process. A queued write can be made to fail, as a locked file would. */
class FakeVault {
  content: string;
  failNextWrite: Error | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(content: string) {
    this.content = content;
  }

  read(): Promise<string> {
    return Promise.resolve(this.content);
  }

  process(_file: TFile, edit: (data: string) => string): Promise<string> {
    const run = this.queue.then(() => {
      if (this.failNextWrite) {
        const error = this.failNextWrite;
        this.failNextWrite = null;
        throw error;
      }
      this.content = edit(this.content);
      return this.content;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  asVault(): Vault {
    return this as unknown as Vault;
  }
}

describe("editPage", () => {
  it("reports a failed write, and keeps the undo record of the edit before it", async () => {
    const vault = new FakeVault(NOTE);
    const slot = new UndoSlot();
    expect(await editPage(vault.asVault(), FILE, (scope) => appendChecklistItem(scope, "Read"), NOW, slot)).toBeNull();

    vault.failNextWrite = new Error("file is locked");
    const message = await editPage(vault.asVault(), FILE, (scope) => appendChecklistItem(scope, "Water"), NOW, slot);

    expect(message).toBe("The note could not be saved: file is locked");
    const record = slot.take();
    expect(record?.after).toContain("- [ ] Read");
    expect(record?.after).not.toContain("- [ ] Water");
  });

  it("reports a refused edit and leaves the undo record alone", async () => {
    const vault = new FakeVault(NOTE);
    const slot = new UndoSlot();
    await editPage(vault.asVault(), FILE, (scope) => appendChecklistItem(scope, "Read"), NOW, slot);

    const message = await editPage(
      vault.asVault(),
      FILE,
      (scope) => setChecklistItem(scope, { raw: "- [ ] Gone", index: 0 }, true),
      NOW,
      slot,
    );

    expect(message).toContain("changed in the note");
    expect(slot.take()?.after).toContain("- [ ] Read");
  });

  it("does not replace the undo record with a no-op, such as a repeat tick", async () => {
    const vault = new FakeVault(NOTE);
    const slot = new UndoSlot();
    await editPage(vault.asVault(), FILE, (scope) => appendChecklistItem(scope, "Read"), NOW, slot);

    const message = await editPage(vault.asVault(), FILE, (scope) => ({ ok: true, lines: scope }), NOW, slot);

    expect(message).toBeNull();
    expect(slot.take()?.after).toContain("- [ ] Read");
  });
});

describe("undoPage", () => {
  it("says so when there is nothing to undo", async () => {
    const vault = new FakeVault(NOTE);
    expect(await undoPage(vault.asVault(), new UndoSlot(), () => FILE, NOW)).toBe("Nothing to undo.");
  });

  it("says so when the note for the last edit is gone, and forgets that edit", async () => {
    const vault = new FakeVault(NOTE);
    const slot = new UndoSlot();
    await editPage(vault.asVault(), FILE, (scope) => appendChecklistItem(scope, "Read"), NOW, slot);

    expect(await undoPage(vault.asVault(), slot, () => null, NOW)).toBe("The note for the last action is gone.");
    expect(await undoPage(vault.asVault(), slot, () => FILE, NOW)).toBe("Nothing to undo.");
  });

  it("refuses an undo when the page changed, and forgets that record, since it no longer matches", async () => {
    const vault = new FakeVault(NOTE);
    const slot = new UndoSlot();
    await editPage(vault.asVault(), FILE, (scope) => appendChecklistItem(scope, "Read"), NOW, slot);
    vault.content = vault.content.replace("- [ ] Read", "- [ ] Read and write");

    expect(await undoPage(vault.asVault(), slot, () => FILE, NOW)).toContain("changed since the last edit");
    expect(await undoPage(vault.asVault(), slot, () => FILE, NOW)).toBe("Nothing to undo.");
  });

  it("keeps the record when the undo's own write fails, so it can be tried again", async () => {
    const vault = new FakeVault(NOTE);
    const slot = new UndoSlot();
    await editPage(vault.asVault(), FILE, (scope) => appendChecklistItem(scope, "Read"), NOW, slot);

    vault.failNextWrite = new Error("disk full");
    expect(await undoPage(vault.asVault(), slot, () => FILE, NOW)).toBe("The undo could not be saved: disk full");
    expect(await undoPage(vault.asVault(), slot, () => FILE, NOW)).toBe("Undid the last edit.");
    expect(vault.content).toBe(NOTE);
  });
});

describe("PageEditor ordering", () => {
  it("runs an undo queued behind an edit after that edit, so it reverts the newer edit", async () => {
    const vault = new FakeVault(NOTE);
    const pages = new PageEditor(vault.asVault(), () => NOW);
    await pages.edit(FILE, (scope) => appendChecklistItem(scope, "Read"));

    // Both are requested at once. The edit is queued first, so the undo must revert it, not Read.
    const [, undone] = await Promise.all([
      pages.edit(FILE, (scope) => appendChecklistItem(scope, "Water")),
      pages.undo(() => FILE),
    ]);

    expect(undone).toBe("Undid the last edit.");
    expect(vault.content).toContain("- [ ] Read");
    expect(vault.content).not.toContain("- [ ] Water");
  });
});

describe("WriteQueue", () => {
  it("runs tasks in the order they were queued, even when an earlier one is slower", async () => {
    const queue = new WriteQueue();
    const order: string[] = [];
    const slow = queue.run(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      order.push("slow");
    });
    const fast = queue.run(async () => {
      order.push("fast");
    });
    await Promise.all([slow, fast]);
    expect(order).toEqual(["slow", "fast"]);
  });

  it("keeps running the tasks after one fails", async () => {
    const queue = new WriteQueue();
    await expect(queue.run(() => Promise.reject(new Error("first failed")))).rejects.toThrow("first failed");
    await expect(queue.run(() => Promise.resolve("second"))).resolves.toBe("second");
  });
});
