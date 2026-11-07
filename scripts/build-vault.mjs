// Builds the vault version of the daily page: the Dataview view, and the CSS snippet.
//
//   npm run vault                      writes to dist/vault/
//   VAULT_DIR="C:/path/to/vault" npm run vault
//                                      also copies both into that vault
//
// Both outputs come from the same source as the plugin, so there is one place to change things.
import esbuild from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const viewFolder = "Daily Page";
const outDir = join("dist", "vault");
const viewOut = join(outDir, viewFolder, "view.js");
const snippetOut = join(outDir, "daily-page.css");

mkdirSync(join(outDir, viewFolder), { recursive: true });

// The view is one script. Dataview runs it with its own `dv`, so it is bundled as an IIFE.
await esbuild.build({
  entryPoints: ["src/vault/view.ts"],
  bundle: true,
  format: "iife",
  target: "es2020",
  platform: "browser",
  outfile: viewOut,
  logLevel: "info",
});

// The snippet is the plugin's stylesheet, then the vault-only rules.
writeFileSync(
  snippetOut,
  `${readFileSync("styles/daily-page.css", "utf8")}\n${readFileSync("styles/vault.css", "utf8")}`,
);

const vault = process.env.VAULT_DIR;
if (vault) {
  const viewDir = join(vault, "99_System", "Views", viewFolder);
  mkdirSync(viewDir, { recursive: true });
  copyFileSync(viewOut, join(viewDir, "view.js"));

  const snippetDir = join(vault, ".obsidian", "snippets");
  mkdirSync(snippetDir, { recursive: true });
  copyFileSync(snippetOut, join(snippetDir, "daily-page.css"));

  console.log(`Copied the view and snippet into ${vault}`);
} else {
  console.log(`Built into ${outDir}. Set VAULT_DIR to copy it into a vault.`);
}
