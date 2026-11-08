import { describe, expect, it } from "vitest";
import { hasRunningActivity } from "../src/logic/liveRefresh";

describe("hasRunningActivity", () => {
  it("is true for a running activity", () => {
    expect(hasRunningActivity("## Timeline\n- 09:00-10:00 Email\n- 10:00- Draft\n")).toBe(true);
  });

  it("is false when every activity has ended, or only side notes remain", () => {
    expect(hasRunningActivity("## Timeline\n- 09:00-10:00 Email\n- 09:40 note: idea\n")).toBe(false);
  });

  it("is false for a closed activity whose label starts with a digit", () => {
    expect(hasRunningActivity("- 09:00-10:00 3 things\n")).toBe(false);
  });
});
