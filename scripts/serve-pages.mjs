import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Test the deployed files with Pages-like directory redirects and no SPA
// fallback. Vite preview's fallback would hide missing route entry documents.
const root = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const base = "/WebcamArcade";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
};

createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:4175");
  if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  let path;
  try {
    path = resolve(
      root,
      `.${decodeURIComponent(url.pathname.slice(base.length))}`,
    );
    if (path !== root && !path.startsWith(`${root}${sep}`)) throw new Error();
    const info = await stat(path);
    if (info.isDirectory()) {
      if (!url.pathname.endsWith("/")) {
        response.writeHead(301, {
          Location: `${url.pathname}/${url.search}`,
        });
        response.end();
        return;
      }
      path = resolve(path, "index.html");
    }
    const body = await readFile(path);
    response.writeHead(200, {
      "Content-Type": types[extname(path)] || "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    response.end(await readFile(resolve(root, "404.html")));
  }
}).listen(4175, "127.0.0.1", () => {
  console.log("Static Pages test server: http://127.0.0.1:4175/WebcamArcade/");
});
