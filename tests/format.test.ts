import { describe, expect, it } from "vitest";
import {
  formatEntry,
  parseEntry,
  readTimeline,
  validateTimeline,
  writeTimeline,
} from "../src/entries/format";

describe("parseEntry", () => {
  it("reads a closed activity", () => {
    expect(parseEntry("- 09:00-10:15 Email")).toEqual({
      kind: "activity",
      start: 540,
      end: 615,
      label: "Email",
    });
  });

  it("reads a running activity with no end time", () => {
    expect(parseEntry("- 10:15- Proposal draft")).toEqual({
      kind: "activity",
      start: 615,
      end: null,
      label: "Proposal draft",
    });
  });

  it("reads a side note", () => {
    expect(parseEntry("- 09:40 note: idea for the proposal")).toEqual({
      kind: "note",
      time: 580,
      text: "idea for the proposal",
    });
  });

  it("returns null for lines that are not entries", () => {
    expect(parseEntry("- 9:00-10:00 Email")).toBeNull();
    expect(parseEntry("- 25:00-26:00 Email")).toBeNull();
    expect(parseEntry("- just a bullet")).toBeNull();
    expect(parseEntry("")).toBeNull();
  });
});

describe("formatEntry", () => {
  it("writes each entry kind in canonical form", () => {
    expect(formatEntry({ kind: "activity", start: 540, end: 615, label: "Email" })).toBe(
      "- 09:00-10:15 Email",
    );
    expect(formatEntry({ kind: "activity", start: 615, end: null, label: "Proposal draft" })).toBe(
      "- 10:15- Proposal draft",
    );
    expect(formatEntry({ kind: "note", time: 580, text: "idea" })).toBe("- 09:40 note: idea");
  });

  it("round-trips canonical lines exactly", () => {
    const lines = [
      "- 09:00-10:15 Email",
      "- 10:15- Proposal draft",
      "- 09:40 note: idea for the proposal",
    ];
    for (const line of lines) {
      const entry = parseEntry(line);
      expect(entry).not.toBeNull();
      expect(formatEntry(entry!)).toBe(line);
    }
  });
});

describe("readTimeline and writeTimeline", () => {
  const note = [
    "---",
    "type: daily",
    "---",
    "",
    "## Timeline",
    "- 09:00-10:15 Email",
    "- 09:40 note: idea for the proposal",
    "- 10:15- Proposal draft",
    "",
    "## Checklist",
    "- [ ] Walk",
  ];

  it("reads only the Timeline section", () => {
    const timeline = readTimeline(note);
    expect(timeline.map((line) => line.raw)).toEqual([
      "- 09:00-10:15 Email",
      "- 09:40 note: idea for the proposal",
      "- 10:15- Proposal draft",
      "",
    ]);
  });

  it("writes an unchanged timeline back byte for byte", () => {
    const timeline = readTimeline(note);
    expect(writeTimeline(note, timeline)).toEqual(note);
  });

  it("keeps malformed lines and flags them", () => {
    const withBadLine = [...note.slice(0, 6), "- 25:00-26:00 Broken", ...note.slice(6)];
    const timeline = readTimeline(withBadLine);
    expect(timeline.some((line) => line.raw === "- 25:00-26:00 Broken")).toBe(true);
    expect(writeTimeline(withBadLine, timeline)).toEqual(withBadLine);
    expect(validateTimeline(timeline)).toEqual([
      { index: 1, message: "Unrecognised entry; kept as written" },
    ]);
  });

  it("reads a missing section as an empty timeline", () => {
    expect(readTimeline(["# Just a note", ""])).toEqual([]);
  });

  it("appends a Timeline section when the note has none", () => {
    const bare = ["# Just a note", ""];
    const written = writeTimeline(bare, [
      { raw: "- 09:00- Email", entry: { kind: "activity", start: 540, end: null, label: "Email" } },
    ]);
    expect(written).toEqual(["# Just a note", "", "## Timeline", "- 09:00- Email"]);
  });
});

describe("validateTimeline", () => {
  it("flags a second running activity but not a closed one", () => {
    const timeline = [
      { raw: "- 09:00- Email", entry: parseEntry("- 09:00- Email") },
      { raw: "- 10:00- Draft", entry: parseEntry("- 10:00- Draft") },
      { raw: "- 08:00-08:30 Walk", entry: parseEntry("- 08:00-08:30 Walk") },
    ];
    expect(validateTimeline(timeline)).toEqual([
      { index: 1, message: "More than one running activity" },
    ]);
  });

  it("returns no issues for a clean timeline", () => {
    const timeline = readTimeline([
      "## Timeline",
      "- 09:00-10:15 Email",
      "- 10:15- Proposal draft",
    ]);
    expect(validateTimeline(timeline)).toEqual([]);
  });
});
