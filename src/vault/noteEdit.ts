import type { TFile, Vault } from "obsidian";
import type { ScopeEdit } from "../entries/edit";
import { minutesOfDay } from "../logic/time";
import { replaceScope, scopeOf } from "../logic/scope";

/** The page's lines before and after one edit. Undo uses these, and nothing outside the page. */
export interface EditRecord {
  path: string;
  before: string[];
  after: string[];
}

export type ApplyResult =
  | { ok: true; before: string[]; after: string[]; changed: boolean }
  | { ok: false; message: string };

/** The outcome of one edit applied to a note's text, before anything is written. */
type TextResult =
  | { ok: true; text: string; before: string[]; after: string[]; changed: boolean }
  | { ok: false; message: string };

function sameLines(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i]);
}

/**
 * The line ending used when the note is written back: CRLF when most of its lines end that way,
 * otherwise LF. A note can mix the two, so the split below accepts either.
 */
function dominantLineEnding(content: string): string {
  const crlf = content.split("\r\n").length - 1;
  const lf = content.split("\n").length - 1 - crlf;
  return crlf > lf ? "\r\n" : "\n";
}

/**
 * Applies an edit to the page in a note's text. Pure: it returns the new text, and writes nothing.
 * Lines are split the same way the renderer splits them (CRLF or LF), so a mixed-ending note reads
 * the same here as it does on the page. A change that leaves the page as it was returns the text
 * unchanged.
 */
export function applyToText(content: string, edit: ScopeEdit, minute: number): TextResult {
  const lines = content.split(/\r?\n/);
  const scope = scopeOf(lines);
  const before = lines.slice(scope.start, scope.end);

  const outcome = edit(before, minute);
  if (!outcome.ok) return { ok: false, message: outcome.message };

  const changed = !sameLines(before, outcome.lines);
  if (!changed) return { ok: true, text: content, before, after: outcome.lines, changed };
  const text = replaceScope(lines, scope, outcome.lines).join(dominantLineEnding(content));
  return { ok: true, text, before, after: outcome.lines, changed };
}

/**
 * The one way the plugin and the vault view write to a note. The edit is first checked against the
 * note's text, so a refused edit or a no-op never writes the file. The write itself is a single
 * vault.process call, and the edit is applied again to the text it receives, so two edits made
 * close together cannot overwrite each other. A failed write throws, so the caller can report it.
 */
export async function applyNoteEdit(vault: Vault, file: TFile, edit: ScopeEdit, now: Date): Promise<ApplyResult> {
  const minute = minutesOfDay(now);
  const preview = applyToText(await vault.read(file), edit, minute);
  if (!preview.ok) return preview;
  if (!preview.changed) return { ok: true, before: preview.before, after: preview.after, changed: false };

  let outcome: ApplyResult = { ok: false, message: "The note could not be changed." };
  await vault.process(file, (content) => {
    const applied = applyToText(content, edit, minute);
    if (!applied.ok) {
      outcome = applied;
      return content;
    }
    outcome = { ok: true, before: applied.before, after: applied.after, changed: applied.changed };
    return applied.text;
  });
  return outcome;
}

/**
 * The inverse of an edit, as a scope edit. It puts back the page's lines from before the edit,
 * but only if the page still reads as it did after it. Anything else changed since (a tick made
 * in the view, say) makes the undo refuse, so it never reverts someone else's change. Text outside
 * the page is never part of the edit, so it is never touched.
 */
export function undoEdit(record: EditRecord): ScopeEdit {
  return (scope) =>
    sameLines(scope, record.after)
      ? { ok: true, lines: record.before }
      : { ok: false, message: "The note changed since the last edit, so undo was not applied." };
}

/**
 * The last edit to the page, kept for one undo. Taking it clears it, so an edit can only be undone
 * once. A refused or failed edit is never remembered, so it leaves the previous record in place.
 */
export class UndoSlot {
  private record: EditRecord | null = null;

  remember(record: EditRecord): void {
    this.record = record;
  }

  take(): EditRecord | null {
    const record = this.record;
    this.record = null;
    return record;
  }
}
