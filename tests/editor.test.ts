// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readTimeline, writeTimeline } from "../src/entries/format";
import type { ScopeEdit } from "../src/entries/edit";
import { openBlockEditor, openPlanDialog } from "../src/vault/editor";
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

describe("openBlockEditor, starting a planned block", () => {
  const planned: PositionedBlock = { ...runningDraft, label: "Review", timeText: "14:00-15:00", running: false, raw: "- 14:00-15:00 Review" };

  it("offers Start now for a closed block, which starts it at the current minute", () => {
    const save = vi.fn<(edit: ScopeEdit) => void>();
    openBlockEditor({ ...planned, index: 0 }, save);
    document.querySelector<HTMLButtonElement>(".daily-page__dialog-extra")!.click();

    const outcome = save.mock.calls[0][0](["## Timeline", "- 14:00-15:00 Review"], 13 * 60 + 40);
    expect(outcome).toEqual({ ok: true, lines: ["## Timeline", "- 13:40- Review"] });
  });

  it("does not offer Start now for a running activity", () => {
    openBlockEditor(runningDraft, vi.fn());
    expect(document.querySelector(".daily-page__dialog-extra")).toBeNull();
  });
});

describe("openPlanDialog", () => {
  it("suggests the start and half an hour after it, and saves a plan", () => {
    const save = vi.fn<(edit: ScopeEdit) => void>();
    openPlanDialog(14 * 60, save);
    const fields = document.querySelectorAll<HTMLInputElement>(".daily-page__dialog input");
    expect([fields[1].value, fields[2].value]).toEqual(["14:00", "14:30"]);

    fields[0].value = "Review #meeting";
    document.querySelector<HTMLButtonElement>(".daily-page__dialog-save")!.click();
    const outcome = save.mock.calls[0][0](["## Timeline"], 0);
    expect(outcome).toEqual({ ok: true, lines: ["## Timeline", "- 14:00-14:30 Review #meeting"] });
  });
});

describe("openBlockEditor, Start now details", () => {
  const closed: PositionedBlock = { ...runningDraft, label: "Review", timeText: "14:00-15:00", running: false, raw: "- 14:00-15:00 Review", index: 0 };

  it("starts with the label as typed in the dialog", () => {
    const save = vi.fn<(edit: ScopeEdit) => void>();
    openBlockEditor(closed, save);
    document.querySelector<HTMLInputElement>(".daily-page__dialog input")!.value = "Review photos";
    document.querySelector<HTMLButtonElement>(".daily-page__dialog-extra")!.click();

    const outcome = save.mock.calls[0][0](["## Timeline", "- 14:00-15:00 Review"], 13 * 60);
    expect(outcome).toEqual({ ok: true, lines: ["## Timeline", "- 13:00- Review photos"] });
  });

  it("offers no Start now on a past day's note", () => {
    openBlockEditor(closed, vi.fn(), { canStart: false });
    expect(document.querySelector(".daily-page__dialog-extra")).toBeNull();
  });
});
