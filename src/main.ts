import {
  App,
  MarkdownPostProcessorContext,
  Modal,
  Notice,
  Plugin,
  Platform,
  PluginSettingTab,
  Editor,
  MarkdownFileInfo,
  MarkdownView,
  Setting,
  TFile,
  normalizePath,
} from "obsidian";
import { QUOTE_SOURCE } from "./config";
import { TimelineLine, readTimeline, writeTimeline } from "./entries/format";
import { LogOutcome, endRunning, logActivity, logNote } from "./entries/log";
import { ScopeEdit, appendChecklistItem, appendGreatThing, setChecklistItem } from "./entries/edit";
import { DEFAULT_DAILY_PATTERN, dailyNotePath, isSafeVaultPath } from "./logic/paths";
import { dateFromNotePath, noteDateOf } from "./logic/noteDate";
import { DEFAULT_NEW_NOTE_CONTENT, resolveNewNote } from "./logic/newNote";
import { DEFAULT_SETTINGS, DailyPageSettings, normaliseSettings } from "./logic/settings";
import { drawNoteQuote } from "./logic/noteQuote";
import { parseTagColours } from "./logic/tags";
import { MULTIPLE_BLOCKS, NO_PAGE_MESSAGE, countDailyPageBlocks, scopeOf } from "./logic/scope";
import { QuoteStore, pruneQuotes } from "./logic/quoteCache";
import { renderPage } from "./render/page";
import type { QuoteText } from "./render/quote";
import { keepFitted } from "./render/fit";
import { resolveReadOnly } from "./logic/readOnly";
import { PageEditor, READ_ONLY_MESSAGE, reasonOf } from "./vault/editFlow";
import { NoteCreator } from "./vault/noteCreator";
import { openBlockEditor, openGreatThingEditor } from "./vault/editor";


type LogAction = (timeline: TimelineLine[], now: number) => LogOutcome;

function splitLines(content: string): string[] {
  return content.split(/\r?\n/);
}

/** Shows a message in place of a block, for example when its note cannot be read. */
function showBlockMessage(el: HTMLElement, text: string): void {
  const message = document.createElement("div");
  message.className = "daily-page__message";
  message.textContent = text;
  el.replaceChildren(message);
}

export default class DailyPagePlugin extends Plugin {
  settings: DailyPageSettings = { ...DEFAULT_SETTINGS };
  private notes!: NoteCreator<TFile>;
  /** Shared with the vault view, so both use one undo record and one write queue. */
  pages!: PageEditor;
  /** The blocks drawn in open notes, so each can be redrawn as its note is typed in. */
  private readonly liveBlocks = new Map<HTMLElement, { path: string; paint: (text: string) => void }>();
  private livePending: { editor: Editor; path: string } | null = null;
  private liveFrame: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.notes = new NoteCreator<TFile>(this.app.vault, (entry): entry is TFile => entry instanceof TFile);
    this.pages = new PageEditor(this.app.vault, () => new Date(), () => this.isReadOnly());
    this.registerEvent(this.app.workspace.on("editor-change", (editor, info) => this.followEditor(editor, info)));

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
    // Checks the saved values, moves an older single quote into the per-day store, and drops anything invalid.
    const { settings, migrated } = normaliseSettings(await this.loadData());
    this.settings = settings;
    if (migrated) {
      try {
        await this.saveSettings();
      } catch (error) {
        new Notice(`Daily Page could not save its settings: ${reasonOf(error)}`);
      }
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * Read-only is a per-device choice, kept in this device's own browser storage and not in the
   * synced settings file, so switching one device never switches another. Unset, phones are
   * read-only and desktops are not.
   */
  private readOnlyKey(): string {
    return `daily-page:read-only:${this.app.vault.getName()}`;
  }

  private storedReadOnly(): string | null {
    try {
      return window.localStorage.getItem(this.readOnlyKey());
    } catch {
      return null;
    }
  }

  isReadOnly(): boolean {
    return resolveReadOnly(this.storedReadOnly(), Platform.isMobile);
  }

  setReadOnly(value: boolean): void {
    try {
      window.localStorage.setItem(this.readOnlyKey(), value ? "on" : "off");
    } catch {
      // Storage can be blocked. The device then keeps its default.
    }
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
  private async ensureTodayNote(now: Date): Promise<TFile> {
    const path = normalizePath(dailyNotePath(now, this.settings.dailyPattern));
    // An existing note is returned as it is, so the template is read only when a note has to be created.
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    return this.notes.ensure(path, await this.newNoteTemplate());
  }

  /**
   * The content for a new daily note: the template note in the vault when one is set and usable, otherwise the
   * built-in content. Every reason the template is not used is reported to the reader.
   */
  private async newNoteTemplate(): Promise<string> {
    const path = this.settings.templatePath;
    if (!path) return DEFAULT_NEW_NOTE_CONTENT;
    const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
    if (!(file instanceof TFile)) {
      new Notice(`The daily note template "${path}" was not found, so the built-in note is used.`);
      return DEFAULT_NEW_NOTE_CONTENT;
    }
    let template: string;
    try {
      template = await this.app.vault.read(file);
    } catch (error) {
      new Notice(`The daily note template could not be read: ${reasonOf(error)}`);
      return DEFAULT_NEW_NOTE_CONTENT;
    }
    const { content, problem } = resolveNewNote(template);
    if (problem) new Notice(problem);
    return content;
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
    // Checked before the note is created, since creating today's note is a write too.
    if (this.isReadOnly()) {
      new Notice(READ_ONLY_MESSAGE);
      return;
    }
    try {
      await action();
    } catch (error) {
      new Notice(`The note could not be saved: ${reasonOf(error)}`);
    }
  }

  /** The quotes kept by day in the plugin's settings. */
  private quoteStore(): QuoteStore {
    return {
      get: (day) => this.settings.quotes[day] ?? null,
      set: async (quote) => {
        // Days older than the kept window are dropped, so the saved settings do not grow without limit.
        this.settings.quotes = pruneQuotes({ ...this.settings.quotes, [quote.date]: quote }, new Date());
        // A read-only device keeps the quote in memory and writes no file, so the synced settings are not changed.
        if (!this.isReadOnly()) await this.saveSettings();
      },
    };
  }

  private askText(placeholder: string, onSubmit: (text: string) => void): void {
    new PromptModal(this.app, placeholder, onSubmit).open();
  }

  /**
   * Draws the page from the note's page scope, the same lines the edits change, and wires clicks
   * back to the note. The block is kept in step with its note while the note is typed in.
   */
  private async renderBlock(el: HTMLElement, sourcePath: string): Promise<void> {
    const now = new Date();

    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    // The note's own day: its path, or its creation day, rather than today.
    const noteDay = noteDateOf(
      sourcePath,
      this.settings.dailyPattern,
      file instanceof TFile ? file.stat.ctime : undefined,
    );
    let content: string;
    try {
      // The open editor's text when the note is open, so a redraw never shows an older save.
      content = this.openEditorText(sourcePath) ?? (file instanceof TFile ? await this.app.vault.read(file) : "");
    } catch (error) {
      showBlockMessage(el, `The note could not be read: ${reasonOf(error)}`);
      return;
    }

    // The quote last drawn for this block, so a redraw while typing keeps it.
    let quote: QuoteText | null = null;
    this.liveBlocks.set(el, {
      path: sourcePath,
      paint: (text) => this.paintBlock(el, sourcePath, text, noteDay, quote),
    });

    // The page is drawn at once with the quote kept for its own day. Only today's note, named by its path, fetches.
    await drawNoteQuote({
      store: this.quoteStore(),
      source: QUOTE_SOURCE,
      noteDay,
      namedByPath: dateFromNotePath(sourcePath, this.settings.dailyPattern) !== null,
      now,
      draw: (next) => {
        quote = next;
        this.paintBlock(el, sourcePath, content, noteDay, quote);
      },
      stillShown: () => el.isConnected,
    });
  }

  /** The text of a note open in an editor, or null when no editor has it open. */
  private openEditorText(path: string): string | null {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.path === path) return view.editor.getValue();
    }
    return null;
  }

  /** Draws one block from a note's text. Used when the block first draws, and again as the note is typed in. */
  private paintBlock(
    el: HTMLElement,
    sourcePath: string,
    text: string,
    noteDay: Date,
    quote: QuoteText | null,
  ): void {
    const lines = splitLines(text);
    if (countDailyPageBlocks(lines) > 1) {
      showBlockMessage(el, MULTIPLE_BLOCKS);
      return;
    }
    const scope = scopeOf(lines);
    if (!scope) {
      showBlockMessage(el, NO_PAGE_MESSAGE);
      return;
    }

    renderPage(el, lines.slice(scope.start, scope.end), new Date(), quote, {
      date: noteDay,
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
  }

  /**
   * Redraws the blocks of the note being typed in, from the editor's text. Obsidian saves a note only
   * after a pause, and a block draws from the saved note, so without this the page lags behind the typing.
   * Redraws are batched to one per frame, from the text as it is when the frame runs.
   */
  private followEditor(editor: Editor, info: MarkdownView | MarkdownFileInfo): void {
    const path = info.file?.path;
    if (!path) return;
    this.livePending = { editor, path };
    if (this.liveFrame !== null) return;
    this.liveFrame = requestAnimationFrame(() => {
      this.liveFrame = null;
      const pending = this.livePending;
      this.livePending = null;
      if (!pending) return;
      const text = pending.editor.getValue();
      for (const [el, block] of this.liveBlocks) {
        // A block that has left the note stops being followed.
        if (!el.isConnected) {
          this.liveBlocks.delete(el);
          continue;
        }
        if (block.path === pending.path) block.paint(text);
      }
    });
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
          if (!isSafeVaultPath(pattern)) {
            new Notice('The daily note path must stay inside the vault: no ".." and no leading slash.');
            return;
          }
          this.plugin.settings.dailyPattern = pattern;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Read-only on this device")
      .setDesc(
        "Stops this device writing notes, so it cannot conflict with another device over sync. " +
          "On by default on phones and tablets. This choice is kept on this device only.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.isReadOnly()).onChange((value) => this.plugin.setReadOnly(value)),
      );

    new Setting(containerEl)
      .setName("Daily note template")
      .setDesc("Optional. Path of a note in the vault to copy new daily notes from, such as 99_System/Templates/Daily note.md. Leave blank to use the built-in note.")
      .addText((text) =>
        text.setValue(this.plugin.settings.templatePath).onChange(async (value) => {
          const path = value.trim();
          if (path && !isSafeVaultPath(path)) {
            new Notice('The template path must stay inside the vault: no ".." and no leading slash.');
            return;
          }
          this.plugin.settings.templatePath = path;
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
