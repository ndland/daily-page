import { describe, expect, it, vi } from "vitest";
import { NoteCreator, type NoteVault } from "../src/vault/noteCreator";

interface FakeFile {
  path: string;
  content: string;
}

/** A vault where files and folders appear only when created, and creating twice fails, as in Obsidian. */
function fakeVault(options: { appearDuringCreate?: boolean } = {}) {
  const files = new Map<string, FakeFile>();
  const folders = new Set<string>();
  const vault: NoteVault<FakeFile> & { creates: number; folders: Set<string> } = {
    creates: 0,
    folders,
    getAbstractFileByPath(path) {
      return files.get(path) ?? (folders.has(path) ? { path } : null);
    },
    async createFolder(path) {
      if (folders.has(path)) throw new Error("Folder already exists.");
      folders.add(path);
    },
    async create(path, content) {
      this.creates += 1;
      // A slow create gives the second caller time to start while this one is still running.
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (options.appearDuringCreate) {
        // Another window or sync made the note first. Obsidian refuses to create it again.
        files.set(path, { path, content: "made elsewhere" });
        throw new Error("File already exists.");
      }
      if (files.has(path)) throw new Error("File already exists.");
      const file = { path, content };
      files.set(path, file);
      return file;
    },
  };
  return vault;
}

const PATH = "05_Daily/2026/11-November/2026-11-07.md";
const isFile = (entry: unknown): entry is FakeFile =>
  typeof entry === "object" && entry !== null && "content" in entry;

describe("NoteCreator", () => {
  it("creates the note once when two requests for it arrive together", async () => {
    const vault = fakeVault();
    const creator = new NoteCreator<FakeFile>(vault, isFile);

    const [first, second] = await Promise.all([creator.ensure(PATH, "page"), creator.ensure(PATH, "page")]);

    expect(vault.creates).toBe(1);
    expect(first).toBe(second);
    expect(first.content).toBe("page");
  });

  it("returns the existing note without creating anything", async () => {
    const vault = fakeVault();
    const creator = new NoteCreator<FakeFile>(vault, isFile);
    await creator.ensure(PATH, "page");
    const again = await creator.ensure(PATH, "page");

    expect(vault.creates).toBe(1);
    expect(again.content).toBe("page");
  });

  it("creates the folders the note needs", async () => {
    const vault = fakeVault();
    const creator = new NoteCreator<FakeFile>(vault, isFile);
    await creator.ensure(PATH, "page");

    expect([...vault.folders]).toEqual(["05_Daily", "05_Daily/2026", "05_Daily/2026/11-November"]);
  });

  it("uses a note that appeared while it was being created, rather than failing", async () => {
    const vault = fakeVault({ appearDuringCreate: true });
    const creator = new NoteCreator<FakeFile>(vault, isFile);

    const note = await creator.ensure(PATH, "page");

    expect(note.content).toBe("made elsewhere");
  });

  it("reports a failure when the note cannot be created and does not exist", async () => {
    const vault = fakeVault();
    vi.spyOn(vault, "create").mockRejectedValueOnce(new Error("disk full"));
    const creator = new NoteCreator<FakeFile>(vault, isFile);

    await expect(creator.ensure(PATH, "page")).rejects.toThrow("disk full");
  });
});
