/**
 * The daily page as a Dataview view. A note calls `await dv.view("99_System/Views/Daily Page")`
 * and this file draws the page from the note's `daily-page` block.
 *
 * The view makes no network calls. Its footer quote is the one the Daily Page plugin has cached,
 * read from the plugin's settings, so the plugin is the only code that talks to ZenQuotes. With
 * the plugin disabled, the footer shows no quote.
 *
 * Edits go through the same write path as the plugin (applyNoteEdit).
 */
import { renderPage } from "../render/page";
import { keepFitted } from "../render/fit";
import { setChecklistItem, type ScopeEdit } from "../entries/edit";
import { countDailyPageBlocks, scopeOf } from "../logic/scope";
import { parseTagColours } from "../logic/tags";
import type { QuoteText } from "../render/quote";
import { applyNoteEdit } from "./noteEdit";
import { openBlockEditor, openGreatThingEditor } from "./editor";
import { VIEW_SETTINGS } from "./settings";

// Provided by Dataview when this file runs as a view.
declare const dv: any;
declare const app: any;

const PLUGIN_ID = "daily-page";

const MULTIPLE_BLOCKS = "This note has more than one daily page. Keep one daily-page block, then reload.";

/** A short message at the top of the page, for example when an edit is refused. */
function showMessage(text: string): void {
  const note = document.createElement("div");
  note.className = "daily-page__message";
  note.textContent = text;
  dv.container.prepend(note);
  setTimeout(() => note.remove(), 4000);
}

/**
 * Applies an edit to the daily-page block of a note, then redraws. The write itself is shared
 * with the plugin (applyNoteEdit), so both keep the same guarantees.
 */
async function editNote(path: string, edit: ScopeEdit): Promise<void> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!file) {
    showMessage("The note could not be found.");
    return;
  }

  try {
    const result = await applyNoteEdit(app.vault, file, edit, new Date());
    if (!result.ok) {
      showMessage(result.message);
      return;
    }
  } catch (error) {
    showMessage(`The note could not be saved: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  await draw();
}

/** The quote the plugin last cached, or null when the plugin is not enabled or has none yet. */
function cachedQuote(): QuoteText | null {
  const quote = app.plugins?.plugins?.[PLUGIN_ID]?.settings?.quote;
  return quote ? { text: quote.text, author: quote.author } : null;
}

/** Reads the note and draws the page from its daily-page block. */
async function draw(): Promise<void> {
  const path: string = dv.current().file.path;
  const source: string = await dv.io.load(path);
  const lines = source.split(/\r?\n/);
  dv.container.replaceChildren();
  if (countDailyPageBlocks(lines) > 1) {
    // A notice that stays, since nothing else on the page would explain the empty view.
    const notice = document.createElement("div");
    notice.className = "daily-page__message";
    notice.textContent = MULTIPLE_BLOCKS;
    dv.container.appendChild(notice);
    return;
  }
  const scope = scopeOf(lines);

  renderPage(dv.container, lines.slice(scope.start, scope.end), new Date(), cachedQuote(), {
    accent: VIEW_SETTINGS.accent,
    tagColours: parseTagColours(VIEW_SETTINGS.tagColours),
    handlers: {
      onToggle: (item, checked) => {
        void editNote(path, (scope) => setChecklistItem(scope, item, checked));
      },
      onEdit: (block) => openBlockEditor(block, (edit) => void editNote(path, edit)),
      onEditGreatThing: (item) => openGreatThingEditor(item, (edit) => void editNote(path, edit)),
    },
  });

  const page = dv.container.querySelector(".daily-page");
  if (page) keepFitted(page);
}

void draw();
