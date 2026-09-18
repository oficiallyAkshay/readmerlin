# Handoff (throwaway)

What is still open after the 2026-09-18 session folded the earlier handoff notes and the clonometer README rules into the rules text, the checker, the writer prompt, the skill, the templates and this repo's own README. Delete this file once the items are picked up; it is not documentation.

## The plan, decided 2026-09-18

readmerlin is an agent skill, not an npm package. The writing needs the user's agent, an agent finds a skill in its skills folder, and everything readmerlin needs fits in that folder: the instructions plus one committed script. Installed with `npx skills add`, updated with `npx skills update`, counted by clones through clonometer. Rules are stated positively. A README has no Quick start and no section for agents.

1. Done: the skill shape. `skills/readmerlin/scripts/readmerlin.mjs` is built from `src`, committed, and a rebuild test fails when it is stale. SKILL.md runs it. `package.json` is private. The script prints one line when a newer version is out and never updates itself.
2. Owner: clonometer. The workflow and its badge sit in a local commit this session could not push, because its token has no `workflow` scope. Push it, add a `TRAFFIC_TOKEN` secret (fine-grained, this repository, Contents write and Administration read), and run the workflow once.
3. Next: the action. `action.yml` and `templates/readme-check.yml` still call `npx readmerlin` from npm, which will never exist. Make the action run the committed script from its own checkout, so it can be pinned to a commit. Until then the action does not work.
4. Next: decide on `write`. The command and its six model backends write a README without an agent. Under the skill shape the agent is the writer, so they are likely dead weight, and removing them makes "never sends your repo to a model" true by construction. Owner's call.
5. Then: a release habit. Bump the version in `package.json` and SKILL.md together, since the update notice reads `package.json` on main. Tag releases. Move `v1` once the action works.
6. Then: list on the skills directory and the action Marketplace, and re-run calibration on about twenty real READMEs.

## Still to build

- A committed generator for this repo's own hero. `assets/readme/hero.svg` was drawn by a script that lived only in a session. It needs a generator that reads `assets/readme/hero.hero.json`, plus a rebuild test, or herofold once that ships. Check the result at full width and in dark theme.
- `check` should verify that a hero spec agrees with its SVG, not only that it sits beside it.
- Rule candidate from pierless: flag a hand-written static shields badge that states a claim. Today this is rules text only. The reference README's static `dependencies-0` badge is covered by `badges/count-source` instead.
- Re-run calibration after these rule changes: refetch about twenty starred skill and MCP READMEs and tally findings per rule. `shape/section-order` now warns on every section outside the six, so expect it to be the loudest.
- pierless's README PR is not started. Boomerang is the second calibration case; it is private, so nothing public may link to it.

## Learnings worth keeping (readmerlin-specific)

- `process.exit()` after a large stdout write truncates piped output at 64 KB. Set `process.exitCode`.
- tsup `noExternal: [/.*/]` overrides `external`; use a negative lookahead. One config with splitting shares a chunk between the CLI and the library.
- Archify delivers HTML with the stylesheet in the page head. The SVG needs that CSS inlined inside CDATA or it renders black. Boundaries accept only `region` and `security-group`. Labels on short edges overlap; drop them.
- shields has no logo for cursor or openai. Label-only host badges are allowed.
- Composite actions do not see GITHUB_TOKEN unless the step sets it. `npx -y pkg` never installs optional peers; use `npx -p pkg -p peer cmd`.
- An adversarial review before the first push found 18 defects that all tests had passed.
