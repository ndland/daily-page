// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderPage } from "../src/render/page";
import { renderQuote } from "../src/render/quote";

const note = [
  "## Timeline",
  "- 09:00-10:15 Email",
  "- 09:40 note: idea for the proposal",
  "- 10:15- Proposal draft",
  "",
  "## Checklist",
  "- [ ] Walk",
  "- [x] Water",
];

describe("renderPage", () => {
  it("draws every part of the page in order", () => {
    const root = document.createElement("div");
    renderPage(root, note, new Date(2026, 10, 6, 11, 0), null);

    const page = root.querySelector(".daily-page");
    expect(page).not.toBeNull();
    expect(page!.querySelector(".daily-page__date")).not.toBeNull();
    expect(page!.querySelectorAll(".daily-page__checklist li:not(.daily-page__checklist-blank)")).toHaveLength(1);
    expect(page!.querySelector(".daily-page__done")).not.toBeNull();
    expect(page!.querySelectorAll(".daily-page__hour-label")).toHaveLength(8);
    expect(page!.querySelector(".daily-page__divider")).not.toBeNull();
    expect(page!.querySelector(".daily-page__calendar")).not.toBeNull();
  });

  it("puts activities in the timeline column and side notes in the notes column", () => {
    const root = document.createElement("div");
    renderPage(root, note, new Date(2026, 10, 6, 11, 0), null);

    const timeline = root.querySelector(".daily-page__timeline")!;
    const notes = root.querySelector(".daily-page__notes")!;
    expect(timeline.querySelectorAll(".daily-page__block")).toHaveLength(2);
    expect(notes.querySelectorAll(".daily-page__note")).toHaveLength(1);
  });

  it("marks the running activity", () => {
    const root = document.createElement("div");
    renderPage(root, note, new Date(2026, 10, 6, 11, 0), null);

    const running = root.querySelectorAll(".daily-page__block.is-running");
    expect(running).toHaveLength(1);
    expect(running[0].textContent).toContain("Proposal draft");
  });

  it("renders with no quote and no entries without throwing", () => {
    const root = document.createElement("div");
    expect(() => renderPage(root, [], new Date(2026, 10, 6, 8, 0), null)).not.toThrow();
    expect(root.querySelector(".daily-page__quote")).toBeNull();
    expect(root.querySelectorAll(".daily-page__block")).toHaveLength(0);
  });

  it("shows the quote when one is provided", () => {
    const root = document.createElement("div");
    renderPage(root, [], new Date(2026, 10, 6, 8, 0), {
      text: "Keep going",
      author: "Someone",
    });
    expect(root.querySelector(".daily-page__quote")?.textContent).toContain("Keep going");
  });

  it("shows the ZenQuotes attribution with a link whenever a quote is shown", () => {
    const root = document.createElement("div");
    renderPage(root, [], new Date(2026, 10, 6, 8, 0), {
      text: "Keep going",
      author: "Someone",
    });
    const link = root.querySelector<HTMLAnchorElement>(".daily-page__attribution a");
    expect(link?.textContent).toBe("ZenQuotes API");
    expect(link?.href).toBe("https://zenquotes.io/");
  });

  it("shows no attribution when there is no quote", () => {
    const root = document.createElement("div");
    renderPage(root, [], new Date(2026, 10, 6, 8, 0), null);
    expect(root.querySelector(".daily-page__attribution")).toBeNull();
  });

  it("applies the highlight colour as the accent variable", () => {
    const root = document.createElement("div");
    renderPage(root, note, new Date(2026, 10, 6, 11, 0), null, { accent: "#ff79c6" });
    const page = root.querySelector<HTMLElement>(".daily-page")!;
    expect(page.style.getPropertyValue("--dp-accent")).toBe("#ff79c6");
  });

  it("passes a tap on an empty todo box to the page's handler", () => {
    const onAddTodo = vi.fn();
    const root = document.createElement("div");
    renderPage(root, note, new Date(2026, 10, 6, 11, 0), null, { handlers: { onAddTodo } });
    root.querySelector<HTMLElement>(".daily-page__checklist-blank")!.click();
    expect(onAddTodo).toHaveBeenCalledTimes(1);
  });

  it("leaves the empty todo boxes untappable when the page has no handler for them", () => {
    const root = document.createElement("div");
    renderPage(root, note, new Date(2026, 10, 6, 11, 0), null);
    expect(root.querySelector(".daily-page__checklist-blank")!.classList.contains("is-clickable")).toBe(false);
  });
});

describe("the footer row of credit and tags", () => {
  const quote = { text: "Keep going", author: "Someone" };
  const colours = { work: "#8be9fd", home: "#ff79c6" };
  const draw = (q: typeof quote | null, tagColours?: Record<string, string>): HTMLElement => {
    const root = document.createElement("div");
    renderPage(root, [], new Date(2026, 10, 6, 8, 0), q, { tagColours });
    return root;
  };

  it("puts the quote, then one row with the credit and then the tags", () => {
    const left = draw(quote, colours).querySelector(".daily-page__footer-left")!;
    expect([...left.children].map((child) => child.className)).toEqual(["daily-page__quote", "daily-page__footer-meta"]);
    const row = left.querySelector(".daily-page__footer-meta")!;
    expect([...row.children].map((child) => child.className)).toEqual(["daily-page__attribution", "daily-page__legend"]);
  });

  it("lists the tags in the order of the settings", () => {
    const chips = [...draw(quote, colours).querySelectorAll(".daily-page__legend-tag")];
    expect(chips.map((chip) => chip.textContent)).toEqual(["#work", "#home"]);
  });

  it("shows the tags without a quote, and the credit without tags", () => {
    expect(draw(null, colours).querySelector(".daily-page__footer-meta .daily-page__legend")).not.toBeNull();
    expect(draw(null, colours).querySelector(".daily-page__attribution")).toBeNull();
    const credit = draw(quote);
    expect(credit.querySelector(".daily-page__footer-meta .daily-page__attribution")).not.toBeNull();
    expect(credit.querySelector(".daily-page__legend")).toBeNull();
  });
});

describe("renderQuote's credit", () => {
  const quote = { text: "Keep going", author: "Someone" };

  it("goes beside the quote by default", () => {
    const parent = document.createElement("div");
    renderQuote(parent, quote);
    expect([...parent.children].map((child) => child.className)).toEqual([
      "daily-page__quote",
      "daily-page__attribution",
    ]);
  });

  it("goes into the row it is given, apart from the quote", () => {
    const parent = document.createElement("div");
    const row = document.createElement("div");
    renderQuote(parent, quote, row);
    expect([...parent.children].map((child) => child.className)).toEqual(["daily-page__quote"]);
    expect([...row.children].map((child) => child.className)).toEqual(["daily-page__attribution"]);
  });
});

describe("renderPage, again", () => {
  it("replaces the previous page when rendered again", () => {
    const root = document.createElement("div");
    renderPage(root, note, new Date(2026, 10, 6, 11, 0), null);
    renderPage(root, note, new Date(2026, 10, 6, 11, 0), null);
    expect(root.querySelectorAll(".daily-page")).toHaveLength(1);
  });
});
