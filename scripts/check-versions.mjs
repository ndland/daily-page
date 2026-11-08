// Checks that the version files agree, and that a tag (when given) matches them.
//
//   node scripts/check-versions.mjs [tag]      or    npm run release:check -- [tag]
//
// BRAT reads the manifest.json in a release and trusts the tag over it, so a mismatch installs the wrong
// version without any error. The release workflow runs this on the tag; `release:prepare` runs it before
// it changes anything. Exit code 0 means the files agree.
import { readFileSync } from "node:fs";
import { checkVersions, readVersionFiles } from "./lib/release.mjs";

const tag = process.argv[2];

try {
  const files = readVersionFiles((name) => readFileSync(name, "utf8"));
  const problems = checkVersions({ ...files, tag });
  if (problems.length > 0) {
    console.error(problems.map((problem) => `- ${problem}`).join("\n"));
    process.exit(1);
  }
  console.log(`Versions agree: ${files.manifest.version}${tag ? ` (tag ${tag})` : ""}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
