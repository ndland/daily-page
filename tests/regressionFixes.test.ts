import type { TFile, Vault } from "obsidian";
import { describe, expect, it } from "vitest";
import { appendChecklistItem } from "../src/entries/edit";
import { readTimeline, writeTimeline } from "../src/entries/format";
import { endRunning } from "../src/entries/log";
import { scopeOf } from "../src/logic/scope";
import { applyNoteEdit } from "../src/vault/noteEdit";

const NOW = new Date(2026, 10, 6, 11, 0);
const FILE = {} as TFile;

/** A vault whose note is read and written in place, for one edit at a time. */
function vaultWith(content: string) {
  const state = { content };
  const vault = {
    read: () => Promise.resolve(state.content),
    process: (_file: TFile, edit: (data: string) => string) => {
      state.content = edit(state.content);
      return Promise.resolve(state.content);
    },
  };
  return { state, vault: vault as unknown as Vault };
}

describe("a page inside a daily-page block, with a final newline", () => {
  it("appends a checklist inside the block, without a blank line, and keeps the final newline (LF)", async () => {
    const { state, vault } = vaultWith("```daily-page\n## Timeline\n- 09:00-10:00 Email\n```\n");
    await applyNoteEdit(vault, FILE, (scope) => appendChecklistItem(scope, "Read"), NOW);
    expect(state.content).toBe("```daily-page\n## Timeline\n- 09:00-10:00 Email\n## Checklist\n- [ ] Read\n```\n");
  });

  it("appends a checklist inside the block, and keeps the final newline (CRLF)", async () => {
    const { state, vault } = vaultWith("```daily-page\r\n## Timeline\r\n- 09:00-10:00 Email\r\n```\r\n");
    await applyNoteEdit(vault, FILE, (scope) => appendChecklistItem(scope, "Read"), NOW);
    expect(state.content).toBe(
      "```daily-page\r\n## Timeline\r\n- 09:00-10:00 Email\r\n## Checklist\r\n- [ ] Read\r\n```\r\n",
    );
  });

  it("uses the block's content as its scope, without the fence lines", () => {
    expect(scopeOf(["```daily-page", "## Timeline", "- 09:00- Email", "```", ""])).toEqual({ start: 1, end: 3 });
  });
});

describe("ending an activity after midnight", () => {
  it("ends an activity that started at 23:30 at 00:10 the next day", () => {
    const timeline = readTimeline(["## Timeline", "- 23:30- Sleep"]);
    const outcome = endRunning(timeline, 10);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(writeTimeline(["## Timeline"], outcome.timeline)).toContain("- 23:30-00:10 Sleep");
  });

  it("still says so when the time given is earlier, and no span wraps to it", () => {
    const outcome = endRunning(readTimeline(["## Timeline", "- 10:00- Email"]), 9 * 60);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).toContain("earlier");
  });
});

describe("a closed block with no page section", () => {
  it("is an empty page, with no reader text taken as the page", () => {
    expect(scopeOf(["```daily-page", "```", "Reader text"])).toEqual({ start: 1, end: 1 });
  });
});
