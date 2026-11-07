import { describe, expect, it, vi } from "vitest";
import { throttled } from "../src/logic/throttle";

describe("throttled", () => {
  it("lets the first attempt through and blocks attempts inside the interval", async () => {
    let now = 0;
    const inner = { fetchQuote: vi.fn(async () => ({ text: "Hi", author: "A" })) };
    const source = throttled(inner, 10_000, () => now);

    await expect(source.fetchQuote()).resolves.toEqual({ text: "Hi", author: "A" });
    now = 5_000;
    await expect(source.fetchQuote()).rejects.toThrow("throttled");
    expect(inner.fetchQuote).toHaveBeenCalledTimes(1);
  });

  it("allows another attempt once the interval has passed", async () => {
    let now = 0;
    const inner = { fetchQuote: vi.fn(async () => ({ text: "Hi", author: "A" })) };
    const source = throttled(inner, 10_000, () => now);

    await source.fetchQuote();
    now = 10_000;
    await source.fetchQuote();
    expect(inner.fetchQuote).toHaveBeenCalledTimes(2);
  });

  it("counts a failed attempt, so an outage is not retried on every render", async () => {
    let now = 0;
    const inner = {
      fetchQuote: vi.fn(async () => {
        throw new Error("offline");
      }),
    };
    const source = throttled(inner, 10_000, () => now);

    await expect(source.fetchQuote()).rejects.toThrow("offline");
    now = 1_000;
    await expect(source.fetchQuote()).rejects.toThrow("throttled");
    expect(inner.fetchQuote).toHaveBeenCalledTimes(1);
  });
});

describe("throttled across midnight", () => {
  it("refuses an attempt just after midnight, and allows one once the interval has passed", async () => {
    const minute = 60_000;
    let now = new Date(2026, 10, 6, 23, 50).getTime();
    const inner = { fetchQuote: vi.fn(async () => ({ text: "Hi", author: "A" })) };
    const source = throttled(inner, 15 * minute, () => now);

    await source.fetchQuote();
    now = new Date(2026, 10, 7, 0, 1).getTime();
    await expect(source.fetchQuote()).rejects.toThrow("throttled");
    now = new Date(2026, 10, 7, 0, 5).getTime() + 10 * minute;
    await source.fetchQuote();
    expect(inner.fetchQuote).toHaveBeenCalledTimes(2);
  });
});
