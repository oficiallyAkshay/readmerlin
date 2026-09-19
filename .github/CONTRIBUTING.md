# Contributing to readmerlin

Everything the README leaves out lives here: commands, settings, workflows, badge recipes, how the pieces fit, and the block an agent reads.

## How it ships

readmerlin is an agent skill, not a package. The writing needs the user's agent, and an agent finds a skill in its skills folder, so the skill folder is the whole product. The rules that thinking cannot settle, such as whether a link answers, run from one script inside that folder: `skills/readmerlin/scripts/readmerlin.mjs`, built from `src`, committed, and held to the source by a rebuild test. The folder also carries `scripts/hero-svg.mjs`, which draws a hero from its spec. A release is a merge to main with the version bumped in `package.json` and in SKILL.md together. The update notice reads the version from `package.json` on main, and a test holds the two files and the script to the same number. Nothing is published to npm.

```text
npx skills add oficiallyAkshay/readmerlin -g
npx skills update readmerlin
```

Installs are clones of this repository, so clonometer keeps the count. The script tells the user when a newer version is out and never updates anything itself.

## Commands

With `readmerlin` standing for `node skills/readmerlin/scripts/readmerlin.mjs`:

```text
readmerlin context [dir] --format md|json
readmerlin rules
readmerlin check [file...] --format text|github|json [--pages] [--no-links] [--no-exec]
readmerlin init-workflow [dir] [--clones]
```

`check` takes one file or several, such as `check README.md .github/CONTRIBUTING.md docs/guide.md`, and reports each in turn. `--pages` checks README.md, CONTRIBUTING and every docs page instead, whichever of them exist.

Exit codes: 0 clean or warnings only, 1 any fail, 2 a wrong command or a tool failure.

## Settings

All in `readmerlin.json`, described by `readmerlin.schema.json`.

| Setting | Key | Default |
|---|---|---|
| Level per rule | `rules` | as shipped, printed by `readmerlin rules` |
| Headings that fail | `killList` | Limits, Configuration, Quick start, Contributing, License, What you need, Roadmap and friends |
| Section set and order | `sectionOrder` | Features, In action, Fit, How it compares, Security and limits, Badges. An empty list turns it off |
| Names allowed to keep capitals | `headingAllowlist` | common hosts and formats |
| True number behind a count badge | `counts` | none |
| Hashed private words | `denylistFile` | `.readmerlin/denylist.sha256` |
| Phrases that never appear | `disclaimers` | fully synthetic, for illustration and friends |
| Limits | `maxSections`, `maxSectionLines`, `maxParagraphSentences`, `maxBadgesPerRow`, `maxImageHeight`, `maxFindingsPerRule` | 8, 40, 4, 6, 700, 10 |

What leaves the machine, and the guard for each:

| Concern | What happens | Guard |
|---|---|---|
| The check fetches links | External links are requested, and one that answered is not asked again for a day; badge logos and registry lookups run each time; this repo's version number once a day, in text format only | `--no-links` |
| The action runs code on the runner | The committed script, from the commit the workflow pins. Count-source commands stay off | pin a commit sha; the `exec` input |

## Workflows

`init-workflow` writes `.github/workflows/readme-check.yml`, which runs the rules on every push, pull request and once a week through the action. The action runs the script the skill carries from its own checkout, so the commit a workflow pins is exactly the code that runs. Pin a commit of main; `init-workflow` fills in the current one. It only checks; the writing is the agent's job.

For a repo with no registry package, clones are the only count there is. `init-workflow --clones` also writes `.github/workflows/clonometer.yml`, the consumer workflow of [clonometer](https://github.com/oficiallyAkshay/clonometer) pinned to its current commit. It needs a `TRAFFIC_TOKEN` secret: a fine-grained token scoped to the one repository, with Contents write and Administration read. A private repository needs clonometer's gist storage instead, set by hand from its README, since the branch's numbers file is not public.

## Badge recipes

After the first clonometer run, the numbers sit on the `badges` branch. Replace owner and repo, then add the scheme:

```text
//img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/<owner>/<repo>/badges/clones.json&query=$.badge&label=clones&logo=github&logoColor=white
//img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/<owner>/<repo>/badges/views.json&query=$.badge&label=views&logo=github&logoColor=white
```

A count badge such as `downloads-1.2k` needs a source in `readmerlin.json` under `counts`, keyed by the badge label, holding a command that prints the number.

## How it fits together

<p align="center">
  <img alt="Your repo and your agent feed context and rules into the agent's writing step; two peer skills draw the visuals; the README goes through check until clean, and the CI action runs the same check on every push" src="../assets/diagram/architecture.svg" width="900">
</p>

Code gathers and checks. The agent does the writing. The diagram is rebuilt with `node scripts/archify-svg.mjs <archify checkout>` from `assets/diagram/architecture.archify.json`, using [Archify](https://github.com/tt-a1i/archify).

## The hero

`skills/readmerlin/scripts/hero-svg.mjs` draws a hero from its spec, with no dependencies, in light and dark theme, so an installed skill can draw one. It has one layout per verb: `fan` for a product that gathers many things into one, `before-after` for a product that makes one thing better, and `pages` for a repo that feeds several pages to different readers, which is this repo's own. `npm run hero` redraws every committed hero, a test fails when an SVG has drifted from its spec, and `visuals/spec-agrees` fails a hero that does not show every label its spec names. A new verb gets a new layout in the script, never a borrowed one.

## Specs beside an SVG

`visuals/spec-beside` accepts `<name>.hero.json` for a hero, `<name>.archify.json`, `<name>.d2` or `<name>.mmd` for a diagram, and any other `<name>.json`. It checks the hero spec's labels and only looks for the rest.

## Working on the code

```bash
npm ci
npm run typecheck
npm run build
npm test
npm run check
```

Rules live in `src/check/rules`, a few groups per file; the id prefix names the group. A rule has an id of the form `group/name`, a default level, a one-line description and a `run` that returns findings with a repair line. Add a test beside the others in `test`, update the rule count in `test/skill-script.test.ts` and in RULES.md wherever it appears, and commit the rebuilt script: `npm run build` writes it, and the tests fail while it is stale.

Things learned the hard way:

- `process.exit()` after a large stdout write truncates piped output at 64 KB. Set `process.exitCode` and let stdout drain.
- tsup `noExternal: [/.*/]` overrides `external`. The bundle is one file with everything inlined so the installed skill runs with Node alone.
- Archify delivers HTML with the stylesheet in the page head. The SVG needs that CSS inlined inside CDATA or it renders black. Boundaries accept only `region` and `security-group`, and labels on short edges overlap, so they are dropped.
- shields has no logo for cursor or openai. A label-only host badge is allowed.
- A composite action does not see a secret unless the step sets it. `npx -y pkg` never installs optional peers.
- An adversarial review before each release has found defects that every test passed. Fan reviewers out by area and have judges confirm each finding before fixing it.

## What the shape learned

- A README is judged by a person in a minute and read in full by an agent. The person gets the README; the agent gets CONTRIBUTING and docs, kept true together on every merge.
- Value stated as a mechanism is not value. "57 rules" says nothing until it says "read in a minute".
- Scope, proof and limits are each worth their own section: Fit for who it is for, In action for a real result, Security and limits for the credential, the checklist and the defaults together.
- A hero is designed before it is diagrammed: a headline that states the value earns more attention than a bigger picture.
- Badges earn their place by adoption and licence. A language version or a rule count is not a fact a reader acts on.

## For agents

- Skill path: `skills/readmerlin/SKILL.md`. Install with the skills CLI or copy the folder.
- Order of work: `context`, `rules`, scope the Fit lists, find the In action result, draw the hero with `hero-svg.mjs`, write the parts in order, compare truthfully, move the rest here, write the docs pages, `check` until clean, `init-workflow`.
- Rule ids read `group/name`: `hero/exists`, `shape/earned-headings`, `badges/carry-facts`, `prose/plain-punctuation`, `visuals/spec-beside`, `privacy/denylist-clear`, `links/external`. Every finding carries the id and a repair line.
- The script is `skills/readmerlin/scripts/readmerlin.mjs`. Edit `src`, never the script, then run the build.
- Peers, never dependencies: herofold, when installed, draws the hero from `<name>.hero.json`, and this skill's `hero-svg.mjs` draws it otherwise. Archify draws the diagram from `<name>.archify.json`. Both specs sit beside their SVG, and `check` refuses an SVG without one.
