/** Maps a decoded request path to a file under `root`, or null when the request must be refused. */
export function resolveRequest(root: string, urlPath: string): string | null;

/** Whether a Host header names this server on `port`. */
export function isAllowedHost(hostHeader: string | undefined, port: number): boolean;

/** Whether the browser's Sec-Fetch-Site value lets the request be served: same-origin, none, or no header. */
export function isAllowedFetchSite(fetchSite: string | undefined): boolean;
