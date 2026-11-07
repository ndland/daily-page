// A minimal static server for the harness, so the built-in browser can open it over http.
// It listens on 127.0.0.1 only. It refuses requests whose Host header is not localhost, and requests
// the browser marks as coming from another site, or from another localhost port.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isAllowedFetchSite, isAllowedHost, resolveRequest } from "./paths.mjs";

// The served root is this project, wherever the server is started from.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT) || 5173;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

createServer(async (req, res) => {
  if (!isAllowedHost(req.headers.host, port) || !isAllowedFetchSite(req.headers["sec-fetch-site"])) {
    res.writeHead(403).end();
    return;
  }

  // A malformed escape such as %E0%A4%A throws here. Answer it, rather than let the error end the server.
  let path;
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    path = decodeURIComponent(url.pathname === "/" ? "/harness/index.html" : url.pathname);
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }

  const file = resolveRequest(root, path);
  if (!file) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`Harness at http://localhost:${port}/harness/index.html`));
