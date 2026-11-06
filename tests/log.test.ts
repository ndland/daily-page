import { describe, expect, it } from "vitest";
import { readTimeline, writeTimeline } from "../src/entries/format";
import { endRunning, logActivity, logNote } from "../src/entries/log";
import { parseTime } from "../src/logic/time";

const at = (text: string) => parseTime(text) as number;

/** A timeline built from entry lines, as if they sat under a "## Timeline" heading. */
const timelineOf = (entries: string[]) => readTimeline(["## Timeline", ...entries]);

/** The lines of the timeline as they would be written to the note. */
const lines = (timeline: ReturnType<typeof readTimeline>) => timeline.map((line) => line.raw);

function expectOk(outcome: ReturnType<typeof logActivity>) {
  if (!outcome.ok) throw new Error(`Expected success, got: ${outcome.message}`);
  return outcome.timeline;
}

describe("logActivity", () => {
  it("starts the first activity on an empty timeline", () => {
    const next = expectOk(logActivity([], "Email", at("09:00")));
    expect(lines(next)).toEqual(["- 09:00- Email"]);
  });

  it("ends the running activity at the new stamp and starts the next", () => {
    const start = timelineOf(["- 09:00- Email"]);
    const next = expectOk(logActivity(start, "Proposal draft", at("10:15")));
    expect(lines(next)).toEqual(["- 09:00-10:15 Email", "- 10:15- Proposal draft"]);
  });

  it("does not mutate the timeline it was given", () => {
    const start = timelineOf(["- 09:00- Email"]);
    const before = lines(start);
    logActivity(start, "Proposal draft", at("10:15"));
    expect(lines(start)).toEqual(before);
  });

  it("rejects a time earlier than the running activity's start", () => {
    const start = timelineOf(["- 10:00- Email"]);
    const outcome = logActivity(start, "Walk", at("09:30"));
    expect(outcome.ok).toBe(false);
  });

  it("rejects an empty label", () => {
    expect(logActivity([], "   ", at("09:00")).ok).toBe(false);
  });

  it("collapses whitespace in labels so each entry stays on one line", () => {
    const next = expectOk(logActivity([], "  Deep\nwork   block ", at("09:00")));
    expect(lines(next)).toEqual(["- 09:00- Deep work block"]);
  });
});

describe("logNote", () => {
  it("adds a note without changing the running activity", () => {
    const start = timelineOf(["- 09:00- Email"]);
    const next = expectOk(logNote(start, "idea for the proposal", at("09:40")));
    expect(lines(next)).toEqual(["- 09:00- Email", "- 09:40 note: idea for the proposal"]);
  });

  it("rejects an empty note", () => {
    expect(logNote([], "", at("09:40")).ok).toBe(false);
  });
});

describe("endRunning", () => {
  it("sets the end time and adds no line", () => {
    const start = timelineOf(["- 09:00- Email"]);
    const next = expectOk(endRunning(start, at("09:30")));
    expect(lines(next)).toEqual(["- 09:00-09:30 Email"]);
  });

  it("fails when nothing is running", () => {
    const start = timelineOf(["- 09:00-09:30 Email"]);
    expect(endRunning(start, at("10:00")).ok).toBe(false);
  });

  it("rejects a time earlier than the running activity's start", () => {
    const start = timelineOf(["- 09:00- Email"]);
    expect(endRunning(start, at("08:00")).ok).toBe(false);
  });
});

describe("a morning written with these actions", () => {
  it("produces the timeline from the spec example", () => {
    let timeline = expectOk(logActivity([], "Email", at("09:00")));
    timeline = expectOk(logNote(timeline, "idea for the proposal", at("09:40")));
    timeline = expectOk(logActivity(timeline, "Proposal draft", at("10:15")));

    expect(lines(timeline)).toEqual([
      "- 09:00-10:15 Email",
      "- 09:40 note: idea for the proposal",
      "- 10:15- Proposal draft",
    ]);
  });

  it("writes into the note with the rest of the file intact", () => {
    const note = ["---", "type: daily", "---", "", "## Timeline", "", "## Checklist", "- [ ] Walk"];
    let timeline = readTimeline(note);
    timeline = expectOk(logActivity(timeline, "Email", at("09:00")));
    const written = writeTimeline(note, timeline);

    expect(written).toEqual([
      "---",
      "type: daily",
      "---",
      "",
      "## Timeline",
      "- 09:00- Email",
      "",
      "## Checklist",
      "- [ ] Walk",
    ]);
  });
});
