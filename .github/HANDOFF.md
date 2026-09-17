# Handoff (throwaway)

Where work on this repo stopped on 2026-09-17 and what is next, collected from several build sessions. The newest entry wins where two disagree. Delete this file once the items are picked up; it is not documentation.

## readmerlin (from the clonometer session)

### Learnings to fold into the rules and the checker
- Agent section belongs in CONTRIBUTING, not the README; the rules contradicted each other and the owner chose "README for humans". Make `shape/agent-section` an allowance.
- No Quick start section: install line in the hero under the opening sentences (enable-step rule still passes), token instruction in the settings table, badge choice in a Badges section. List Quick start as optional.
- Badge examples are a visual row of live badges each linked to its recipe plus one generic recipe line; add an allowance for a `## Badges` section in `badges-in-hero` (six fails today on clonometer).
- Comparisons name the actual libraries as linked columns; verify every cell against their READMEs (a wrong cell about github-repo-stats was caught by a verifier). This reverses "categories, not products".
- Security table three rows (token, numbers, nothing else), heading three words; Limits five lines with no fact twice; no schema block at the top; no How it works list when the hero shows it; inline code never inside a sentence.
- Hero: one SVG drawn from a committed spec with a rebuild test; Mermaid does not count and does not render on registries. drawsvg (Python, SMIL) is the library for animated ones; still frame must be complete.
- Checker false positives to fix: registry badges warned for unpublished packages, root-files lists untracked caches, text-overflow estimate flags labels that fit, spec-beside accepts any `<name>.*.json` (document it).
- `init-workflow --clones` should write the clonometer consumer workflow (pinned SHA, secret TRAFFIC_TOKEN) instead of the gist template, and print the badge recipe.

### What's left
- Apply the above to readmerlin's rules text, checker and template. Adopt clonometer on readmerlin itself (ten-line workflow plus badge).



---

## readmerlin (written by the readmerlin build session, 2026-09-17)

### State
- Repo `readmerlin`, public at github.com/oficiallyAkshay/readmerlin, main at 007c2ae, tags v0.1.0 and v1 (v1 moved to 007c2ae), CI green on Node 20 and 22. Not on npm yet, so `npx readmerlin` and the action's npx step fail until the owner publishes.
- One package is the skill (`skills/readmerlin/SKILL.md`), the CLI (`context`, `rules`, `check`, `write`, `init-workflow`), the composite action (`mode: check|write`, `exec` off by default) and the library (`import { check, gather, write, rules }`).
- 44 rules in `src/check/rules/{shape,badges,prose,visuals,privacy,links,registry}.ts`, each off|warn|fail in `readmerlin.json`, schema in `readmerlin.schema.json`, findings capped at ten per rule.
- Writer backends in order: claude CLI (bare, no tools, user settings only), Anthropic SDK as optional peer (claude-opus-5, fallbacks default), GitHub Models via GITHUB_TOKEN, codex, gemini, prompt to stdout. Repair loop max three rounds, draft in a temp dir, repo content fenced as data.
- 32 tests including an adversarial suite and eight review regressions. Calibrated on 20 starred skill and MCP repos, no crashes. Tarball 157 KB.
- Own README passes with zero fails. Hero hand-drawn to the eight decisions with `assets/readme/hero.hero.json` beside it, but the python generator that drew it was inline in the session and is NOT committed. Architecture SVG comes from Archify through `scripts/archify-svg.mjs` (needs a checkout of tt-a1i/archify passed as the first argument).

### What's left, in order
1. Fold in both learnings files (`~/Downloads/readmerlin-learnings-from-clonometer.md` and the readmerlin section above from the clonometer session). Where they disagree with the current rules, they win:
   - `shape/agent-section` becomes an allowance, not a warning. The agent section lives in CONTRIBUTING under `.github/`.
   - Quick start is optional. The install line may sit in the hero under the opening sentences; `shape/enable-step` already accepts that.
   - `shape/badges-in-hero` must not fire inside a `## Badges` section.
   - `honesty/comparison-categories` reverses: columns are the actual alternative repos as links. Warn when a comparison header is not a link. Drop the `productNames` config.
   - `init-workflow --clones` writes clonometer's consumer workflow (curl of `.github/consumer-workflow.yml` pinned to the current sha, secret `TRAFFIC_TOKEN`, Contents write plus Administration read) and prints the `$.badge` recipes for `badges/clones.json` and `badges/views.json`. Delete `templates/clone-count.yml`, the gist-based one I wrote before knowing clonometer existed.
   - `badges/registry-present` asks the registry before warning, not only the manifest.
   - `honesty/root-files` reads `git ls-files`, not the directory, so caches and venvs do not count.
   - `visuals/svg-text-overflow` uses the text's own width when present, else goes informational.
   - Document the spec kinds `visuals/spec-beside` accepts: `<name>.hero.json`, `<name>.archify.json`, or `<name>.json` with a generator script and a rebuild test beside it. Then commit a real generator for readmerlin's own hero.
   - New checks: For agents or CONTRIBUTING agent block under forty lines; security table three rows; no Features row that repeats a badge (hard to automate, put in the rules text).
   - Rules text: a green check is the floor, not the standard; the repo wears its own badge; view the hero full width and in dark theme; number format for badges.
2. Adopt clonometer on readmerlin itself: the ten-line workflow plus the badge in row one.
3. Owner: `npm login`, `npm publish` in the repo (prepublishOnly runs typecheck, build, tests, self-check). `claude login`, then run `readmerlin write --backend claude --dry-run` on `examples/tidy-inbox` to prove the backend end to end. Marketplace listing for the action.
4. Re-run calibration after the rule changes: refetch about twenty starred skill and MCP READMEs with `gh api repos/X/readme` and tally findings per rule.
5. PyPI packaging is still deferred.

### Learnings (readmerlin-specific)
- `process.exit()` after a large stdout write truncates piped output at 64 KB. Set `process.exitCode`.
- tsup `noExternal: [/.*/]` overrides `external`; use a negative lookahead. Two tsup configs duplicate the bundle; one config with splitting shares a chunk.
- Archify delivers HTML with the stylesheet in the page head. The SVG needs that CSS inlined inside CDATA or it renders black. Boundaries accept only `region` and `security-group`. Labels on short edges overlap; drop them.
- shields has no logo for cursor or openai. Label-only host badges are allowed (`badges/logo-present` warns, `badges/logo-renders` fails only when a given logo does not render).
- Composite actions do not see GITHUB_TOKEN unless the step sets it. `npx -y pkg` never installs optional peers; use `npx -p pkg -p peer cmd`.
- An adversarial review before the first push found 18 defects that all tests had passed. Memory note `readmerlin-review-lessons.md` lists the nine worth keeping.



---

## readmerlin (from the pierless session)

### What's left
- pierless's README PR is not started; write it with readmerlin and hold it to the section shape, not only a green check. Comparison tables name the actual alternative libraries.
- Rule candidate: a claim badge is acceptable only when it is an endpoint badge whose JSON a test-backed CI job writes (pierless `claims.py --badges`); a hard-coded shields static badge that states a fact should be flagged.



---

## readmerlin (from the hero skill session, live state checked 2026-09-17)

### State
- Public. Local main equals origin at `007c2ae`. Three commits, tags v0.1.0 and v1. `package.json` says 0.1.0. `npm view readmerlin` returned an error, so treat the npm package as unpublished until someone confirms.
- No open PRs.

### What's left
- Everything in the clonometer session's readmerlin entry above: the rule allowances, the checker false positives, and `init-workflow --clones` writing the clonometer consumer workflow.
- Publish to npm. The counting strategy depends on it, and the action runs `npx -y readmerlin@latest check`.
- Hero rules: the skill calls herofold for the hero and Archify for the architecture. `check` should verify the spec file sits beside the hero SVG and agrees with it. Until herofold ships, the rule "one SVG drawn from a committed spec with a rebuild test" is the stand-in.
- Fold in the 2026-09-17 reversal: comparison columns name the actual libraries, every cell verified against their READMEs.



---

## readmerlin (additions from the boomerang session)

- Boomerang is the second README to bring into the readmerlin shape (after clonometer) and is a good calibration case for a skill repo with a committed example artifact: prominent example link near the top, infographic of the reader's flow, Features as a structured table, no "what you need", no Contributing or License sections, no meta narration about how diagrams were made.
- Rule worth adding from boomerang: a count badge (vendors, rules, hosts) must have a test or a source command behind it; the checker's honesty group already has the hook for this.
- Boomerang is private, so nothing public may link to it as an example until the owner flips it.



---

## Owner steps (from the cross-repo checklist)

| Repo | Step only the owner can do |
|---|---|
| readmerlin | `npm login`; first `npm publish` |
