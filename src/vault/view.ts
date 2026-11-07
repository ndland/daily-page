/**
 * The daily page as a Dataview view. A note calls `await dv.view("99_System/Views/Daily Page")`
 * and this file draws the page from the note's `daily-page` block.
 *
 * The view makes no network calls. Its footer quote is the one the Daily Page plugin has cached,
 * read from the plugin's settings, so the plugin is the only code that talks to ZenQuotes. With
 * the plugin disabled, the footer shows no quote.
 *
 * Edits go through the same write path as the plugin (PageEditor, which uses applyNoteEdit).
 */
import { renderPage } from "../render/page";
import { keepFitted } from "../render/fit";
import { setChecklistItem, type ScopeEdit } from "../entries/edit";
import { MULTIPLE_BLOCKS, NO_PAGE_MESSAGE, countDailyPageBlocks, scopeOf } from "../logic/scope";
import { parseTagColours } from "../logic/tags";
import type { QuoteText } from "../render/quote";
import { PageEditor, reasonOf } from "./editFlow";
import { openBlockEditor, openGreatThingEditor } from "./editor";
import { VIEW_SETTINGS } from "./settings";

// Provided by Dataview when this file runs as a view.
declare const dv: any;
declare const app: any;

const PLUGIN_ID = "daily-page";


/**
 * The plugin's editor when the plugin is enabled, so an undo in the plugin sees the edits made in the
 * view and the other way round. The view makes its own editor only when the plugin is off.
 */
const pages: PageEditor = app.plugins?.plugins?.[PLUGIN_ID]?.pages ?? new PageEditor(app.vault, () => new Date());

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
 * with the plugin (PageEditor), so both keep the same guarantees.
 */
async function editNote(path: string, edit: ScopeEdit): Promise<void> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!file) {
    showMessage("The note could not be found.");
    return;
  }

  const message = await pages.edit(file, edit);
  if (message) {
    showMessage(message);
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
  let source: string;
  try {
    source = await dv.io.load(path);
  } catch (error) {
    dv.container.replaceChildren();
    // A notice that stays, since an empty view with no explanation would look like a broken note.
    const notice = document.createElement("div");
    notice.className = "daily-page__message";
    notice.textContent = 'The note could not be read: ' + reasonOf(error);
    dv.container.appendChild(notice);
    return;
  }
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
  if (!scope) {
    const notice = document.createElement("div");
    notice.className = "daily-page__message";
    notice.textContent = NO_PAGE_MESSAGE;
    dv.container.appendChild(notice);
    return;
  }

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
