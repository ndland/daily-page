// Packages the plugin for installing: the files Obsidian loads, and nothing else.
//
//   npm run release
//
// The harness (harness/), the vault view (dist/vault/), the source, and the tests are development
// tools. They are not part of the plugin, so they are never copied here. A file that mentions the
// harness is refused, so a harness import cannot slip into the release unnoticed.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/** Written by the build into dist/. Obsidian loads these three. */
const BUILT_FILES = ["main.js", "manifest.json", "styles.css"];
/** Kept in the project root. Obsidian reads it to pick a plugin version for each app version. */
const ROOT_FILES = ["versions.json"];
const outDir = join("release", "daily-page");

for (const file of BUILT_FILES) {
  if (!existsSync(join("dist", file))) {
    throw new Error(`dist/${file} is missing. Run npm run build first.`);
  }
}
for (const file of ROOT_FILES) {
  if (!existsSync(file)) throw new Error(`${file} is missing from the project root.`);
}

const sources = [
  ...BUILT_FILES.map((file) => [join("dist", file), file]),
  ...ROOT_FILES.map((file) => [file, file]),
];

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const [from, name] of sources) {
  if (/harness/i.test(readFileSync(from, "utf8"))) {
    throw new Error(`${name} mentions the harness, which must not ship with the plugin.`);
  }
  copyFileSync(from, join(outDir, name));
}

console.log(`Plugin packaged in ${outDir}: ${readdirSync(outDir).sort().join(", ")}`);
