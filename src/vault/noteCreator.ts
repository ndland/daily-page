import { folderChain } from "../logic/paths";

/** The part of the vault that creating a note needs. Obsidian's Vault satisfies it. */
export interface NoteVault<TFile> {
  getAbstractFileByPath(path: string): unknown;
  createFolder(path: string): Promise<unknown>;
  create(path: string, data: string): Promise<TFile>;
}

/**
 * Returns a note, creating it with its folders when it does not exist. Two requests for the same
 * path at once share one creation, so the second cannot try to make what the first is making. If
 * the note appears in between (from sync, say), that note is used rather than failing.
 */
export class NoteCreator<TFile> {
  private readonly pending = new Map<string, Promise<TFile>>();

  constructor(
    private readonly vault: NoteVault<TFile>,
    private readonly isFile: (entry: unknown) => entry is TFile,
  ) {}

  ensure(path: string, content: string): Promise<TFile> {
    const inFlight = this.pending.get(path);
    if (inFlight) return inFlight;

    const work = this.createIfMissing(path, content).finally(() => this.pending.delete(path));
    this.pending.set(path, work);
    return work;
  }

  private async createIfMissing(path: string, content: string): Promise<TFile> {
    const existing = this.vault.getAbstractFileByPath(path);
    if (this.isFile(existing)) return existing;

    for (const folder of folderChain(path)) {
      if (!this.vault.getAbstractFileByPath(folder)) {
        // The folder may have appeared since the check. If it did not, create() below fails too.
        await this.vault.createFolder(folder).catch(() => undefined);
      }
    }

    try {
      return await this.vault.create(path, content);
    } catch (error) {
      const appeared = this.vault.getAbstractFileByPath(path);
      if (this.isFile(appeared)) return appeared;
      throw error;
    }
  }
}
