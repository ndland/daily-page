import { describe, expect, it } from "vitest";
import { NoteCreator, type NoteVault } from "../src/vault/noteCreator";

interface FakeFile {
  path: string;
  content: string;
}

const PATH = "05_Daily/2026/11-November/2026-11-07.md";
const isFile = (entry: unknown): entry is FakeFile =>
  typeof entry === "object" && entry !== null && "content" in entry;

/** A vault whose create and createFolder can be made to fail on their next call. */
function vaultWith() {
  const files = new Map<string, FakeFile>();
  const folders = new Set<string>();
  const failures = { create: [] as Error[], createFolder: [] as Error[] };
  const vault: NoteVault<FakeFile> = {
    getAbstractFileByPath(path) {
      return files.get(path) ?? (folders.has(path) ? { path } : null);
    },
    async createFolder(path) {
      const error = failures.createFolder.shift();
      if (error) throw error;
      folders.add(path);
    },
    async create(path, content) {
      const error = failures.create.shift();
      if (error) throw error;
      const file = { path, content };
      files.set(path, file);
      return file;
    },
  };
  return { vault, failures };
}

describe("NoteCreator failures", () => {
  it("does not keep a failed creation, so the next request tries again and succeeds", async () => {
    const { vault, failures } = vaultWith();
    failures.create.push(new Error("disk full"));
    const creator = new NoteCreator<FakeFile>(vault, isFile);

    await expect(creator.ensure(PATH, "page")).rejects.toThrow("disk full");
    const note = await creator.ensure(PATH, "page");

    expect(note.content).toBe("page");
  });

  it("reports the reason when the note cannot be created and no note appears", async () => {
    const { vault, failures } = vaultWith();
    failures.create.push(new Error("disk full"));
    const creator = new NoteCreator<FakeFile>(vault, isFile);

    await expect(creator.ensure(PATH, "page")).rejects.toThrow("disk full");
  });

  it("carries on when a folder cannot be created, and reports the note's own failure", async () => {
    const { vault, failures } = vaultWith();
    failures.createFolder.push(new Error("folder exists elsewhere"));
    failures.create.push(new Error("disk full"));
    const creator = new NoteCreator<FakeFile>(vault, isFile);

    await expect(creator.ensure(PATH, "page")).rejects.toThrow("disk full");
  });
});
