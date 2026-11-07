import { WEEKDAY_HEADINGS, dateBlock, isoWeek, monthGrid } from "../logic/calendar";
import { moonPhase } from "../logic/moon";

/** Renders the date block (top left) into `parent`. */
export function renderDateBlock(parent: HTMLElement, date: Date): HTMLElement {
  const fields = dateBlock(date);
  const moon = moonPhase(date);

  const block = document.createElement("div");
  block.className = "daily-page__date";

  const month = document.createElement("span");
  month.className = "daily-page__month";
  month.textContent = fields.month;

  const day = document.createElement("span");
  day.className = "daily-page__day";
  day.textContent = fields.day;

  const weekday = document.createElement("span");
  weekday.className = "daily-page__weekday";
  weekday.textContent = fields.weekday;

  const moonEl = document.createElement("span");
  moonEl.className = "daily-page__moon";
  moonEl.textContent = moon.icon;
  moonEl.title = moon.name;
  moonEl.setAttribute("aria-label", moon.name);

  const doy = document.createElement("span");
  doy.className = "daily-page__doy";
  doy.textContent = String(fields.dayOfYear);
  doy.title = `Day ${fields.dayOfYear} of the year`;

  // The last cell of the date box, stacked and centred: the moon, its phase name, then the day of the year.
  const phase = document.createElement("span");
  phase.className = "daily-page__moon-phase";
  phase.textContent = moon.name;

  const side = document.createElement("div");
  side.className = "daily-page__date-side";
  side.append(moonEl, phase, doy);

  block.append(month, day, weekday, side);
  parent.appendChild(block);
  return block;
}

/**
 * Renders the mini month calendar (Monday first) with today highlighted. The first column is the
 * ISO week number of each row.
 */
export function renderMiniCalendar(parent: HTMLElement, date: Date): void {
  const calendar = document.createElement("div");
  calendar.className = "daily-page__calendar";

  const weekHead = document.createElement("span");
  weekHead.className = "daily-page__calendar-head";
  weekHead.textContent = "W";
  calendar.appendChild(weekHead);

  for (const heading of WEEKDAY_HEADINGS) {
    const cell = document.createElement("span");
    cell.className = "daily-page__calendar-head";
    cell.textContent = heading;
    calendar.appendChild(cell);
  }

  const year = date.getFullYear();
  const month = date.getMonth();
  const today = date.getDate();
  for (const row of monthGrid(year, month)) {
    // Every day in a Monday-to-Sunday row shares one ISO week, so the row's first day gives it.
    const anyDay = row.find((day): day is number => day !== null);
    const week = document.createElement("span");
    week.className = "daily-page__calendar-week";
    if (anyDay !== undefined) week.textContent = String(isoWeek(new Date(year, month, anyDay)));
    calendar.appendChild(week);

    for (const day of row) {
      const cell = document.createElement("span");
      cell.className = "daily-page__calendar-cell";
      if (day !== null) {
        cell.textContent = String(day);
        if (day === today) cell.classList.add("is-today");
      }
      calendar.appendChild(cell);
    }
  }

  parent.appendChild(calendar);
}
