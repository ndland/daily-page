import type { TFile, Vault } from "obsidian";
import type { ScopeEdit } from "../entries/edit";
import { EditRecord, UndoSlot, applyNoteEdit, undoEdit } from "./noteEdit";
import { WriteQueue } from "./writeQueue";

/** Shown when a write is attempted on a device set to read-only. */
export const READ_ONLY_MESSAGE =
  "This device is read-only, so it does not write notes. Turn off read-only in the Daily Page settings to edit here.";

/** A readable reason for a failed write, for the message the reader sees. */
export function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Applies an edit to a note's page and remembers it for undo. Returns the message to show, or null
 * when the edit went through quietly. A refused edit, or a write that fails, is not remembered, so
 * the previous undo record is kept. A no-op changes nothing, so it does not replace that record.
 */
export async function editPage(
  vault: Vault,
  file: TFile,
  edit: ScopeEdit,
  now: Date,
  slot: UndoSlot,
): Promise<string | null> {
  try {
    const result = await applyNoteEdit(vault, file, edit, now);
    if (!result.ok) return result.message;
    if (result.changed) slot.remember({ path: file.path, before: result.before, after: result.after });
    return null;
  } catch (error) {
    return `The note could not be saved: ${reasonOf(error)}`;
  }
}

/**
 * Reverts the last edit, and returns the message to show. The record is taken first, so an undo
 * can only be tried once at a time. If the page changed since that edit, the undo is refused and
 * the record is dropped, since it no longer matches the page. If the write itself fails, the record
 * is put back, so the reader can try again.
 */
export async function undoPage(
  vault: Vault,
  slot: UndoSlot,
  resolveFile: (path: string) => TFile | null,
  now: Date,
): Promise<string> {
  const record: EditRecord | null = slot.take();
  if (!record) return "Nothing to undo.";

  const file = resolveFile(record.path);
  if (!file) return "The note for the last action is gone.";

  try {
    const result = await applyNoteEdit(vault, file, undoEdit(record), now);
    return result.ok ? "Undid the last edit." : result.message;
  } catch (error) {
    slot.remember(record);
    return `The undo could not be saved: ${reasonOf(error)}`;
  }
}

/**
 * The edit and undo for one plugin or view instance. Every write goes through one queue, in the
 * order it was asked for, so an undo always reverts the newest edit that was actually made.
 */
export class PageEditor {
  private readonly slot = new UndoSlot();
  private readonly queue = new WriteQueue();

  /**
   * `readOnly` is asked at the moment of each write, so a device can be switched to read-only
   * without a reload. A read-only editor writes nothing and says why.
   */
  constructor(
    private readonly vault: Vault,
    private readonly now: () => Date,
    private readonly readOnly: () => boolean = () => false,
  ) {}

  edit(file: TFile, edit: ScopeEdit): Promise<string | null> {
    if (this.readOnly()) return Promise.resolve(READ_ONLY_MESSAGE);
    return this.queue.run(() => editPage(this.vault, file, edit, this.now(), this.slot));
  }

  undo(resolveFile: (path: string) => TFile | null): Promise<string> {
    if (this.readOnly()) return Promise.resolve(READ_ONLY_MESSAGE);
    return this.queue.run(() => undoPage(this.vault, this.slot, resolveFile, this.now()));
  }
}
