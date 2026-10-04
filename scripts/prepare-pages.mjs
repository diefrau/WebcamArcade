import { mkdir, readFile, writeFile } from "node:fs/promises";

// GitHub Pages serves real files and directories rather than a SPA fallback.
// Keep BrowserRouter's readable URLs by providing an entry document per route.
const output = new URL("../dist/", import.meta.url);
const html = await readFile(new URL("index.html", output), "utf8");
const base = "/WebcamArcade";
const routes = [
  "/games",
  "/play/shoot",
  "/play/circle",
  "/play/cham",
  "/result/shoot",
  "/result/circle",
  "/result/cham",
];

for (const route of routes) {
  const directory = new URL(`${route.slice(1)}/`, output);
  await mkdir(directory, { recursive: true });
  // Pages redirects directory requests to a trailing slash. Remove only that
  // known route's slash before React initializes, preserving its query/hash.
  const canonicalPath = `${base}${route}`;
  const canonicalize = `<script>if(location.pathname===${JSON.stringify(`${canonicalPath}/`)})history.replaceState(history.state,"",${JSON.stringify(canonicalPath)}+location.search+location.hash);</script>`;
  await writeFile(
    new URL("index.html", directory),
    html.replace("<head>", `<head>\n    ${canonicalize}`),
  );
}

// Unknown URLs still load the app, whose existing wildcard route opens Games.
// Vite's absolute production asset URLs also work from this 404 document.
await writeFile(new URL("404.html", output), html);
await writeFile(new URL(".nojekyll", output), "");
console.log(
  `GitHub Pages entry documents prepared for ${routes.length} routes.`,
);
