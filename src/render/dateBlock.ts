import { WEEKDAY_HEADINGS, dateBlock, monthGrid } from "../logic/calendar";
import { moonPhase } from "../logic/moon";

/** Renders the date block (top left) into `parent`. */
export function renderDateBlock(parent: HTMLElement, date: Date): void {
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

  block.append(month, day, weekday, moonEl, doy);
  parent.appendChild(block);
}

/** Renders the mini month calendar (Monday first) with today highlighted. */
export function renderMiniCalendar(parent: HTMLElement, date: Date): void {
  const calendar = document.createElement("div");
  calendar.className = "daily-page__calendar";

  for (const heading of WEEKDAY_HEADINGS) {
    const cell = document.createElement("span");
    cell.className = "daily-page__calendar-head";
    cell.textContent = heading;
    calendar.appendChild(cell);
  }

  const today = date.getDate();
  for (const row of monthGrid(date.getFullYear(), date.getMonth())) {
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
