/** Mean length of a synodic month, in days. */
const SYNODIC_MONTH_DAYS = 29.530588853;

/** A reference new moon: 2000-01-06 18:14 UTC. */
const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface MoonPhase {
  name: string;
  icon: string;
}

const PHASES: MoonPhase[] = [
  { name: "New moon", icon: "🌑" },
  { name: "Waxing crescent", icon: "🌒" },
  { name: "First quarter", icon: "🌓" },
  { name: "Waxing gibbous", icon: "🌔" },
  { name: "Full moon", icon: "🌕" },
  { name: "Waning gibbous", icon: "🌖" },
  { name: "Last quarter", icon: "🌗" },
  { name: "Waning crescent", icon: "🌘" },
];

/**
 * Approximate moon phase from the mean synodic month. Accurate to within about a day,
 * which is enough for a page icon.
 */
export function moonPhase(date: Date): MoonPhase {
  const days = (date.getTime() - REFERENCE_NEW_MOON_MS) / MS_PER_DAY;
  const cycle = ((days % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
  const fraction = cycle / SYNODIC_MONTH_DAYS;
  // Eight phases, each centred on its eighth of the cycle, so round rather than floor.
  const index = Math.round(fraction * 8) % 8;
  return PHASES[index];
}
