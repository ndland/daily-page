import { describe, expect, it } from "vitest";
import { moonPhase } from "../src/logic/moon";

const DAY = 24 * 60 * 60 * 1000;
/** The reference new moon, 2000-01-06 18:14 UTC. */
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC = 29.530588853;

describe("moonPhase", () => {
  it("names the phase at the reference new moon", () => {
    expect(moonPhase(new Date(NEW_MOON)).name).toBe("New moon");
  });

  it("names the full moon about half a synodic month after the new moon", () => {
    expect(moonPhase(new Date(NEW_MOON + (SYNODIC / 2) * DAY)).name).toBe("Full moon");
  });

  it("names the quarters a quarter and three quarters of the way round", () => {
    expect(moonPhase(new Date(NEW_MOON + (SYNODIC / 4) * DAY)).name).toBe("First quarter");
    expect(moonPhase(new Date(NEW_MOON + (3 * SYNODIC / 4) * DAY)).name).toBe("Last quarter");
  });

  it("gives each of the eight phases its own moon icon, in order from the new moon", () => {
    const icons = Array.from({ length: 8 }, (_, i) => moonPhase(new Date(NEW_MOON + ((i * SYNODIC) / 8) * DAY)).icon);
    expect(icons).toEqual(["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"]);
  });
});
