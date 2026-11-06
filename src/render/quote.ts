import { StoredQuote } from "../logic/quoteCache";

/** Renders the quote into the footer. With no quote, nothing is drawn. */
export function renderQuote(parent: HTMLElement, quote: StoredQuote | null): void {
  if (quote === null) return;

  const text = document.createElement("p");
  text.className = "daily-page__quote";
  text.textContent = `"${quote.text}"`;

  const author = document.createElement("span");
  author.className = "daily-page__quote-author";
  author.textContent = `— ${quote.author}`;

  text.appendChild(author);
  parent.appendChild(text);
}
