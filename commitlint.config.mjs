// Commit message rules and the guided prompt (`npm run commit`), from one list of scopes.
//
// A commit is `type(scope): subject`. The scope is required and must come from the list below, so
// the changelog groups by area. To add a scope, add it here: the check and the prompt both pick it up.

/** The areas of the project a change can belong to, with what each one covers. */
const SCOPES = [
  ["entries", "timeline entry format, logging and editing (src/entries)"],
  ["render", "drawing the page: timeline, notes, checklist, fitting (src/render)"],
  ["styles", "the plugin stylesheet (styles/)"],
  ["vault", "writing notes, dialogs, undo and the Dataview view (src/vault)"],
  ["plugin", "Obsidian wiring: commands, settings tab, redraws (src/main.ts)"],
  ["settings", "saved settings and their defaults"],
  ["quote", "the daily quote: fetching and caching"],
  ["tags", "tag colours"],
  ["plan", "planning and time-blocking"],
  ["logic", "shared helpers: paths, time, grid, scope (src/logic)"],
  ["harness", "the browser preview harness"],
  ["release", "packaging and installing the plugin (scripts/)"],
  ["build", "build config and npm scripts"],
  ["deps", "dependencies"],
  ["tests", "test setup and shared test helpers"],
  ["tooling", "commit rules, hooks and changelog generation"],
  ["readme", "the README"],
  ["spec", "SPEC.md"],
  ["changelog", "CHANGELOG.md"],
];

export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-empty": [2, "never"],
    "scope-enum": [2, "always", SCOPES.map(([name]) => name)],
  },
  prompt: {
    // Only the listed scopes can be chosen, and one is required.
    allowCustomScopes: false,
    allowEmptyScopes: false,
    scopes: SCOPES.map(([name, description]) => ({ value: name, name: `${name.padEnd(10)} ${description}` })),
    // No issue tracker here, so the footer questions are skipped.
    skipQuestions: ["footerPrefix", "footer"],
  },
};
