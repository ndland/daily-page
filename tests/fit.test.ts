// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { doneLayout, fitPage } from "../src/render/fit";

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

describe("doneLayout", () => {
  it("shows every finished todo, with no more row, when they all fit", () => {
    expect(doneLayout(3, 1000, 10)).toEqual({ shown: 3, more: false });
    expect(doneLayout(3, 40, 10)).toEqual({ shown: 3, more: false });
  });

  it("shows two fewer rows than the budget holds, one for the label and one for the more row", () => {
    // A 40px budget at 10px a row holds four rows: the label, two todos, and the more row.
    expect(doneLayout(4, 40, 10)).toEqual({ shown: 2, more: true });
  });

  it("shows no todos, but still the more row, when the budget holds only the label and that row", () => {
    expect(doneLayout(5, 20, 10)).toEqual({ shown: 0, more: true });
  });

  it("shows no more row when the budget holds only the label, since the label alone fills it", () => {
    expect(doneLayout(5, 10, 10)).toEqual({ shown: 0, more: false });
    expect(doneLayout(5, 0, 10)).toEqual({ shown: 0, more: false });
  });
});

describe("fitPage and the reader's scroll", () => {
  it("fits the page to its place in the note, so scrolling the note does not change the fit", () => {
    const scrolled = pageAt(0);
    const scrolledScroller = noteWith(scrolled, { visible: 900, pageTop: 60, paddingBottom: 0 });
    scrolledScroller.scrollTop = 50;
    fitPage(scrolled);

    // The same page, at the place it reaches once the 50px of scrolling is counted: 60 + 50 = 110.
    const unscrolled = pageAt(0);
    noteWith(unscrolled, { visible: 900, pageTop: 110, paddingBottom: 0 });
    fitPage(unscrolled);

    expect(scrolled.style.height).toBe(unscrolled.style.height);
  });
});
