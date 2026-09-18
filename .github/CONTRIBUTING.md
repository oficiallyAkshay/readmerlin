# Contributing to readmerlin

Everything the README leaves out lives here: commands, settings, workflows, badge recipes, how the pieces fit, and the block an agent reads.

## Commands

```bash
npx skills add oficiallyAkshay/readmerlin -g
npx readmerlin context [dir] --format md|json
npx readmerlin rules
npx readmerlin check [README.md] --format text|github|json [--no-links] [--no-exec]
npx readmerlin write [dir] --backend auto|claude|anthropic|github|codex|gemini|prompt [--model id] [--rounds 1..10] [--dry-run]
npx readmerlin init-workflow [dir] [--clones]
```

Exit codes: 0 clean or warnings only, 1 any fail, 2 the tool itself failed. `--model` applies to the anthropic and github backends.

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
| The check fetches links | External links are requested, results cached for a day; badge logos and registry lookups are requested each run | `--no-links` |
| The writer sends the repo to a model | Manifests, commands and the old README go to the chosen backend | `--backend prompt` prints instead of sending |
| The action runs code on the runner | One `npx` of the version set, no cache. Count-source commands stay off | the `version` and `exec` inputs |

## Workflows

`init-workflow` writes `.github/workflows/readme-check.yml`, which runs the check on every push, pull request and once a week through `oficiallyAkshay/readmerlin@v1`. For write mode, give the job `contents: write`, `pull-requests: write` and `models: read`, set `mode: write`, and pass `ANTHROPIC_API_KEY` to use Claude or leave it out to use GitHub Models with the job token.

For a repo with no registry package, clones are the only count there is. `init-workflow --clones` also writes `.github/workflows/clonometer.yml`, the consumer workflow of [clonometer](https://github.com/oficiallyAkshay/clonometer) pinned to its current commit. It needs a `TRAFFIC_TOKEN` secret: a fine-grained token scoped to the one repository, with Contents write and Administration read.

## Badge recipes

After the first clonometer run, the numbers sit on the `badges` branch. Replace owner and repo:

```text
https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/<owner>/<repo>/badges/clones.json&query=$.badge&label=clones&logo=github&logoColor=white
https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/<owner>/<repo>/badges/views.json&query=$.badge&label=views&logo=github&logoColor=white
```

A count badge such as `rules-55` needs a source in `readmerlin.json` under `counts`, keyed by the badge label, holding a command that prints the number.

## How it fits together

<p align="center">
  <img alt="Your repo and your agent feed context and rules into the agent's writing step; two peer skills draw the visuals; the README goes through check until clean, and the CI action runs the same check on every push" src="../assets/diagram/architecture.svg" width="900">
</p>

Code gathers and checks. The agent does the writing. The diagram is rebuilt with `node scripts/archify-svg.mjs <archify checkout>` from `assets/diagram/architecture.archify.json`.

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

Rules live in `src/check/rules`, one file per group. A rule has an id of the form `group/name`, a default level, a one-line description and a `run` that returns findings with a repair line. Add a test beside the others in `test`, and update the `rules` count badge, which the self check verifies.

## For agents

- Skill path: `skills/readmerlin/SKILL.md`. Install with the skills CLI or copy the folder.
- Order of work: `context`, `rules`, draw the hero with herofold, write the six parts, move the rest here, `check` until clean, `init-workflow`.
- Rule ids read `group/name`: `hero/exists`, `shape/earned-headings`, `badges/carry-facts`, `prose/plain-punctuation`, `visuals/spec-beside`, `privacy/denylist-clear`, `links/external`. Every finding carries the id and a repair line.
- Library: `import { check, gather, write, rules } from "readmerlin"`. Types ship in the package.
- Peers, never dependencies: herofold draws the hero from `<name>.hero.json`, Archify draws the diagram from `<name>.archify.json`. Both specs sit beside their SVG, and `check` refuses an SVG without one.
