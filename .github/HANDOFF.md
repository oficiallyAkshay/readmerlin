# Handoff (throwaway)

What is still open after the 2026-09-18 session folded the earlier handoff notes and the clonometer README rules into the rules text, the checker, the writer prompt, the skill, the templates and this repo's own README. Delete this file once the items are picked up; it is not documentation.

## Owner steps

- Add a `TRAFFIC_TOKEN` secret to this repository: a fine-grained token scoped to readmerlin, Contents write and Administration read. Then run the clonometer workflow once by hand. Until it has run, the clones badge in the README has no numbers file to read.
- `npm login`, then `npm publish` in the repo (prepublishOnly runs typecheck, build, tests and the self check). The action and the skill both call `npx readmerlin`, so they fail until this happens.
- `claude login`, then `readmerlin write --backend claude --dry-run` on `examples/tidy-inbox` to prove the backend end to end.
- Marketplace listing for the action. Move the `v1` tag once this work is on main.

## Decided on 2026-09-18, already applied

- They are rules, not checks, and each one is stated positively: what a good README has. Rule ids follow, such as `prose/plain-punctuation` and `shape/install-in-words`. The package name stays readmerlin.
- A README never has a Quick start section. It is on the kill list and fails.
- A README never has a section for agents. `shape/agents-in-contributing` fails on one; the agent block lives only in CONTRIBUTING, under forty lines.

## Still to build

- A committed generator for this repo's own hero. `assets/readme/hero.svg` was drawn by a script that lived only in a session. It needs a generator that reads `assets/readme/hero.hero.json`, plus a rebuild test, or herofold once that ships. Check the result at full width and in dark theme.
- `check` should verify that a hero spec agrees with its SVG, not only that it sits beside it.
- Rule candidate from pierless: flag a hand-written static shields badge that states a claim. Today this is rules text only. The reference README's static `dependencies-0` badge is covered by `badges/count-source` instead.
- Re-run calibration after these rule changes: refetch about twenty starred skill and MCP READMEs and tally findings per rule. `shape/section-order` now warns on every section outside the six, so expect it to be the loudest.
- pierless's README PR is not started. Boomerang is the second calibration case; it is private, so nothing public may link to it.
- PyPI packaging is still deferred.

## Learnings worth keeping (readmerlin-specific)

- `process.exit()` after a large stdout write truncates piped output at 64 KB. Set `process.exitCode`.
- tsup `noExternal: [/.*/]` overrides `external`; use a negative lookahead. One config with splitting shares a chunk between the CLI and the library.
- Archify delivers HTML with the stylesheet in the page head. The SVG needs that CSS inlined inside CDATA or it renders black. Boundaries accept only `region` and `security-group`. Labels on short edges overlap; drop them.
- shields has no logo for cursor or openai. Label-only host badges are allowed.
- Composite actions do not see GITHUB_TOKEN unless the step sets it. `npx -y pkg` never installs optional peers; use `npx -p pkg -p peer cmd`.
- An adversarial review before the first push found 18 defects that all tests had passed.
