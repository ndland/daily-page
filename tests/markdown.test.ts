// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderInline } from "../src/render/markdown";
import { layoutTimeline, renderBlocks } from "../src/render/timeline";
import { readTimeline } from "../src/entries/format";
import { readChecklist, renderChecklist } from "../src/render/checklist";
import { renderDoneList } from "../src/render/done";

/** The HTML that `text` renders to. */
function html(text: string): string {
  const holder = document.createElement("span");
  renderInline(holder, text);
  return holder.innerHTML;
}

describe("inline markdown", () => {
  it("renders the case from the page: an underscore pair makes italic text", () => {
    expect(html("The scan was _so_ much faster")).toBe("The scan was <em>so</em> much faster");
  });

  it("renders bold, italic, strike, highlight and code", () => {
    expect(html("**b**")).toBe("<strong>b</strong>");
    expect(html("__b__")).toBe("<strong>b</strong>");
    expect(html("*i*")).toBe("<em>i</em>");
    expect(html("~~s~~")).toBe("<del>s</del>");
    expect(html("==h==")).toBe("<mark>h</mark>");
    expect(html("`c`")).toBe("<code>c</code>");
  });

  it("nests marks, and leaves a code span's text alone", () => {
    expect(html("**bold _and italic_**")).toBe("<strong>bold <em>and italic</em></strong>");
    expect(html("`**not bold**`")).toBe("<code>**not bold**</code>");
  });

  it("leaves plain text, and text with no closing mark, as typed", () => {
    expect(html("plain text")).toBe("plain text");
    expect(html("2 * 3 and 4 * 5")).toBe("2 * 3 and 4 * 5");
    expect(html("an _open mark")).toBe("an _open mark");
    expect(html("**")).toBe("**");
  });

  it("leaves underscores inside a word, such as snake_case_name", () => {
    expect(html("use snake_case_name here")).toBe("use snake_case_name here");
  });

  it("does not let a single mark end at a double one", () => {
    expect(html("*a **b** c*")).toBe("<em>a <strong>b</strong> c</em>");
  });

  it("treats a backslash as making the next mark literal", () => {
    expect(html("\\_not italic\\_")).toBe("_not italic_");
  });

  it("makes safe links clickable, in a new tab", () => {
    const holder = document.createElement("span");
    renderInline(holder, "see [the docs](https://example.com/a?b=1) now");
    const link = holder.querySelector("a")!;
    expect(link.textContent).toBe("the docs");
    expect(link.getAttribute("href")).toBe("https://example.com/a?b=1");
    expect(link.target).toBe("_blank");
    expect(link.rel).toBe("noopener noreferrer");
  });

  it("refuses a link that is not http, https or mailto, showing only its text", () => {
    expect(html("[x](javascript:alert(1))")).toBe("x");
    expect(html("[x](data:text/html,hi)")).toBe("x");
    expect(html("[x](vbscript:y)")).not.toContain("<a");
  });

  it("keeps a click on a link from reaching the row it is in", () => {
    const row = document.createElement("div");
    const onRow = vi.fn();
    row.addEventListener("click", onRow);
    renderInline(row, "[x](https://example.com)");
    row.querySelector("a")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(onRow).not.toHaveBeenCalled();
  });

  it("shows a wikilink as its alias, or its name", () => {
    expect(html("[[Project plan]]")).toBe('<span class="daily-page__wikilink">Project plan</span>');
    expect(html("[[Project plan|the plan]]")).toBe('<span class="daily-page__wikilink">the plan</span>');
  });

  it("never turns typed HTML into markup", () => {
    const holder = document.createElement("span");
    renderInline(holder, '<img src=x onerror="alert(1)"> **<b>bold</b>**');
    expect(holder.querySelector("img")).toBeNull();
    expect(holder.querySelector("b")).toBeNull();
    expect(holder.textContent).toBe('<img src=x onerror="alert(1)"> <b>bold</b>');
  });

  it("draws text with no marks as one plain text node", () => {
    const holder = document.createElement("span");
    renderInline(holder, "just words");
    expect(holder.childNodes).toHaveLength(1);
    expect(holder.firstChild?.nodeType).toBe(Node.TEXT_NODE);
  });
});

describe("markdown in the page's text", () => {
  const draw = (lines: string[]) => {
    const timeline = document.createElement("div");
    const notes = document.createElement("div");
    renderBlocks(timeline, notes, layoutTimeline(readTimeline(["## Timeline", ...lines]), 15 * 60));
    return { timeline, notes };
  };

  it("applies to a timeline label, keeping the time before it as plain text", () => {
    const { timeline } = draw(["- 11:56-12:30 The scan was _so_ much faster"]);
    const label = timeline.querySelector(".daily-page__block-label")!;
    expect(label.querySelector("em")?.textContent).toBe("so");
    expect(label.textContent).toBe("11:56-12:30  The scan was so much faster");
  });

  it("applies to a side note", () => {
    const { notes } = draw(["- 11:56 note: a **big** idea"]);
    expect(notes.querySelector(".daily-page__note-text strong")?.textContent).toBe("big");
  });

  it("shows plain text in a block's tooltip, not the marks", () => {
    const { timeline } = draw(["- 11:56-12:30 The scan was _so_ fast"]);
    expect(timeline.querySelector<HTMLElement>(".daily-page__block")!.title).toBe("11:56-12:30  The scan was so fast");
  });

  it("applies to todos, with a plain label for the box", () => {
    const parent = document.createElement("div");
    renderChecklist(parent, readChecklist(["## Checklist", "- [ ] Call *Mum*"]), vi.fn());
    expect(parent.querySelector("li em")?.textContent).toBe("Mum");
    expect(parent.querySelector(".daily-page__box")!.getAttribute("aria-label")).toBe("Finish Call Mum");
  });

  it("applies to finished todos, with a plain tooltip", () => {
    const parent = document.createElement("div");
    renderDoneList(parent, readChecklist(["## Checklist", "- [x] Send ~~old~~ report"]));
    expect(parent.querySelector(".daily-page__done-item del")?.textContent).toBe("old");
    expect(parent.querySelector<HTMLElement>(".daily-page__done")!.title).toBe("Done (1): Send old report");
  });
});
