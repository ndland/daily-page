/**
 * Inline markdown for the text of the page: a timeline label, a side note, a todo, a finished todo or one of
 * the three great things. It is built from DOM nodes, never from an HTML string, so nothing typed in a note
 * can inject markup.
 *
 * Supported: **bold**, __bold__, *italic*, _italic_, ~~strike~~, ==highlight==, `code`, [text](https://link),
 * [[wikilink]] and [[wikilink|alias]]. A backslash makes the next punctuation mark literal. Anything that is
 * not closed, or that has a space inside its marks, stays as the plain text it was typed as.
 */

/** Longest marks first, so "**" is tried before "*". */
const EMPHASIS = [
  ["**", "strong"],
  ["__", "strong"],
  ["~~", "del"],
  ["==", "mark"],
  ["*", "em"],
  ["_", "em"],
] as const;

/** Anything that could start markdown. Text with none of these is just text. */
export const SPECIAL = /[\\`*_~=[]/;

/** Only these links are made clickable; anything else shows as its text. */
const SAFE_URL = /^(https?:\/\/|mailto:)/i;

const isSpace = (c: string | undefined): boolean => c === undefined || /\s/.test(c);
const isWord = (c: string | undefined): boolean => c !== undefined && /[\p{L}\p{N}]/u.test(c);

/** The index of the mark that closes one opened just before `from`, or -1. */
function findClose(text: string, mark: string, from: number): number {
  const single = mark.length === 1;
  const underscore = mark[0] === "_";
  for (let i = text.indexOf(mark, from); i !== -1; i = text.indexOf(mark, i + 1)) {
    if (i === from || text[i - 1] === "\\" || isSpace(text[i - 1])) continue;
    // A lone "*" or "_" is not the end of a doubled one.
    if (single && (text[i - 1] === mark || text[i + 1] === mark)) continue;
    // An underscore inside a word (snake_case) closes nothing.
    if (underscore && isWord(text[i + mark.length])) continue;
    return i;
  }
  return -1;
}

/** A click on a link in a row that opens its editor must not open the editor too. */
export function keepClickInLink(link: HTMLElement): void {
  link.addEventListener("click", (event) => event.stopPropagation());
}

/** The ")" that ends a link's address starting at `from`, allowing pairs inside it such as (1); -1 if none. */
function closingParen(text: string, from: number): number {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && depth-- === 0) return i;
  }
  return -1;
}

/** Appends `text`, read as inline markdown, to `parent`. */
export function renderInline(parent: Node, text: string): void {
  if (!SPECIAL.test(text)) {
    parent.appendChild(document.createTextNode(text));
    return;
  }
  let plain = "";
  const flush = (): void => {
    if (plain) parent.appendChild(document.createTextNode(plain));
    plain = "";
  };

  let i = 0;
  scan: while (i < text.length) {
    const c = text[i];

    if (c === "\\" && i + 1 < text.length && /[\\`*_~=[\]()#]/.test(text[i + 1])) {
      plain += text[i + 1];
      i += 2;
      continue;
    }

    if (c === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        const code = document.createElement("code");
        code.textContent = text.slice(i + 1, end);
        parent.appendChild(code);
        i = end + 1;
        continue;
      }
    }

    if (c === "[" && text[i + 1] === "[") {
      const end = text.indexOf("]]", i + 2);
      if (end > i + 2) {
        flush();
        const [target, alias] = text.slice(i + 2, end).split("|");
        const link = document.createElement("span");
        link.className = "daily-page__wikilink";
        link.textContent = alias ?? target;
        parent.appendChild(link);
        i = end + 2;
        continue;
      }
    }

    if (c === "[") {
      const mid = text.indexOf("](", i + 1);
      const end = mid === -1 ? -1 : closingParen(text, mid + 2);
      if (mid > i + 1 && end !== -1) {
        const url = text.slice(mid + 2, end).trim();
        flush();
        if (SAFE_URL.test(url)) {
          const link = document.createElement("a");
          link.href = url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          keepClickInLink(link);
          renderInline(link, text.slice(i + 1, mid));
          parent.appendChild(link);
        } else {
          renderInline(parent, text.slice(i + 1, mid));
        }
        i = end + 1;
        continue;
      }
    }

    for (const [mark, tag] of EMPHASIS) {
      if (!text.startsWith(mark, i)) continue;
      const after = text[i + mark.length];
      if (isSpace(after)) continue;
      if (mark.length === 1 && after === mark) continue;
      if (mark[0] === "_" && isWord(text[i - 1])) continue;
      const end = findClose(text, mark, i + mark.length);
      if (end === -1) continue;
      flush();
      const el = document.createElement(tag);
      renderInline(el, text.slice(i + mark.length, end));
      parent.appendChild(el);
      i = end + mark.length;
      continue scan;
    }

    plain += c;
    i += 1;
  }
  flush();
}

/**
 * Draws a piece of the page's text into `parent`. The default is `renderInline`, which works anywhere. A host
 * that has a richer renderer, such as Obsidian's own, passes it in instead (see src/render/richText.ts).
 */
export type TextRenderer = (parent: HTMLElement, text: string) => void;
