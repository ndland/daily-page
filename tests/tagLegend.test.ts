// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderTagLegend } from "../src/render/legend";

describe("renderTagLegend", () => {
  it("shows every tag with its colour", () => {
    const parent = document.createElement("div");
    renderTagLegend(parent, { work: "#8be9fd", deep: "#ff79c6" });
    const chips = [...parent.querySelectorAll<HTMLElement>(".daily-page__legend-tag")];
    expect(chips.map((chip) => chip.textContent)).toEqual(["#work", "#deep"]);
    expect(chips[0].style.getPropertyValue("--dp-block-accent")).toBe("#8be9fd");
  });

  it("draws nothing when there are no tags", () => {
    const parent = document.createElement("div");
    renderTagLegend(parent, {});
    expect(parent.children).toHaveLength(0);
  });
});
