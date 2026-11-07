// Decides what the harness server may read. Kept apart from the server so it can be tested.
import { join, resolve, sep } from "node:path";

/** Only these folders are served: the harness page and the plugin stylesheet it loads. */
const SERVED_PREFIXES = ["/harness/", "/styles/"];

/**
 * Maps a request path (already percent-decoded) to a file under `root`. Returns null when the
 * request must be refused: a path outside the served folders, any dotfile or dot-folder, or a
 * path that resolves outside `root`.
 */
export function resolveRequest(root, urlPath) {
  // A backslash is a path separator on Windows. Refusing it here stops "..\\" from climbing out of a served folder.
  if (urlPath.includes("\\")) return null;
  if (!SERVED_PREFIXES.some((prefix) => urlPath.startsWith(prefix))) return null;
  if (urlPath.split("/").some((segment) => segment.startsWith("."))) return null;

  const file = resolve(join(root, urlPath));
  // The separator matters: "daily-page-old" starts with "daily-page" but is a different folder.
  if (!file.startsWith(root + sep)) return null;
  return file;
}

/**
 * Whether a Host header names this server. A web page reached through DNS rebinding sends its own
 * host name, so anything other than localhost or 127.0.0.1 on this port is refused.
 */
export function isAllowedHost(hostHeader, port) {
  return hostHeader === `127.0.0.1:${port}` || hostHeader === `localhost:${port}`;
}

/**
 * Whether the browser says a request may be served. Sec-Fetch-Site is "same-origin" for the harness's
 * own pages and "none" for a visit typed into the address bar. A request from another site, or from
 * another localhost port ("same-site"), is refused. A request with no such header is a non-browser
 * client, such as the test runner, and is allowed.
 */
export function isAllowedFetchSite(fetchSite) {
  return fetchSite === undefined || fetchSite === "same-origin" || fetchSite === "none";
}
