// Packages the plugin for installing: the three files Obsidian loads, and nothing else.
//
//   npm run release
//
// The harness (harness/), the vault view (dist/vault/), the source, and the tests are development
// tools. They are not part of the plugin, so they are never copied here. A file that mentions the
// harness is refused, so a harness import cannot slip into the release unnoticed. Every source is
// checked before the release folder is touched, so a refusal never leaves a partial package behind.
//
// versions.json stays in the project root. It is the version map for the plugin's repository, and
// the plugin folder itself needs only the three files.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const PLUGIN_FILES = ["main.js", "manifest.json", "styles.css"];
const outDir = join("release", "daily-page");

const sources = PLUGIN_FILES.map((file) => join("dist", file));
for (const [index, from] of sources.entries()) {
  if (!existsSync(from)) {
    throw new Error(`dist/${PLUGIN_FILES[index]} is missing. Run npm run build first.`);
  }
}
for (const [index, from] of sources.entries()) {
  if (/harness/i.test(readFileSync(from, "utf8"))) {
    throw new Error(`${PLUGIN_FILES[index]} mentions the harness, which must not ship with the plugin.`);
  }
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const [index, from] of sources.entries()) {
  copyFileSync(from, join(outDir, PLUGIN_FILES[index]));
}

console.log(`Plugin packaged in ${outDir}: ${readdirSync(outDir).sort().join(", ")}`);
