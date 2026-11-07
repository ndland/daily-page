/** Maps a decoded request path to a file under `root`, or null when the request must be refused. */
export function resolveRequest(root: string, urlPath: string): string | null;

/** Whether a Host header names this server on `port`. */
export function isAllowedHost(hostHeader: string | undefined, port: number): boolean;

/** Whether the browser marked the request as coming from another site (Sec-Fetch-Site). */
export function isCrossSite(fetchSite: string | undefined): boolean;
