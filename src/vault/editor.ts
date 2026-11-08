import { editGreatThing, editNoteText, editTimelineEntry, type LineRef, type ScopeEdit } from "../entries/edit";
import { planBlock, startPlannedBlock } from "../entries/log";
import { MINUTES_PER_DAY, formatTime } from "../logic/time";
import type { GreatThing } from "../render/greatThings";
import type { PositionedBlock } from "../render/timeline";
import { openFieldsDialog } from "./dialog";

/**
 * Opens the editor for a clicked block: an activity, or a side note. When the reader saves,
 * `save` receives the change as a scope edit, to apply to the note.
 */
export function openBlockEditor(block: PositionedBlock, save: (edit: ScopeEdit) => void): void {
  const ref: LineRef = { raw: block.raw, index: block.index };

  if (block.kind === "note") {
    openFieldsDialog("Edit side note", [{ label: "Text", value: block.label }], ([text]) => {
      save((scope) => editNoteText(scope, ref, text));
    });
    return;
  }

  // timeText is "HH:MM-HH:MM", or "HH:MM-now" while the activity is running.
  const [start, end] = block.timeText.split("-");
  openFieldsDialog(
    "Edit activity",
    [
      { label: "Label (tags such as #work are kept)", value: block.label },
      { label: "Start (HH:MM)", value: start },
      { label: "End (HH:MM, blank for running)", value: end === "now" ? "" : end },
    ],
    ([label, startText, endText]) => {
      save((scope, minute) => editTimelineEntry(scope, ref, { label, start: startText, end: endText }, minute));
    },
    // A block that has ended can be started again now. A running one is already started.
    block.running
      ? []
      : [{ label: "Start now", run: () => save((scope, minute) => startPlannedBlock(scope, ref, minute)) }],
  );
}

/** Minutes a new plan lasts until the reader changes its end. */
const DEFAULT_PLAN_MINUTES = 30;

/**
 * Opens the dialog for planning a block: a label, a start and an end. `start` is the minute of the day to
 * suggest. `save` receives the plan as a scope edit, to apply to the note.
 */
export function openPlanDialog(start: number, save: (edit: ScopeEdit) => void): void {
  openFieldsDialog(
    "Plan a block",
    [
      { label: "Label (tags such as #work set the colour)", value: "" },
      { label: "Start (HH:MM)", value: formatTime(start) },
      { label: "End (HH:MM)", value: formatTime((start + DEFAULT_PLAN_MINUTES) % MINUTES_PER_DAY) },
    ],
    ([label, startText, endText]) => {
      save((scope) => planBlock(scope, { label, start: startText, end: endText }));
    },
  );
}

/** Opens the editor for one bullet of the Three things box. Blank text removes it. */
export function openGreatThingEditor(item: GreatThing, save: (edit: ScopeEdit) => void): void {
  const ref: LineRef = { raw: item.raw, index: item.index };
  openFieldsDialog("Edit thing", [{ label: "Text (leave blank to remove it)", value: item.text }], ([text]) => {
    save((scope) => editGreatThing(scope, ref, text));
  });
}
