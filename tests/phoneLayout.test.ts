// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderPage } from "../src/render/page";
import { clearFit, keepFitted } from "../src/render/fit";

const note = [
  "## Timeline",
  "- 09:00-10:15 Email #work",
  "- 09:40 note: a side note long enough that a narrow column would have cut it short",
  "- 13:30-13:45 Quick call (15 min) #work",
  "",
  "## Checklist",
  "- [x] Walk",
  "- [x] Water",
  "- [x] Read ten pages",
  "- [x] New todo",
  "- [x] Nice",
  "- [ ] two",
  "",
  "## Three things",
  "- Finish the proposal draft and send it to the team before Friday",
];

/** Makes the stylesheet's phone query match or not, as a narrow or wide screen would. */
function screenIsPhone(isPhone: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: isPhone,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

function renderInPage(): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  renderPage(host, note, new Date(2026, 10, 6, 14, 30), null);
  return host.querySelector<HTMLElement>(".daily-page")!;
}

describe("keepFitted by screen width", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  it("fits the page to the window on a wide screen", () => {
    screenIsPhone(false);
    const page = renderInPage();
    keepFitted(page);
    // The window is 768px tall in jsdom, less the 16px reserve, so the page fills 752px.
    expect(page.style.height).toBe("752px");
  });

  it("leaves the page to its natural height on a phone, rather than fitting it", () => {
    screenIsPhone(true);
    const page = renderInPage();
    page.style.height = "500px";
    keepFitted(page);
    expect(page.style.height).toBe("");
  });

  it("shows every finished todo on a phone, even when the desktop fit had hidden some", () => {
    const page = renderInPage();
    const items = [...page.querySelectorAll<HTMLElement>(".daily-page__done-item")];
    for (const item of items) item.hidden = true;

    screenIsPhone(true);
    keepFitted(page);

    expect(items.map((item) => item.hidden)).toEqual(items.map(() => false));
    expect(page.querySelector<HTMLElement>(".daily-page__done-more")?.hidden).toBe(true);
  });

  it("clears the desktop grid and note positions when it falls back to the phone layout", () => {
    const page = renderInPage();
    const notes = page.querySelector<HTMLElement>(".daily-page__notes")!;
    const grid = document.createElement("div");
    grid.className = "daily-page__grid";
    notes.prepend(grid);
    const noteEl = page.querySelector<HTMLElement>(".daily-page__note");
    if (noteEl) noteEl.style.top = "120px";

    clearFit(page);

    expect(page.querySelector(".daily-page__grid")).toBeNull();
    expect(noteEl?.style.top).toBe("");
  });
});
