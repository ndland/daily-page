import { beforeEach, describe, expect, it, vi } from "vitest";

const requestUrl = vi.fn();
vi.mock("obsidian", () => ({ requestUrl: (...args: unknown[]) => requestUrl(...args) }));

const { zenQuotesSource, withTimeout } = await import("../src/quoteSource");

beforeEach(() => {
  requestUrl.mockReset();
  const body = JSON.stringify([{ q: "Keep going.", a: "Someone" }]);
  requestUrl.mockResolvedValue({ text: body, json: JSON.parse(body) });
});

describe("zenQuotesSource", () => {
  it("asks ZenQuotes once, however often it is called within the interval", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 7, 9, 0));
    try {
      await expect(zenQuotesSource.fetchQuote()).resolves.toEqual({ text: "Keep going.", author: "Someone" });
      vi.setSystemTime(new Date(2026, 10, 7, 9, 1));
      await expect(zenQuotesSource.fetchQuote()).rejects.toThrow("throttled");
      expect(requestUrl).toHaveBeenCalledTimes(1);
      expect(requestUrl.mock.calls[0][0].url).toBe("https://zenquotes.io/api/today");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("withTimeout", () => {
  it("gives up on a request that never answers", async () => {
    vi.useFakeTimers();
    try {
      const stalled = new Promise<never>(() => {});
      const outcome = withTimeout(stalled, 5000).catch((error: Error) => error.message);
      await vi.advanceTimersByTimeAsync(5000);
      await expect(outcome).resolves.toBe("ZenQuotes: request timed out");
    } finally {
      vi.useRealTimers();
    }
  });

  it("passes on an answer that arrives in time", async () => {
    await expect(withTimeout(Promise.resolve("quote"), 5000)).resolves.toBe("quote");
  });
});
