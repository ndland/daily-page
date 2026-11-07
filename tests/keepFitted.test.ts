// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { drawGrid, keepFitted } from "../src/render/fit";
import { renderPage } from "../src/render/page";

/** Every ResizeObserver the code creates, so a test can fire them and see what was disconnected. */
const observers: { callback: ResizeObserverCallback; disconnected: boolean }[] = [];
/** Animation frames the code has asked for and not yet been given. */
let frames: FrameRequestCallback[] = [];

function runFrames(): void {
  const pending = frames;
  frames = [];
  for (const callback of pending) callback(0);
}

function fireResize(observer: { callback: ResizeObserverCallback }): void {
  observer.callback([], {} as ResizeObserver);
}

function renderInHost(): { host: HTMLElement; page: HTMLElement } {
  const host = document.createElement("div");
  document.body.appendChild(host);
  renderPage(host, ["## Timeline", "- 09:00-10:00 Email"], new Date(2026, 10, 6, 11, 0), null);
  return { host, page: host.querySelector<HTMLElement>(".daily-page")! };
}

beforeEach(() => {
  document.body.innerHTML = "";
  observers.length = 0;
  frames = [];
  window.ResizeObserver = class {
    readonly callback: ResizeObserverCallback;
    disconnected = false;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
      observers.push(this as unknown as { callback: ResizeObserverCallback; disconnected: boolean });
    }
    observe() {}
    unobserve() {}
    disconnect() {
      (this as unknown as { disconnected: boolean }).disconnected = true;
    }
  } as unknown as typeof ResizeObserver;
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  }) as typeof window.requestAnimationFrame;
});

describe("keepFitted redraws", () => {
  it("queues one frame for a burst of resize events, so a window drag redraws once per frame", () => {
    const { page } = renderInHost();
    keepFitted(page);
    const observer = observers[observers.length - 1];
    for (let i = 0; i < 5; i++) fireResize(observer);
    expect(frames).toHaveLength(1);
  });

  it("redraws when the queued frame runs", () => {
    const { page } = renderInHost();
    keepFitted(page);
    page.style.height = "1px";
    fireResize(observers[observers.length - 1]);
    runFrames();
    expect(page.style.height).toBe("752px");
  });

  it("disconnects the observer of a page that has left the note", () => {
    const { host, page } = renderInHost();
    keepFitted(page);
    const observer = observers[observers.length - 1];
    host.remove();
    fireResize(observer);
    expect(observer.disconnected).toBe(true);
  });

  it("disconnects the old observer when the page is drawn again in the same note", () => {
    const { host, page } = renderInHost();
    keepFitted(page);
    const first = observers[observers.length - 1];

    renderPage(host, ["## Timeline", "- 09:00-10:00 Email"], new Date(2026, 10, 6, 11, 0), null);
    keepFitted(host.querySelector<HTMLElement>(".daily-page")!);

    expect(first.disconnected).toBe(true);
    expect(observers[observers.length - 1].disconnected).toBe(false);
  });
});

describe("drawGrid", () => {
  function sized(height: number, width: number): HTMLElement {
    const notes = document.createElement("div");
    Object.defineProperty(notes, "clientHeight", { value: height, configurable: true });
    Object.defineProperty(notes, "clientWidth", { value: width, configurable: true });
    return notes;
  }

  it("draws one line per grid unit, both ways, and reuses the lines when the size changes", () => {
    const notes = sized(100, 50);
    drawGrid(notes, 10);
    expect(notes.querySelectorAll(".daily-page__grid-row")).toHaveLength(11);
    expect(notes.querySelectorAll(".daily-page__grid-col")).toHaveLength(6);

    Object.defineProperty(notes, "clientHeight", { value: 200, configurable: true });
    drawGrid(notes, 10);
    const tops = [...notes.querySelectorAll<HTMLElement>(".daily-page__grid-row")].map((row) => row.style.top);
    expect(tops).toHaveLength(21);
    expect(new Set(tops).size).toBe(21);

    Object.defineProperty(notes, "clientHeight", { value: 100, configurable: true });
    drawGrid(notes, 10);
    expect(notes.querySelectorAll(".daily-page__grid-row")).toHaveLength(11);
    expect(notes.querySelectorAll(".daily-page__grid")).toHaveLength(1);
  });
});
