export const MINUTES_PER_DAY = 24 * 60;

const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

/** Parses "HH:MM" into minutes from midnight. Returns null when the text is not a valid time. */
export function parseTime(text: string): number | null {
  const match = TIME_PATTERN.exec(text);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Formats minutes from midnight as "HH:MM". Throws if the value is outside one day. */
export function formatTime(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= MINUTES_PER_DAY) {
    throw new RangeError(`Minutes out of range for one day: ${minutes}`);
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${pad2(hours)}:${pad2(mins)}`;
}

/** Minutes from midnight for a Date, using local time. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

/** The next half hour after `minute` (10:12 gives 10:30, 10:30 gives 11:00), wrapping at midnight. */
export function nextHalfHour(minute: number): number {
  return ((Math.floor(minute / 30) + 1) * 30) % MINUTES_PER_DAY;
}
