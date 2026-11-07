// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { doneItemsShown, fitPage } from "../src/render/fit";

/** A stand-in window with a given height, so the maths can be checked without a screen. */
const windowOf = (innerHeight: number) => ({ innerHeight }) as Window;

/** A page element whose top edge sits at `top` pixels from the top of the window. */
function pageAt(top: number): HTMLElement {
  const page = document.createElement("div");
  page.getBoundingClientRect = () => ({ top }) as DOMRect;
  return page;
}

/**
 * A reading-view scroller holding a page at `pageTop`, with `paddingBottom` below it.
 * `after` lists heights of elements placed after the page inside the scroller.
 */
function noteWith(
  page: HTMLElement,
  options: { visible: number; pageTop: number; paddingBottom: number; after?: number[] },
): HTMLElement {
  const scroller = document.createElement("div");
  scroller.className = "markdown-preview-view";
  scroller.style.paddingBottom = `${options.paddingBottom}px`;
  scroller.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  Object.defineProperty(scroller, "clientHeight", { value: options.visible });
  scroller.scrollTop = 0;
  page.getBoundingClientRect = () => ({ top: options.pageTop }) as DOMRect;
  scroller.appendChild(page);
  // Attach to the document, so computed styles (such as padding) are read as they would be in Obsidian.
  document.body.appendChild(scroller);
  for (const height of options.after ?? []) {
    const sibling = document.createElement("div");
    Object.defineProperty(sibling, "offsetHeight", { value: height });
    scroller.appendChild(sibling);
  }
  return scroller;
}

describe("fitPage inside the note", () => {
  it("fills the visible area below the page, less the padding below it and the reserve", () => {
    const page = document.createElement("div");
    noteWith(page, { visible: 1000, pageTop: 110, paddingBottom: 32 });

    fitPage(page, windowOf(1200));
    // 1000 visible - 110 above - 32 padding - 16 reserved
    expect(page.style.height).toBe("842px");
  });

  it("counts anything placed after the page", () => {
    const page = document.createElement("div");
    noteWith(page, { visible: 1000, pageTop: 110, paddingBottom: 32, after: [100] });

    fitPage(page, windowOf(1200));
    // 1000 - 110 - (32 + 100) - 16
    expect(page.style.height).toBe("742px");
  });

  it("does not depend on the page's current height", () => {
    const page = document.createElement("div");
    page.style.height = "120px";
    noteWith(page, { visible: 1000, pageTop: 110, paddingBottom: 32 });

    fitPage(page, windowOf(1200));
    expect(page.style.height).toBe("842px");
  });

  it("never goes below the minimum height", () => {
    const page = document.createElement("div");
    noteWith(page, { visible: 300, pageTop: 110, paddingBottom: 32 });

    fitPage(page, windowOf(1200));
    expect(page.style.height).toBe("320px");
  });
});

describe("fitPage outside a reading view", () => {
  it("fills the space from the page's top to the bottom of the window", () => {
    const page = pageAt(100);
    fitPage(page, windowOf(800));
    // 800 - 100 - 16 reserved
    expect(page.style.height).toBe("684px");
  });

  it("uses zero as the top when the page is scrolled above the window", () => {
    const page = pageAt(-200);
    fitPage(page, windowOf(800));
    expect(page.style.height).toBe("784px");
  });

  it("never goes below the minimum height", () => {
    const page = pageAt(100);
    fitPage(page, windowOf(200));
    expect(page.style.height).toBe("320px");
  });
});

describe("doneItemsShown", () => {
  it("shows every finished todo when they all fit", () => {
    expect(doneItemsShown(3, 1000, 10)).toBe(3);
  });

  it("shows two fewer rows than the budget holds, one for the label and one for the more row", () => {
    // A 40px budget at 10px a row holds four rows: the label, two todos, and the "+N more" row.
    expect(doneItemsShown(3, 40, 10)).toBe(3);
    expect(doneItemsShown(4, 40, 10)).toBe(2);
  });

  it("shows none when the budget holds only the label and the more row", () => {
    expect(doneItemsShown(5, 20, 10)).toBe(0);
  });
});
