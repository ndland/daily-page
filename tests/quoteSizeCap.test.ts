import { beforeEach, describe, expect, it, vi } from "vitest";

const requestUrl = vi.fn();
vi.mock("obsidian", () => ({ requestUrl: (...args: unknown[]) => requestUrl(...args) }));

const { zenQuotesSource } = await import("../src/quoteSource");

beforeEach(() => {
  requestUrl.mockReset();
});

describe("zenQuotesSource, reply size", () => {
  it("refuses an oversized reply before parsing it", async () => {
    requestUrl.mockResolvedValue({ text: "x".repeat(5000), json: [{ q: "Keep going.", a: "Someone" }] });
    await expect(zenQuotesSource.fetchQuote()).rejects.toThrow("too large");
  });

  it("accepts a reply of a normal size", async () => {
    // A fresh copy of the source has no earlier attempt, so the throttle lets this one through.
    vi.resetModules();
    const { zenQuotesSource: fresh } = await import("../src/quoteSource");
    const body = JSON.stringify([{ q: "Keep going.", a: "Someone" }]);
    requestUrl.mockResolvedValue({ text: body, json: JSON.parse(body) });
    await expect(fresh.fetchQuote()).resolves.toEqual({ text: "Keep going.", author: "Someone" });
  });
});
