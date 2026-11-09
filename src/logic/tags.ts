/** Tag names are letters, digits, hyphens, and underscores, after a "#". */
const TAG_PATTERN = /#([A-Za-z][\w-]*)/g;
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

/** Tags in a label, lowercased and without the "#". Order of appearance is kept. */
export function extractTags(label: string): string[] {
  const tags: string[] = [];
  for (const match of label.matchAll(TAG_PATTERN)) {
    tags.push(match[1].toLowerCase());
  }
  return tags;
}

/**
 * Parses settings text such as:
 *   work #8be9fd
 *   home #ff79c6
 * Each line gives a tag and a six-digit hex colour. Lines that do not match are ignored.
 */
export function parseTagColours(text: string): Record<string, string> {
  const colours: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 2) continue;
    const tag = parts[0].replace(/^#/, "").toLowerCase();
    const colour = parts[1];
    if (!/^[A-Za-z][\w-]*$/.test(tag) || !HEX_COLOUR.test(colour)) continue;
    colours[tag] = colour.toLowerCase();
  }
  return colours;
}

/** The colour for a label: the first of its tags that has a colour, or null. */
export function colourForLabel(label: string, tagColours: Record<string, string>): string | null {
  for (const tag of extractTags(label)) {
    // Own keys only, so a tag such as #constructor is not mistaken for a colour inherited from Object.
    if (Object.prototype.hasOwnProperty.call(tagColours, tag)) return tagColours[tag];
  }
  return null;
}
