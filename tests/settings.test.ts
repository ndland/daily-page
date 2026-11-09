import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, MAX_QUOTE_TEXT, normaliseSettings } from "../src/logic/settings";
import { DEFAULT_DAILY_PATTERN } from "../src/logic/paths";
import { DEFAULT_TAG_COLOURS, PREVIOUS_TAG_COLOURS } from "../src/defaults";

const quote = { date: "2026-11-06", text: "Hi", author: "A" };

describe("normaliseSettings: quotes", () => {
  it("moves the single quote of an earlier version into the per-day store, and asks for a save", () => {
    const { settings, migrated } = normaliseSettings({ quote });
    expect(settings.quotes).toEqual({ "2026-11-06": quote });
    expect(migrated).toBe(true);
  });

  it("never overwrites a quote the day already has", () => {
    const newer = { date: "2026-11-06", text: "Newer", author: "B" };
    const { settings } = normaliseSettings({ quotes: { "2026-11-06": newer }, quote });
    expect(settings.quotes["2026-11-06"]).toEqual(newer);
  });

  it("removes an empty legacy field, without adding a quote", () => {
    const { settings, migrated } = normaliseSettings({ quote: null });
    expect(settings.quotes).toEqual({});
    expect(migrated).toBe(true);
  });

  it("does not ask for a save when there is no legacy field", () => {
    expect(normaliseSettings({}).migrated).toBe(false);
    expect(normaliseSettings(undefined).migrated).toBe(false);
  });

  it("drops a stored quote that is too long, or has a malformed day", () => {
    const long = { date: "2026-11-05", text: "x".repeat(MAX_QUOTE_TEXT + 1), author: "A" };
    const badDay = { date: "5 November", text: "Fine", author: "A" };
    const { settings } = normaliseSettings({ quotes: { "2026-11-05": long, "5 November": badDay } });
    expect(settings.quotes).toEqual({});
  });

  it("keeps a stored quote stored under the day it names", () => {
    // An entry filed under a day other than the one its quote names is not trusted, so only the matching entry survives.
    const { settings } = normaliseSettings({ quotes: { "2026-11-06": quote, "2026-11-05": quote } });
    expect(Object.keys(settings.quotes)).toEqual(["2026-11-06"]);
  });
});

describe("normaliseSettings: values", () => {
  it("replaces an accent colour that is not a six-digit hex colour with the default", () => {
    expect(normaliseSettings({ accentColor: "red; background: url(x)" }).settings.accentColor).toBe(DEFAULT_SETTINGS.accentColor);
    expect(normaliseSettings({ accentColor: "#FF79C6" }).settings.accentColor).toBe("#FF79C6");
  });

  it("refuses a template path that leaves the vault", () => {
    expect(normaliseSettings({ templatePath: "../outside.md" }).settings.templatePath).toBe("");
    expect(normaliseSettings({ templatePath: "/etc/x.md" }).settings.templatePath).toBe("");
    expect(normaliseSettings({ templatePath: "99_System/Templates/Daily note.md" }).settings.templatePath).toBe(
      "99_System/Templates/Daily note.md",
    );
  });

  it("falls back to the default daily-note pattern when the saved one leaves the vault", () => {
    expect(normaliseSettings({ dailyPattern: "../{YYYY}.md" }).settings.dailyPattern).toBe(DEFAULT_DAILY_PATTERN);
    expect(normaliseSettings({ dailyPattern: 123 }).settings.dailyPattern).toBe(DEFAULT_DAILY_PATTERN);
  });

  it("uses the defaults for anything that is not an object", () => {
    expect(normaliseSettings("not settings").settings).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings(null).settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe("tag colours that were never changed", () => {
  const FIRST = "work #8be9fd\ndeep #ff79c6";
  const SECOND = [
    "work #8be9fd",
    "deep #ff79c6",
    "meeting #ffb86c",
    "admin #f1fa8c",
    "health #50fa7b",
    "family #ff5555",
    "rest #6272a4",
  ].join("\n");

  it("move up to the current defaults, and are saved that way", () => {
    const { settings, migrated } = normaliseSettings({ tagColours: FIRST });
    expect(settings.tagColours).toBe(DEFAULT_TAG_COLOURS);
    expect(migrated).toBe(true);
  });

  it("move up from the second set of defaults too, which had deep and no home", () => {
    const { settings, migrated } = normaliseSettings({ tagColours: SECOND });
    expect(settings.tagColours).toBe(DEFAULT_TAG_COLOURS);
    expect(settings.tagColours).toContain("home #ff79c6");
    expect(migrated).toBe(true);
  });

  it("move up from either set when it was saved with Windows line endings or stray blank space", () => {
    for (const saved of [FIRST + "\n", "  " + SECOND + "\n", SECOND.replace(/\n/g, "\r\n"), FIRST.replace("\n", "\r\n")]) {
      const { settings, migrated } = normaliseSettings({ tagColours: saved });
      expect(settings.tagColours, JSON.stringify(saved)).toBe(DEFAULT_TAG_COLOURS);
      expect(migrated).toBe(true);
    }
  });

  it("leave the current defaults alone, so loading them again changes nothing", () => {
    const { settings, migrated } = normaliseSettings({ tagColours: DEFAULT_TAG_COLOURS });
    expect(settings.tagColours).toBe(DEFAULT_TAG_COLOURS);
    expect(migrated).toBe(false);
  });

  it("keep the second set with a tag added, or in another order", () => {
    for (const mine of [SECOND + "\nlearn #bd93f9", SECOND.split("\n").reverse().join("\n")]) {
      const { settings, migrated } = normaliseSettings({ tagColours: mine });
      expect(settings.tagColours).toBe(mine);
      expect(migrated).toBe(false);
    }
  });

  it("never list the current defaults as an earlier set, which would upgrade them for ever", () => {
    expect(PREVIOUS_TAG_COLOURS).not.toContain(DEFAULT_TAG_COLOURS);
  });

  it("keep the second set when the reader changed a colour in it", () => {
    const mine = SECOND.replace("#ff5555", "#111111");
    expect(normaliseSettings({ tagColours: mine }).settings.tagColours).toBe(mine);
  });

  it("keep anything the reader wrote", () => {
    const mine = "work #112233\ndeep #ff79c6";
    const { settings, migrated } = normaliseSettings({ tagColours: mine });
    expect(settings.tagColours).toBe(mine);
    expect(migrated).toBe(false);
    expect(normaliseSettings({ tagColours: "" }).settings.tagColours).toBe("");
  });
});
