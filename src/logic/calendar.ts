const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** Day of the year, 1 to 366, using local calendar dates. */
export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getFullYear(), 0, 1);
  const current = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((current - start) / (24 * 60 * 60 * 1000)) + 1;
}

export interface DateBlock {
  month: string;
  day: string;
  weekday: string;
  dayOfYear: number;
}

/** The date block's text fields. Month and weekday names are fixed, so they do not depend on locale. */
export function dateBlock(date: Date): DateBlock {
  return {
    month: MONTHS[date.getMonth()],
    day: String(date.getDate()),
    weekday: WEEKDAYS[date.getDay()],
    dayOfYear: dayOfYear(date),
  };
}

/**
 * A month as rows of seven cells, Monday first. Null marks a blank cell
 * before the 1st or after the last day.
 */
export function monthGrid(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first index: Monday is 0, Sunday is 6.
  const leading = (first.getDay() + 6) % 7;

  const cells: (number | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/**
 * ISO 8601 week number (Monday starts the week; week 1 holds the year's first Thursday).
 * Works on the local calendar date, so daylight saving changes do not shift it.
 */
export function isoWeek(date: Date): number {
  const DAY = 24 * 60 * 60 * 1000;
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Move to the Thursday of this week, which always falls in the same ISO year.
  const mondayFirst = (day.getUTCDay() + 6) % 7;
  const thursday = new Date(day.getTime() + (3 - mondayFirst) * DAY);
  // Week 1 is the week containing 4 January, i.e. the week of the year's first Thursday.
  const jan4 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const jan4Monday = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = jan4.getTime() - jan4Monday * DAY;
  return Math.floor((thursday.getTime() - week1Monday) / (7 * DAY)) + 1;
}

export const WEEKDAY_HEADINGS = ["M", "T", "W", "T", "F", "S", "S"];
