import type { TFile, Vault } from "obsidian";
import { describe, expect, it } from "vitest";
import { readTimeline, writeTimeline } from "../src/entries/format";
import { endRunning, logActivity } from "../src/entries/log";
import { appendChecklistItem } from "../src/entries/edit";
import { applyNoteEdit } from "../src/vault/noteEdit";

const NOW = new Date(2026, 10, 6, 11, 0);
const FILE = {} as TFile;

function lines(timeline: ReturnType<typeof readTimeline>): string {
  return writeTimeline(["## Timeline"], timeline).join("\n");
}

describe("an activity that crosses midnight", () => {
  it("ends at 09:00 the next day when it began at 23:00, a span of ten hours", () => {
    const outcome = endRunning(readTimeline(["## Timeline", "- 23:00- Sleep"]), 9 * 60);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(lines(outcome.timeline)).toContain("- 23:00-09:00 Sleep");
  });

  it("ends at 00:30 when it began at 23:00", () => {
    const outcome = endRunning(readTimeline(["## Timeline", "- 23:00- Sleep"]), 30);
    expect(outcome.ok).toBe(true);
  });

  it("starts a new activity at 00:30 after a 23:00 activity ends there", () => {
    const outcome = logActivity(readTimeline(["## Timeline", "- 23:00- Sleep"]), "Walk", 30);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(lines(outcome.timeline)).toContain("- 23:00-00:30 Sleep");
  });
});

describe("a note with two daily-page blocks", () => {
  it("is refused by the write path, and written to by no block", async () => {
    const twoBlocks = "```daily-page\n## Timeline\n```\n\n```daily-page\n## Timeline\n```\n";
    const state = { content: twoBlocks };
    const vault = {
      read: () => Promise.resolve(state.content),
      process: (_file: TFile, edit: (data: string) => string) => {
        state.content = edit(state.content);
        return Promise.resolve(state.content);
      },
    } as unknown as Vault;

    const result = await applyNoteEdit(vault, FILE, (scope) => appendChecklistItem(scope, "Read"), NOW);

    expect(result.ok).toBe(false);
    expect(state.content).toBe(twoBlocks);
  });
});
