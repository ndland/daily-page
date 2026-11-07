import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_NEW_NOTE_CONTENT, resolveNewNote } from "../src/logic/newNote";

describe("resolveNewNote", () => {
  it("uses the built-in content when no template is set", () => {
    expect(resolveNewNote(null)).toEqual({ content: DEFAULT_NEW_NOTE_CONTENT, problem: null });
    expect(resolveNewNote(undefined)).toEqual({ content: DEFAULT_NEW_NOTE_CONTENT, problem: null });
  });

  it("resets a template's block to the three empty sections, so its entries are not copied", () => {
    const template = "```daily-page\r\n## Timeline\r\n- 09:00-10:00 Email\r\n## Checklist\r\n- [ ] Walk\r\n```\r\n";
    expect(resolveNewNote(template)).toEqual({
      content: "```daily-page\r\n## Timeline\r\n\r\n## Checklist\r\n\r\n## Three things\r\n```\r\n",
      problem: null,
    });
  });

  it("keeps the text outside the block exactly as the template has it", () => {
    const template = "---\ncssclasses:\n  - daily-note\n---\n\n```dataviewjs\nawait dv.view(\"x\");\n```\n\n```daily-page\n```\n";
    const { content, problem } = resolveNewNote(template);
    expect(problem).toBeNull();
    expect(content.startsWith("---\ncssclasses:\n  - daily-note\n---\n\n```dataviewjs\nawait dv.view(\"x\");\n```\n\n")).toBe(true);
    expect(content.endsWith("```daily-page\n## Timeline\n\n## Checklist\n\n## Three things\n```\n")).toBe(true);
  });

  it("gives an empty closed block the three sections", () => {
    expect(resolveNewNote("```daily-page\n```\n").content).toBe(DEFAULT_NEW_NOTE_CONTENT);
  });

  it("refuses a template with two blocks, and says why", () => {
    const { content, problem } = resolveNewNote("```daily-page\n```\n\n```daily-page\n```\n");
    expect(content).toBe(DEFAULT_NEW_NOTE_CONTENT);
    expect(problem).toContain("more than one daily-page block");
  });

  it("refuses a template with no block, and says why", () => {
    const { content, problem } = resolveNewNote("# Just a heading\n");
    expect(content).toBe(DEFAULT_NEW_NOTE_CONTENT);
    expect(problem).toContain("has no daily-page block");
  });

  it("refuses a template whose block is never closed, and says why", () => {
    const { content, problem } = resolveNewNote("```daily-page\n## Timeline\n");
    expect(content).toBe(DEFAULT_NEW_NOTE_CONTENT);
    expect(problem).toContain("not closed");
  });

  it("uses the shipped template as it is", () => {
    const shipped = readFileSync("templates/daily-note.md", "utf8");
    expect(resolveNewNote(shipped)).toEqual({ content: shipped, problem: null });
  });
});
