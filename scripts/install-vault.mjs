// Copies the plugin into a vault, so the vault's own sync carries it to every device.
//
//   npm run install:vault -- "C:/Users/you/Documents/GitHub/Second-Brain"
//
// It builds the release first (so the copy is always the tested build), then copies the three files
// Obsidian loads into <vault>/.obsidian/plugins/daily-page/. The vault's data.json is never touched:
// it holds each device's own settings and quote cache.
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const vault = process.argv[2];
if (!vault) {
  console.error('Give the vault folder, for example: npm run install:vault -- "C:/path/to/vault"');
  process.exit(1);
}

const vaultDir = resolve(vault);
const target = join(vaultDir, ".obsidian", "plugins", "daily-page");

execSync("npm run release", { stdio: "inherit" });

mkdirSync(target, { recursive: true });
for (const file of ["main.js", "manifest.json", "styles.css"]) {
  copyFileSync(join("release", "daily-page", file), join(target, file));
}
console.log(`Copied the plugin into ${target}`);
