// Sets the version in a packaged manifest.json, and changes nothing else.
//
//   node scripts/stamp-manifest.mjs release/daily-page 0.2.0-beta.1
//
// The release workflow runs this on the package it just built, for every tag. For a beta it writes the beta
// version into the packaged copy only, because BRAT's guide says not to commit a beta's version to the default
// branch. For a stable release the version is already right, so the file is left as it was.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseVersion, toJson } from "./lib/release.mjs";

const [dir, version] = process.argv.slice(2);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!dir || !version) fail("Usage: node scripts/stamp-manifest.mjs <package folder> <version>");
if (!parseVersion(version)) fail(`"${version}" is not a version. Use X.Y.Z or X.Y.Z-beta.N, with no v prefix.`);

const path = join(dir, "manifest.json");
let original;
try {
  original = readFileSync(path, "utf8");
} catch {
  fail(`${path} could not be read. Run npm run release first.`);
}

const manifest = JSON.parse(original);
if (manifest.version !== version) writeFileSync(path, toJson(original, { ...manifest, version }));
console.log(`manifest.json is at ${version}`);
