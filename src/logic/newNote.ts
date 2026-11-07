import { countDailyPageBlocks, findDailyPageBlock } from "./scope";

/**
 * The content of a new daily note when no template is used: an empty daily-page block with the three page
 * sections. The data lives inside the block, and the reader sees the page, not the raw text.
 */
export const DEFAULT_NEW_NOTE_CONTENT = "```daily-page\n## Timeline\n\n## Checklist\n\n## Three things\n```\n";

/** The three sections a new daily note's block starts with. */
const EMPTY_PAGE_BODY = ["## Timeline", "", "## Checklist", "", "## Three things"];

export interface NewNote {
  /** The content to create the note with. */
  content: string;
  /** Why the template was not used, for the reader to see, or null when it was used. */
  problem: string | null;
}

/**
 * The content for a new daily note, from the template note. A template is used only when it holds exactly one
 * complete daily-page block. Its block is reset to the three empty sections, so entries in the template never
 * copy into every new note. Anything else gives the built-in content, with the reason.
 */
export function resolveNewNote(template: string | null | undefined): NewNote {
  if (template === null || template === undefined) return { content: DEFAULT_NEW_NOTE_CONTENT, problem: null };

  const lines = template.split(/\r?\n/);
  const blocks = countDailyPageBlocks(lines);
  if (blocks === 0) {
    return { content: DEFAULT_NEW_NOTE_CONTENT, problem: "The daily note template has no daily-page block, so the built-in note is used." };
  }
  if (blocks > 1) {
    return { content: DEFAULT_NEW_NOTE_CONTENT, problem: "The daily note template has more than one daily-page block, so the built-in note is used." };
  }
  const block = findDailyPageBlock(lines);
  if (block === null) {
    return { content: DEFAULT_NEW_NOTE_CONTENT, problem: "The daily note template's daily-page block is not closed, so the built-in note is used." };
  }

  const eol = template.includes("\r\n") ? "\r\n" : "\n";
  const reset = [...lines.slice(0, block.start), ...EMPTY_PAGE_BODY, ...lines.slice(block.end)];
  return { content: reset.join(eol), problem: null };
}
