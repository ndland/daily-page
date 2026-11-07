import {
  App,
  MarkdownPostProcessorContext,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  normalizePath,
} from "obsidian";
import { QUOTE_SOURCE } from "./config";
import { DEFAULT_ACCENT, DEFAULT_TAG_COLOURS } from "./defaults";
import { TimelineLine, readTimeline, writeTimeline } from "./entries/format";
import { LogOutcome, endRunning, logActivity, logNote } from "./entries/log";
import { ScopeEdit, appendChecklistItem, appendGreatThing, setChecklistItem } from "./entries/edit";
import { DEFAULT_DAILY_PATTERN, dailyNotePath, isSafeDailyPattern } from "./logic/paths";
import { parseTagColours } from "./logic/tags";
import { NO_PAGE_MESSAGE, countDailyPageBlocks, scopeOf } from "./logic/scope";
import { StoredQuote, loadDailyQuote } from "./logic/quoteCache";
import { renderPage } from "./render/page";
import type { QuoteText } from "./render/quote";
import { keepFitted } from "./render/fit";
import { PageEditor, reasonOf } from "./vault/editFlow";
import { NoteCreator } from "./vault/noteCreator";
import { openBlockEditor, openGreatThingEditor } from "./vault/editor";

interface DailyPageSettings {
  dailyPattern: string;
  quote: StoredQuote | null;
  /** Highlight colour for activity blocks and today's date in the mini calendar. */
  accentColor: string;
  /** One "tag #hex" pair per line. Activities whose label has the tag use that colour. */
  tagColours: string;
}

const DEFAULT_SETTINGS: DailyPageSettings = {
  dailyPattern: DEFAULT_DAILY_PATTERN,
  quote: null,
  accentColor: DEFAULT_ACCENT,
  tagColours: DEFAULT_TAG_COLOURS,
};

/**
 * New daily notes hold their data inside the daily-page block. The page is what the reader
 * sees, so the raw text is hidden in reading view.
 */
const NEW_NOTE_CONTENT = "```daily-page\n## Timeline\n\n## Checklist\n\n## Three things\n```\n";

const MULTIPLE_BLOCKS = "This note has more than one daily page. Keep one daily-page block, then reload.";

type LogAction = (timeline: TimelineLine[], now: number) => LogOutcome;

function splitLines(content: string): string[] {
  return content.split(/\r?\n/);
}

export default class DailyPagePlugin extends Plugin {
  settings: DailyPageSettings = { ...DEFAULT_SETTINGS };
  private notes!: NoteCreator<TFile>;
  /** Shared with the vault view, so both use one undo record and one write queue. */
  pages!: PageEditor;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.notes = new NoteCreator<TFile>(this.app.vault, (entry): entry is TFile => entry instanceof TFile);
    this.pages = new PageEditor(this.app.vault, () => new Date());

    this.addCommand({
      id: "log-activity",
      name: "Log activity",
      hotkeys: [{ modifiers: ["Alt", "Shift"], key: "A" }],
      callback: () =>
        this.askText("What are you doing?", (text) =>
          this.log((timeline, now) => logActivity(timeline, text, now)),
        ),
    });

    this.addCommand({
      id: "log-side-note",
      name: "Log side note",
      hotkeys: [{ modifiers: ["Alt", "Shift"], key: "N" }],
      callback: () =>
        this.askText("Side note", (text) =>
          this.log((timeline, now) => logNote(timeline, text, now)),
        ),
    });

    this.addCommand({
      id: "end-running-activity",
      name: "End running activity",
      hotkeys: [{ modifiers: ["Alt", "Shift"], key: "E" }],
      callback: () => this.log((timeline, now) => endRunning(timeline, now)),
    });

    this.addCommand({
      id: "undo-last-log",
      name: "Undo last log",
      hotkeys: [{ modifiers: ["Alt", "Shift"], key: "Z" }],
      callback: () => this.undoLast(),
    });

    this.addCommand({
      id: "add-todo",
      name: "Add todo",
      hotkeys: [{ modifiers: ["Alt", "Shift"], key: "T" }],
      callback: () => this.askText("New todo", (text) => this.addTodo(text)),
    });

    this.addCommand({
      id: "add-great-thing",
      name: "Add to three things",
      hotkeys: [{ modifiers: ["Alt", "Shift"], key: "G" }],
      callback: () => this.askText("One of three things", (text) => this.addGreatThing(text)),
    });

    this.registerMarkdownCodeBlockProcessor(
      "daily-page",
      (_source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) =>
        this.renderBlock(el, ctx.sourcePath),
    );

    this.addSettingTab(new DailyPageSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<DailyPageSettings>) };
    // A synced settings file could hold a path that leaves the vault. Such a path falls back to the default.
    if (!isSafeDailyPattern(this.settings.dailyPattern)) this.settings.dailyPattern = DEFAULT_DAILY_PATTERN;
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** Logs a new entry to today's note, creating the note if needed. */
  private async log(action: LogAction): Promise<void> {
    await this.guard(async () => {
      const file = await this.ensureTodayNote(new Date());
      await this.editFile(file.path, (scope, now) => {
        const outcome = action(readTimeline(scope), now);
        return outcome.ok ? { ok: true, lines: writeTimeline(scope, outcome.timeline) } : outcome;
      });
    });
  }

  /**
   * Applies an edit to a note's page, and records one level of undo. A refusal or a failed write
   * is shown to the reader, and leaves the previous undo record in place.
   */
  private async editFile(path: string, edit: ScopeEdit): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      new Notice("The note could not be found.");
      return;
    }
    try {
      const content = await this.app.vault.read(file);
      if (countDailyPageBlocks(splitLines(content)) > 1) {
        new Notice(MULTIPLE_BLOCKS);
        return;
      }
    } catch (error) {
      new Notice(`The note could not be read: ${reasonOf(error)}`);
      return;
    }
    const message = await this.pages.edit(file, edit);
    if (message) new Notice(message);
  }

  /** Reverts the last edit to the page. See undoPage for when the undo is refused or fails. */
  private async undoLast(): Promise<void> {
    const message = await this.pages.undo((path) => {
      const file = this.app.vault.getAbstractFileByPath(path);
      return file instanceof TFile ? file : null;
    });
    new Notice(message);
  }

  /** Returns today's note, creating it and its folders if they do not exist. */
  private ensureTodayNote(now: Date): Promise<TFile> {
    const path = normalizePath(dailyNotePath(now, this.settings.dailyPattern));
    return this.notes.ensure(path, NEW_NOTE_CONTENT);
  }

  /** Adds an open todo to today's checklist. */
  private async addTodo(text: string): Promise<void> {
    await this.guard(async () => {
      const file = await this.ensureTodayNote(new Date());
      await this.editFile(file.path, (scope) => appendChecklistItem(scope, text));
    });
  }

  /** Adds a bullet to the Three things box in today's note. */
  private async addGreatThing(text: string): Promise<void> {
    await this.guard(async () => {
      const file = await this.ensureTodayNote(new Date());
      await this.editFile(file.path, (scope) => appendGreatThing(scope, text));
    });
  }

  /** Runs a command, and shows a Notice rather than an unhandled error if it fails. */
  private async guard(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      new Notice(`The note could not be saved: ${reasonOf(error)}`);
    }
  }

  private askText(placeholder: string, onSubmit: (text: string) => void): void {
    new PromptModal(this.app, placeholder, onSubmit).open();
  }

  /**
   * Draws the page from the note's page scope, the same lines the edits change, and wires clicks
   * back to the note.
   */
  private async renderBlock(el: HTMLElement, sourcePath: string): Promise<void> {
    const now = new Date();

    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    let content: string;
    try {
      content = file instanceof TFile ? await this.app.vault.read(file) : "";
    } catch (error) {
      const message = document.createElement("div");
      message.className = "daily-page__message";
      message.textContent = `The note could not be read: ${reasonOf(error)}`;
      el.replaceChildren(message);
      return;
    }
    const lines = splitLines(content);
    if (countDailyPageBlocks(lines) > 1) {
      const message = document.createElement("div");
      message.className = "daily-page__message";
      message.textContent = MULTIPLE_BLOCKS;
      el.replaceChildren(message);
      return;
    }
    const scope = scopeOf(lines);
    if (!scope) {
      const message = document.createElement("div");
      message.className = "daily-page__message";
      message.textContent = NO_PAGE_MESSAGE;
      el.replaceChildren(message);
      return;
    }

    const blockLines = lines.slice(scope.start, scope.end);
    const draw = (quote: QuoteText | null): void => {
      renderPage(el, blockLines, now, quote, {
        accent: this.settings.accentColor,
        tagColours: parseTagColours(this.settings.tagColours),
        handlers: {
          onToggle: (item, checked) => {
            void this.editFile(sourcePath, (scope) => setChecklistItem(scope, item, checked));
          },
          onEdit: (block) => openBlockEditor(block, (edit) => void this.editFile(sourcePath, edit)),
          onEditGreatThing: (item) =>
            openGreatThingEditor(item, (edit) => void this.editFile(sourcePath, edit)),
        },
      });
      // Size the page to the window once it is on screen, and again on every resize.
      const page = el.querySelector<HTMLElement>(".daily-page");
      if (page) keepFitted(page);
    };

    // The page is drawn at once with the cached quote, so it never waits on the network. A fresh
    // quote, when the cache is out of date and the fetch works, redraws the footer.
    const cached = this.settings.quote;
    draw(cached);
    const quote = await loadDailyQuote(
      {
        get: () => this.settings.quote,
        set: async (stored) => {
          this.settings.quote = stored;
          await this.saveSettings();
        },
      },
      QUOTE_SOURCE,
      now,
    );
    if (quote !== cached && el.isConnected) draw(quote);
  }
}

class PromptModal extends Modal {
  constructor(
    app: App,
    private readonly placeholder: string,
    private readonly onSubmit: (text: string) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const input = this.contentEl.createEl("input", { type: "text", placeholder: this.placeholder });
    input.style.width = "100%";
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const text = input.value;
      this.close();
      this.onSubmit(text);
    });
    input.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class DailyPageSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: DailyPagePlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Daily note path")
      .setDesc("Tokens: {YYYY} year, {MM} month number, {MMMM} month name, {DD} day.")
      .addText((text) =>
        text.setValue(this.plugin.settings.dailyPattern).onChange(async (value) => {
          const pattern = value.trim() || DEFAULT_DAILY_PATTERN;
          if (!isSafeDailyPattern(pattern)) {
            new Notice('The daily note path must stay inside the vault: no ".." and no leading slash.');
            return;
          }
          this.plugin.settings.dailyPattern = pattern;
          await this.plugin.saveSettings();
        }),
      );

    const colour = new Setting(containerEl)
      .setName("Highlight colour")
      .setDesc("Colour for activity blocks and today's date in the mini calendar.");
    const picker = colour.controlEl.createEl("input", { type: "color" });
    picker.value = this.plugin.settings.accentColor;
    picker.addEventListener("change", async () => {
      this.plugin.settings.accentColor = picker.value;
      await this.plugin.saveSettings();
    });

    new Setting(containerEl)
      .setName("Tag colours")
      .setDesc(
        "One tag and colour per line, such as \"work #8be9fd\". An activity whose label contains " +
          "#work uses that colour. Lines that don't match are ignored.",
      )
      .addTextArea((area) =>
        area.setValue(this.plugin.settings.tagColours).onChange(async (value) => {
          this.plugin.settings.tagColours = value;
          await this.plugin.saveSettings();
        }),
      );
  }
}
