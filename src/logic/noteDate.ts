import { LONG_MONTHS } from "./paths";

type Field = "year" | "month" | "monthName" | "day";

/** Each daily-note token: the expression that matches it in a path, and the field it names. */
const TOKENS = new Map<string, { expression: string; field: Field }>([
  ["{YYYY}", { expression: "(\\d{4})", field: "year" }],
  ["{MMMM}", { expression: "([A-Za-z]+)", field: "monthName" }],
  ["{MM}", { expression: "(\\d{2})", field: "month" }],
  ["{DD}", { expression: "(\\d{2})", field: "day" }],
]);

/** Splits a pattern into its literal text and its tokens, keeping the tokens. */
const TOKEN_SPLIT = /(\{YYYY\}|\{MMMM\}|\{MM\}|\{DD\})/;

function escapeLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The month number for an English month name, in any letter case, or undefined when it is not one. */
function monthNumber(name: string): number | undefined {
  const index = LONG_MONTHS.findIndex((month) => month.toLowerCase() === name.toLowerCase());
  return index === -1 ? undefined : index + 1;
}

/** The one value every token of a field agrees on, or null when there are none or they disagree. */
function agreed(values: number[]): number | null {
  if (values.length === 0 || values.some((value) => value !== values[0])) return null;
  return values[0];
}

/**
 * The date a daily note is for, read back from its path. The path is built from the daily-note
 * pattern (see dailyNotePath), so the same tokens are matched here: {YYYY}, {MM}, {MMMM} and {DD}.
 * Returns null when the path does not match the pattern, when it names a day that does not exist, or
 * when its tokens disagree about the date (for example {MM} says 11 and {MMMM} says March).
 *
 * The date is returned at noon, so no time zone or daylight-saving change can move it to another day.
 */
export function dateFromNotePath(path: string, pattern: string): Date | null {
  const fields: Field[] = [];
  const expression = pattern
    .split(TOKEN_SPLIT)
    .map((part) => {
      const token = TOKENS.get(part);
      if (!token) return escapeLiteral(part);
      fields.push(token.field);
      return token.expression;
    })
    .join("");

  const match = new RegExp(`^${expression}$`).exec(path);
  if (!match) return null;

  const values: Record<Field, number[]> = { year: [], month: [], monthName: [], day: [] };
  for (const [i, field] of fields.entries()) {
    const text = match[i + 1];
    if (field === "monthName") {
      const named = monthNumber(text);
      if (named === undefined) return null;
      values.monthName.push(named);
    } else {
      values[field].push(Number(text));
    }
  }

  const year = agreed(values.year);
  const day = agreed(values.day);
  const month = agreed([...values.month, ...values.monthName]);
  if (year === null || month === null || day === null) return null;

  const date = new Date(year, month - 1, day, 12, 0);
  // A day such as 31 February rolls over into March, so it is not a day that exists.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

/**
 * The date a note is for: the date in its path when that matches the pattern, otherwise the day the
 * note was created. Only when neither is known does it fall back to the current time, which is why
 * an old note that is not named by the pattern still keeps its own creation day where it can.
 */
export function noteDateOf(path: string, pattern: string, createdMs: number | undefined): Date {
  return dateFromNotePath(path, pattern) ?? (createdMs !== undefined ? new Date(createdMs) : new Date());
}

/** When a file was created, in milliseconds, from a file record that may carry a Dataview or Obsidian time. */
export function createdMsOf(file: unknown): number | undefined {
  const created = (file as { ctime?: { toMillis?: () => number; toJSDate?: () => Date } } | null | undefined)?.ctime;
  if (typeof created?.toMillis === "function") return created.toMillis();
  if (typeof created?.toJSDate === "function") return created.toJSDate().getTime();
  return undefined;
}
