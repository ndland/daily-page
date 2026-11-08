
## [0.1.1](https://github.com/ndland/daily-page/compare/0.1.0...0.1.1) (2026-11-08)

### Features

* **plan:** plan blocks by tapping the timeline or with a command ([466e3d3](https://github.com/ndland/daily-page/commit/466e3d3cba12caf835631c4d2f6879138f2359a2))

### Bug Fixes

* **edit:** let a running activity start at the current minute ([b29ed7d](https://github.com/ndland/daily-page/commit/b29ed7d75a21c8e013601f2eb8603ed2ed7d1ffc))

## [0.1.0](https://github.com/ndland/daily-page/compare/1b491bf5729fe19153c2547ad900cdd9b75b78d9...0.1.0) (2026-11-07)

### Features

* **daily-note:** keep each day's quote and create notes from a template ([e0cbf41](https://github.com/ndland/daily-page/commit/e0cbf41571c9d5c2618f1ca40b06c9bc4d55b4e2))
* **daily-page:** add Obsidian daily page plugin ([1b491bf](https://github.com/ndland/daily-page/commit/1b491bf5729fe19153c2547ad900cdd9b75b78d9))
* **entries:** edit the timeline, checklist and three things in place ([83c918f](https://github.com/ndland/daily-page/commit/83c918fe57f2c570c09aa1dbe7217f3fa5dcdf64))
* **harness:** add a browser harness for phone and desktop previews ([1bc6e21](https://github.com/ndland/daily-page/commit/1bc6e21ffcf3e99364a6147a05426261b40a2970))
* **logic:** add helpers for scope, tags, grid, throttling and quotes ([6f1c67a](https://github.com/ndland/daily-page/commit/6f1c67a4fc0148363077e610889693327d50e66b))
* **page:** keep the page in step with the note as it is typed ([c27ac2b](https://github.com/ndland/daily-page/commit/c27ac2bb6aaab4c2a91df48c05c3ec0eed1d382c))
* **plugin:** wire editing, undo and the daily quote into the plugin ([828fab9](https://github.com/ndland/daily-page/commit/828fab9aad8c80ee26c48fcf40902e156d03cada))
* **quote:** fetch a daily quote from ZenQuotes at most once a day ([8cd40ca](https://github.com/ndland/daily-page/commit/8cd40ca763ab1daa022cda2116e8b89c91fb72aa))
* **render:** draw the daily page with a responsive phone layout ([4ba264b](https://github.com/ndland/daily-page/commit/4ba264b9ea0aecd2846973e58b471d79b0a0641d))
* **render:** show the moon phase in the date cell ([fbcead4](https://github.com/ndland/daily-page/commit/fbcead47ea78458aadb7751113eb6bd138000688))
* **styles:** move the vault rules into the plugin stylesheet ([112ff7e](https://github.com/ndland/daily-page/commit/112ff7e1b25700fffced4ce5518a00e7cd9a432e))
* **sync:** refuse writes on conflicted notes and add per-device read-only mode ([12979d3](https://github.com/ndland/daily-page/commit/12979d30616434047857a84d955e28714d2b4f4d))
* **vault:** write edits atomically, with undo and a Dataview view ([8554ef1](https://github.com/ndland/daily-page/commit/8554ef1843af2c1c2b7f9a0a1ba2b19d5326f97b))

### Bug Fixes

* **entries:** apply the span rule when logging activities ([326ce55](https://github.com/ndland/daily-page/commit/326ce55d46b210354bc63452bb9d1fe98b668b79))
* **entries:** end activities that cross midnight ([d9e63dd](https://github.com/ndland/daily-page/commit/d9e63dd5b18ee9aae984d630a497bc8289df2cfc))
* **harness:** refuse Windows path separators and requests from other sites ([9470332](https://github.com/ndland/daily-page/commit/9470332d0c4a6aae3ceb73e9a3d2c9a2b775c2d4))
* **logic:** refuse daily note paths that leave the vault ([e6c7557](https://github.com/ndland/daily-page/commit/e6c7557874f83ef1dd359648aee9282280faa37f))
* **quote:** describe the reply size check accurately ([0994613](https://github.com/ndland/daily-page/commit/0994613c0c0418dfefc039a252c9e605439f57ef))
* **quote:** refuse an oversized reply before reading it ([0dca45c](https://github.com/ndland/daily-page/commit/0dca45c159f20ac8e5686eb914b3bb6ecf57d0d4))
* **render:** keep the page fitted as the note changes ([51c6efc](https://github.com/ndland/daily-page/commit/51c6efcc8821ad5aceee17e1ac82aed5e51cf075))
* **render:** lay out finished todos and labels within bounds ([b2e6c5a](https://github.com/ndland/daily-page/commit/b2e6c5af2e3b560be02bc84c3818b9666d9e66c9))
* **render:** make finished todos and side-note times readable ([449791e](https://github.com/ndland/daily-page/commit/449791ee8fc5e685366530af019f2d60b5c65b0a))
* **vault:** edit only inside a daily-page block ([05a0291](https://github.com/ndland/daily-page/commit/05a02911e61273f9ea7b64eb9facffa4c08df129))
* **vault:** hide the title and properties, and stop daily-note scrolling ([73aaca3](https://github.com/ndland/daily-page/commit/73aaca3cd93bc673cbf05c13a51a31774fd42116))
* **vault:** keep line endings, queue writes, and refuse pages without a block ([bbbdc26](https://github.com/ndland/daily-page/commit/bbbdc26ae1b3517768d2bf4bac5ec72951eea375))
