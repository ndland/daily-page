import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("the phone breakpoint", () => {
  it("is the same 500px query in the layout code and in the stylesheet", () => {
    const fit = readFileSync("src/render/fit.ts", "utf8");
    const css = readFileSync("styles/daily-page.css", "utf8");
    expect(fit).toContain('const PHONE_QUERY = "(max-width: 500px)";');
    expect(css).toContain("@media (max-width: 500px)");
  });
});
