import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, MAX_QUOTE_TEXT, normaliseSettings } from "../src/logic/settings";
import { DEFAULT_DAILY_PATTERN } from "../src/logic/paths";

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
