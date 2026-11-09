import { SPECIAL, TextRenderer, keepClickInLink, renderInline } from "./markdown";

/** Renders markdown into an element, as Obsidian's MarkdownRenderer does. It may finish after the call returns. */
export type MarkdownRender = (markdown: string, into: HTMLElement) => Promise<void>;

/**
 * A text renderer that upgrades the built-in one with a host's own markdown renderer, so the page reads its
 * text the way the rest of the host does (Obsidian's wikilinks, theme and so on).
 *
 * The text is drawn at once with the built-in renderer, so the page is whole and sized from the first frame and
 * a tooltip can be read from it. When the host's render finishes, its result replaces what the built-in one
 * drew, and `onRendered` runs (once per frame, however many texts finished) so the page can be fitted again.
 * The host's result is used only when it is a single paragraph, which is what a line of inline text should be;
 * anything else, such as text that reads as a list item, keeps the built-in drawing. A failed render does too.
 * Text with no markdown in it is drawn directly and never sent to the host.
 */
export function richTextRenderer(render: MarkdownRender, onRendered: () => void): TextRenderer {
  let scheduled = false;
  const notify = (): void => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      onRendered();
    });
  };

  return (parent, text) => {
    if (!SPECIAL.test(text)) return renderInline(parent, text);

    // The text gets its own element, so the host's result can replace it without touching what else is in `parent`.
    const slot = document.createElement("span");
    parent.appendChild(slot);
    renderInline(slot, text);

    const holder = document.createElement("div");
    render(text, holder).then(
      () => {
        const paragraph = holder.firstElementChild;
        if (!slot.isConnected || holder.children.length !== 1 || paragraph?.tagName !== "P") return;
        paragraph.querySelectorAll("a").forEach(keepClickInLink);
        slot.replaceChildren(...paragraph.childNodes);
        notify();
      },
      () => {},
    );
  };
}
