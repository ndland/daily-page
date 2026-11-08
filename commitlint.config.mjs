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

/**
 * Lines that credit someone or something at the end of a message: git trailers such as Co-Authored-By and
 * Signed-off-by, and the "Generated with Claude Code" credit. A BREAKING CHANGE footer is not one of these and stays
 * allowed, and so does ordinary prose that happens to start with "Generated with".
 */
const TRAILER_LINE =
  /^\s*(co-authored-by|signed-off-by|reviewed-by|acked-by|tested-by|reported-by)\s*:|^\s*(🤖|generated with \[claude code\]\()/i;

const noTrailers = {
  rules: {
    "no-trailers": (parsed) => {
      // Comment lines are what git adds to the message editor, and are dropped when the commit is made.
      const found = (parsed.raw ?? "").split(/\r?\n/).find((line) => !line.startsWith("#") && TRAILER_LINE.test(line));
      return [found === undefined, `commit messages carry no trailers, but found "${found?.trim()}"`];
    },
  },
};

export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [noTrailers],
  rules: {
    "scope-empty": [2, "never"],
    "scope-enum": [2, "always", SCOPES.map(([name]) => name)],
    "no-trailers": [2, "always"],
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
