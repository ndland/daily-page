// Packages the plugin for installing: the three files Obsidian loads, and nothing else.
//
//   npm run release
//
// The harness (harness/), the vault view (dist/vault/), the source, and the tests are development
// tools. They are not part of the plugin, so they are never copied here.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const PLUGIN_FILES = ["main.js", "manifest.json", "styles.css"];
const outDir = join("release", "daily-page");

for (const file of PLUGIN_FILES) {
  if (!existsSync(join("dist", file))) {
    throw new Error(`dist/${file} is missing. Run npm run build first.`);
  }
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const file of PLUGIN_FILES) copyFileSync(join("dist", file), join(outDir, file));

const shipped = readdirSync(outDir).sort();
if (shipped.join(",") !== [...PLUGIN_FILES].sort().join(",")) {
  throw new Error(`The release holds unexpected files: ${shipped.join(", ")}`);
}
console.log(`Plugin packaged in ${outDir}: ${shipped.join(", ")}`);
