// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readTimeline, writeTimeline } from "../src/entries/format";
import type { ScopeEdit } from "../src/entries/edit";
import { openBlockEditor } from "../src/vault/editor";
import type { PositionedBlock } from "../src/render/timeline";

const runningDraft: PositionedBlock = {
  kind: "activity",
  label: "Draft",
  timeText: "10:00-now",
  topPct: 0,
  heightPct: 0,
  running: true,
  outOfAxis: false,
  colour: null,
  index: 1,
  raw: "- 10:00- Draft",
};

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("openBlockEditor for an activity", () => {
  it("shows a running activity with a blank end, and saving it blank keeps it running", () => {
    const save = vi.fn<(edit: ScopeEdit) => void>();
    openBlockEditor(runningDraft, save);

    const fields = document.querySelectorAll<HTMLInputElement>(".daily-page__dialog input");
    expect(fields[1].value).toBe("10:00");
    expect(fields[2].value).toBe("");

    document.querySelector<HTMLButtonElement>(".daily-page__dialog-save")!.click();
    expect(save).toHaveBeenCalledTimes(1);

    const scope = ["## Timeline", "- 09:00-09:30 Email", "- 10:00- Draft"];
    const outcome = save.mock.calls[0][0](scope, 11 * 60);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(writeTimeline(["## Timeline"], readTimeline(outcome.lines))).toContain("- 10:00- Draft");
  });
});
