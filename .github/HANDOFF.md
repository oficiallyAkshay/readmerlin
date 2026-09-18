# Handoff (throwaway)

What is still open after the 2026-09-18 session folded the earlier handoff notes and the clonometer README rules into the rules text, the checker, the writer prompt, the skill, the templates and this repo's own README. Delete this file once the items are picked up; it is not documentation.

## The plan, decided 2026-09-18

readmerlin is an agent skill, not an npm package. The writing needs the user's agent, an agent finds a skill in its skills folder, and everything readmerlin needs fits in that folder: the instructions plus one committed script. Installed with `npx skills add`, updated with `npx skills update`, counted by clones through clonometer. Rules are stated positively. A README has no Quick start and no section for agents.

1. Done: the skill shape. `skills/readmerlin/scripts/readmerlin.mjs` is built from `src`, committed, and a rebuild test fails when it is stale. SKILL.md runs it. `package.json` is private. The script prints one line when a newer version is out and never updates itself.
2. Done: the action runs that same script from its own checkout, so the ref a workflow names is the code that runs. It only checks.
3. Done: `write` and its model backends are gone. The agent is the writer, and the script never talks to a model. The commit that removed them can be reverted if that turns out wrong.
4. Done: the release habit. Version lives in `package.json` and SKILL.md, a test holds them and the script together, and this release is 0.2.0.
5. Done: clonometer runs on this repo. The owner stored the `TRAFFIC_TOKEN` secret on 2026-09-18, the first run succeeded, and the badge reads live numbers.
6. Waiting on the owner's word: version tags. No `v0.2.0` tag exists and `v1` still points at the old npm-based action. Nothing is tagged or moved until the owner says so. Until `v1` moves, workflows that use `@v1` get the old, broken action; pinning a commit from main works today.
7. Then: list the skill on the skills directory and the action on the Marketplace.

8. Done: the hero has a committed generator, `scripts/hero-svg.mjs`, with a rebuild test, and it is this repo's own shape, a before and after, not the fan borrowed from boomerang. `visuals/spec-agrees` holds a hero to its spec. `badges/claims-backed` warns on a hand-written claim badge. An unverified count badge is a warning, so the action passes with its defaults. The package-era leftovers are gone: no `dist`, no library entry, CI runs the committed script.

## Calibration, 2026-09-18

19 public skill and MCP READMEs, links and commands off: no crashes. Almost every real README fails, which is expected, since the shape is strict by design. Loudest rules, by repos hit: `shape/section-order` 18, `prose/code-outside-sentences` 17, `prose/sentence-case` 16, `hero/exists` 15, `shape/install-in-words` 14, `shape/earned-headings` 13, `prose/plain-punctuation` 13. `links/relative` and `visuals/images-exist` fired only because the READMEs were checked without their repos. One real false positive was found and fixed: `shape/agents-in-contributing` matched any heading containing "agent" (13 hits in 7 repos, such as "Supported agents"); it now matches only headings addressed to an agent.

## Still to build

- pierless's README PR is not started. Boomerang is the second calibration case; it is private, so nothing public may link to it.

## Learnings worth keeping (readmerlin-specific)

- `process.exit()` after a large stdout write truncates piped output at 64 KB. Set `process.exitCode`.
- tsup `noExternal: [/.*/]` overrides `external`; use a negative lookahead. One config with splitting shares a chunk between the CLI and the library.
- Archify delivers HTML with the stylesheet in the page head. The SVG needs that CSS inlined inside CDATA or it renders black. Boundaries accept only `region` and `security-group`. Labels on short edges overlap; drop them.
- shields has no logo for cursor or openai. Label-only host badges are allowed.
- Composite actions do not see GITHUB_TOKEN unless the step sets it. `npx -y pkg` never installs optional peers; use `npx -p pkg -p peer cmd`.
- An adversarial review before the first push found 18 defects that all tests had passed.
