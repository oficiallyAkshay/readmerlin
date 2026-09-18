# Contributing to readmerlin

Everything the README leaves out lives here: commands, settings, workflows, badge recipes, how the pieces fit, and the block an agent reads.

## How it ships

readmerlin is an agent skill, not a package. The writing needs the user's agent, and an agent finds a skill in its skills folder, so the skill folder is the whole product. The rules that thinking cannot settle, such as whether a link answers, run from one script inside that folder: `skills/readmerlin/scripts/readmerlin.mjs`, built from `src`, committed, and held to the source by a rebuild test. A release is a merge to main with the version bumped in `package.json` and in SKILL.md together, then a tag. The update notice reads the version from `package.json` on main, and a test holds the two files and the script to the same number. Nothing is published to npm.

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
readmerlin check [README.md] --format text|github|json [--no-links] [--no-exec]
readmerlin init-workflow [dir] [--clones]
```

Exit codes: 0 clean or warnings only, 1 any fail, 2 the tool itself failed.

## Settings

All in `readmerlin.json`, described by `readmerlin.schema.json`.

| Setting | Key | Default |
|---|---|---|
| Level per rule | `rules` | as shipped, see [RULES.md](../src/rules/RULES.md) |
| Headings that fail | `killList` | Limits, Configuration, Quick start, Contributing, License, What you need, Roadmap and friends |
| Section set and order | `sectionOrder` | Features, Badges, Security, How it compares, Callouts. An empty list turns it off |
| Names allowed to keep capitals | `headingAllowlist` | common hosts and formats |
| True number behind a count badge | `counts` | none |
| Hashed private words | `denylistFile` | `.readmerlin/denylist.sha256` |
| Limits | `maxSections`, `maxSectionLines`, `maxBadgesPerRow`, `maxImageHeight` | 8, 40, 6, 700 |

What leaves the machine, and the guard for each:

| Concern | What happens | Guard |
|---|---|---|
| The check fetches links | External links are requested, results cached for a day; badge logos and registry lookups each run; this repo's version number once a day | `--no-links` |
| The action runs code on the runner | The committed script, from the commit the workflow pins. Count-source commands stay off | pin a commit sha; the `exec` input |

## Workflows

`init-workflow` writes `.github/workflows/readme-check.yml`, which runs the rules on every push, pull request and once a week through the action. The action runs the script the skill carries from its own checkout, so the ref a workflow names, `v1` or a commit sha, is exactly the code that runs. It only checks; the writing is the agent's job.

For a repo with no registry package, clones are the only count there is. `init-workflow --clones` also writes `.github/workflows/clonometer.yml`, the consumer workflow of [clonometer](https://github.com/oficiallyAkshay/clonometer) pinned to its current commit. It needs a `TRAFFIC_TOKEN` secret: a fine-grained token scoped to the one repository, with Contents write and Administration read.

## Badge recipes

After the first clonometer run, the numbers sit on the `badges` branch. Replace owner and repo:

```text
https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/<owner>/<repo>/badges/clones.json&query=$.badge&label=clones&logo=github&logoColor=white
https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/<owner>/<repo>/badges/views.json&query=$.badge&label=views&logo=github&logoColor=white
```

A count badge such as `rules-57` needs a source in `readmerlin.json` under `counts`, keyed by the badge label, holding a command that prints the number.

## How it fits together

<p align="center">
  <img alt="Your repo and your agent feed context and rules into the agent's writing step; two peer skills draw the visuals; the README goes through check until clean, and the CI action runs the same check on every push" src="../assets/diagram/architecture.svg" width="900">
</p>

Code gathers and checks. The agent does the writing. The diagram is rebuilt with `node scripts/archify-svg.mjs <archify checkout>` from `assets/diagram/architecture.archify.json`.

## The hero

`scripts/hero-svg.mjs` draws a hero from its spec, with no dependencies, in light and dark theme. It has one layout per verb: `fan` for a product that gathers many things into one, and `before-after` for a product that makes one thing better, which is this repo's own. `npm run hero` redraws both committed heroes, a test fails when an SVG has drifted from its spec, and `visuals/spec-agrees` fails a hero that does not show every label its spec names. A new verb gets a new layout in the script, never a borrowed one.

## Specs beside an SVG

`visuals/spec-beside` accepts `<name>.hero.json` for a hero, `<name>.archify.json`, `<name>.d2` or `<name>.mmd` for a diagram, and any other `<name>.json` that has a generator script and a rebuild test beside it.

## Working on the code

```bash
npm ci
npm run typecheck
npm run build
npm test
npm run check
```

Rules live in `src/check/rules`, one file per group. A rule has an id of the form `group/name`, a default level, a one-line description and a `run` that returns findings with a repair line. Add a test beside the others in `test`, update the `rules` count badge, which the self check verifies, and commit the rebuilt script: `npm run build` writes it, and the tests fail while it is stale.

## For agents

- Skill path: `skills/readmerlin/SKILL.md`. Install with the skills CLI or copy the folder.
- Order of work: `context`, `rules`, draw the hero with herofold, write the six parts, move the rest here, `check` until clean, `init-workflow`.
- Rule ids read `group/name`: `hero/exists`, `shape/earned-headings`, `badges/carry-facts`, `prose/plain-punctuation`, `visuals/spec-beside`, `privacy/denylist-clear`, `links/external`. Every finding carries the id and a repair line.
- The script is `skills/readmerlin/scripts/readmerlin.mjs`. Edit `src`, never the script, then run the build.
- Peers, never dependencies: herofold draws the hero from `<name>.hero.json`, Archify draws the diagram from `<name>.archify.json`. Both specs sit beside their SVG, and `check` refuses an SVG without one.
