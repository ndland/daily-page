/** A quote to show: the text and who said it. */
export interface QuoteText {
  text: string;
  author: string;
}

/**
 * Renders the quote and its ZenQuotes attribution into the footer. With no quote, nothing
 * is drawn. The attribution is required by ZenQuotes' free tier, so it always appears with a quote.
 */
export function renderQuote(parent: HTMLElement, quote: QuoteText | null): void {
  if (quote === null) return;

  const text = document.createElement("p");
  text.className = "daily-page__quote";
  text.textContent = `"${quote.text}"`;

  const author = document.createElement("span");
  author.className = "daily-page__quote-author";
  author.textContent = `— ${quote.author}`;
  text.appendChild(author);

  const attribution = document.createElement("div");
  attribution.className = "daily-page__attribution";
  attribution.append("Inspirational quotes provided by ");
  const link = document.createElement("a");
  link.href = "https://zenquotes.io/";
  link.textContent = "ZenQuotes API";
  attribution.appendChild(link);

  parent.append(text, attribution);
}
