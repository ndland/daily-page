/** Default daily-note path. Matches folders such as 05_Daily/2026/11-November/2026-11-06.md. */
export const DEFAULT_DAILY_PATTERN = "05_Daily/{YYYY}/{MM}-{MMMM}/{YYYY}-{MM}-{DD}.md";

const LONG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Fills the tokens {YYYY}, {MM}, {MMMM}, and {DD} from a local date. */
export function dailyNotePath(date: Date, pattern: string): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return pattern
    .replaceAll("{YYYY}", year)
    .replaceAll("{MMMM}", LONG_MONTHS[date.getMonth()])
    .replaceAll("{MM}", month)
    .replaceAll("{DD}", day);
}

/** Folder part of a vault path, or "" for a file at the root. */
export function folderOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "" : path.slice(0, slash);
}

/** Cumulative folder paths for a path, shallowest first: "a/b/c.md" gives "a", "a/b". */
export function folderChain(path: string): string[] {
  const parts = folderOf(path).split("/").filter(Boolean);
  return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}

/**
 * Whether a daily note path stays inside the vault. A path with a ".." part or a leading slash, or
 * a drive letter, could point at a file outside the vault, so it is refused.
 */
export function isSafeDailyPattern(pattern: unknown): boolean {
  if (typeof pattern !== "string" || pattern === "" || pattern.trim() !== pattern) return false;
  if (/^([\\/]|[a-zA-Z]:)/.test(pattern)) return false;
  // A segment that starts with a dot is a parent folder ("..") or a hidden one, such as the vault's
  // own ".obsidian" folder, so daily notes never go there.
  return pattern.split(/[\\/]/).every((segment) => !segment.trim().startsWith("."));
}
