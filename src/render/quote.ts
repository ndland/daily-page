/** A quote to show: the text and who said it. */
export interface QuoteText {
  text: string;
  author: string;
}

/**
 * Renders the quote and its ZenQuotes attribution into the footer. With no quote, nothing
 * is drawn. The attribution is required by ZenQuotes' free tier, so it always appears with a quote.
 * The attribution goes into `creditParent`, which is `parent` unless the caller gives a row to share with other
 * footer content.
 */
export function renderQuote(parent: HTMLElement, quote: QuoteText | null, creditParent: HTMLElement = parent): void {
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

  parent.appendChild(text);
  creditParent.appendChild(attribution);
}
