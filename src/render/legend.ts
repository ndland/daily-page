/**
 * Draws the tags and their colours as a row of small chips, so the tags to type after an activity are always in
 * view. Draws nothing when no tag has a colour.
 */
export function renderTagLegend(parent: HTMLElement, tagColours: Record<string, string>): void {
  const tags = Object.keys(tagColours);
  if (tags.length === 0) return;

  const legend = document.createElement("div");
  legend.className = "daily-page__legend";
  for (const tag of tags) {
    const chip = document.createElement("span");
    chip.className = "daily-page__legend-tag";
    chip.style.setProperty("--dp-block-accent", tagColours[tag]);
    chip.textContent = `#${tag}`;
    legend.appendChild(chip);
  }
  parent.appendChild(legend);
}
