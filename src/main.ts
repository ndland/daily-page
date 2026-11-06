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
import { TimelineLine, readTimeline, writeTimeline } from "./entries/format";
import { LogOutcome, endRunning, logActivity, logNote } from "./entries/log";
import { DEFAULT_DAILY_PATTERN, dailyNotePath, folderChain } from "./logic/paths";
import { minutesOfDay } from "./logic/time";
import { StoredQuote, loadDailyQuote } from "./logic/quoteCache";
import { renderPage } from "./render/page";

interface DailyPageSettings {
  dailyPattern: string;
  quote: StoredQuote | null;
}

const DEFAULT_SETTINGS: DailyPageSettings = {
  dailyPattern: DEFAULT_DAILY_PATTERN,
  quote: null,
};

/** Used when today's note does not exist yet. Both sections are created so later logs have a place. */
const NEW_NOTE_CONTENT = "## Timeline\n\n## Checklist\n";

/** The note content before the last log action, kept for one level of undo. */
interface UndoSnapshot {
  path: string;
  content: string;
}

type LogAction = (timeline: TimelineLine[], now: number) => LogOutcome;

function splitLines(content: string): string[] {
  return content.split(/\r?\n/);
}

export default class DailyPagePlugin extends Plugin {
  settings: DailyPageSettings = { ...DEFAULT_SETTINGS };
  private undo: UndoSnapshot | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

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

    this.registerMarkdownCodeBlockProcessor(
      "daily-page",
      async (_source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        await this.renderInNote(el, ctx);
      },
    );

    this.addSettingTab(new DailyPageSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<DailyPageSettings>) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** Applies a log action to today's note. Only today's note is ever written. */
  private async log(action: LogAction): Promise<void> {
    const now = new Date();
    const file = await this.ensureTodayNote(now);
    const content = await this.app.vault.read(file);

    // Keep the file's own line endings so Windows CRLF notes do not gain stray carriage returns.
    const eol = content.includes("\r\n") ? "\r\n" : "\n";
    const lines = content.split(eol);
    const outcome = action(readTimeline(lines), minutesOfDay(now));

    if (!outcome.ok) {
      new Notice(outcome.message);
      return;
    }

    this.undo = { path: file.path, content };
    await this.app.vault.modify(file, writeTimeline(lines, outcome.timeline).join(eol));
  }

  private async undoLast(): Promise<void> {
    if (!this.undo) {
      new Notice("Nothing to undo.");
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(this.undo.path);
    if (!(file instanceof TFile)) {
      new Notice("The note for the last action is gone.");
      this.undo = null;
      return;
    }

    await this.app.vault.modify(file, this.undo.content);
    this.undo = null;
    new Notice("Undid the last log action.");
  }

  /** Returns today's note, creating it and its folders if they do not exist. */
  private async ensureTodayNote(now: Date): Promise<TFile> {
    const path = normalizePath(dailyNotePath(now, this.settings.dailyPattern));
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;

    for (const folder of folderChain(path)) {
      if (!this.app.vault.getAbstractFileByPath(folder)) {
        await this.app.vault.createFolder(folder);
      }
    }
    return this.app.vault.create(path, NEW_NOTE_CONTENT);
  }

  private askText(placeholder: string, onSubmit: (text: string) => void): void {
    new PromptModal(this.app, placeholder, onSubmit).open();
  }

  /** Draws the page for the note that contains the `daily-page` code block. */
  private async renderInNote(el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    const content = file instanceof TFile ? await this.app.vault.read(file) : "";
    const now = new Date();

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

    renderPage(el, splitLines(content), now, quote);
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
          this.plugin.settings.dailyPattern = value.trim() || DEFAULT_DAILY_PATTERN;
          await this.plugin.saveSettings();
        }),
      );
  }
}
