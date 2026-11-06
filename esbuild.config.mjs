import esbuild from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";

// Production builds run once; the default (dev) mode watches for changes.
const production = process.argv[2] === "production";

// Obsidian supplies these at runtime, so they must not be bundled.
const external = ["obsidian", "electron", "@codemirror/*", "@lezer/*"];

const copyAssets = () => {
  mkdirSync("dist", { recursive: true });
  copyFileSync("manifest.json", "dist/manifest.json");
  copyFileSync("styles/daily-page.css", "dist/styles.css");
};

const options = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  external,
  format: "cjs",
  target: "es2020",
  platform: "browser",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  outfile: "dist/main.js",
};

copyAssets();
const context = await esbuild.context(options);

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
