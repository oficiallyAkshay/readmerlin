<h1 align="center">🧙 readmerlin</h1>

<p align="center">
  <b>Your skill deserves a README people finish.</b>
  <br>
  Written with the agent you already run. Kept honest on every push.
</p>

<p align="center">
  <a href=".github/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/oficiallyAkshay/readmerlin/ci.yml?branch=main&logo=githubactions&logoColor=white&label=CI"></a>
  <a href="https://www.npmjs.com/package/readmerlin"><img alt="npm version" src="https://img.shields.io/npm/v/readmerlin?logo=npm&logoColor=white"></a>
  <a href="https://www.npmjs.com/package/readmerlin"><img alt="npm downloads per week" src="https://img.shields.io/npm/dw/readmerlin?logo=npm&logoColor=white"></a>
  <a href="package.json"><img alt="Node 20 or newer" src="https://img.shields.io/badge/node-20%2B-339933?logo=nodedotjs&logoColor=white"></a>
  <a href="src/check/rules"><img alt="checks" src="https://img.shields.io/badge/checks-43-6f42c1?logo=eslint&logoColor=white"></a>
  <a href="LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/license-MIT-2f6f4e?logo=opensourceinitiative&logoColor=white"></a>
</p>

<p align="center">
  <sub>Runs on</sub>
  <br>
  <a href="#quick-start"><img alt="Claude Code" src="https://img.shields.io/badge/Claude%20Code-3f3f46?logo=anthropic&logoColor=white"></a>
  <a href="#quick-start"><img alt="Cursor" src="https://img.shields.io/badge/Cursor-3f3f46"></a>
  <a href="#quick-start"><img alt="Codex" src="https://img.shields.io/badge/Codex-3f3f46"></a>
  <a href="#quick-start"><img alt="Gemini CLI" src="https://img.shields.io/badge/Gemini%20CLI-3f3f46?logo=googlegemini&logoColor=white"></a>
  <a href="#quick-start"><img alt="Copilot" src="https://img.shields.io/badge/Copilot-3f3f46?logo=githubcopilot&logoColor=white"></a>
  <a href="#quick-start"><img alt="GitHub Actions" src="https://img.shields.io/badge/GitHub%20Actions-3f3f46?logo=githubactions&logoColor=white"></a>
</p>

<p align="center"><img alt="A skill repo and an agent go in, and one README comes out that reads in ten seconds and stays honest on every push" src="assets/readme/hero.svg" width="900"></p>

<p align="center">
  <b><a href="examples/tidy-inbox/README.md">See a README it wrote</a></b>
</p>

You built a skill that saves people an afternoon. The README is the only thing between them and it, and writing one well takes longer than the skill did.

readmerlin writes it from the reader's chair with the agent already on your machine, then a check keeps every badge, link and claim honest for as long as the repo lives.

## Features

- **Writing**
  - Leads with what the reader gets, never with how it is built
  - Reads your manifests and commands, never your source tree
  - Keeps your own sentences verbatim, restructures the rest
- **Checking**
  - Every badge links somewhere, and its logo really renders
  - A number in a badge is tied to a command that prints it
  - No emails, home paths, keys, or tokens on a hashed denylist
  - Boilerplate sections and making-of sentences are cut
- **Everywhere**
  - One package is the skill, the CLI, the action and the library
  - Every rule is off, warn or fail in one small JSON file
- The full rules: [RULES.md](src/rules/RULES.md)

## How it works

<p align="center">
  <img alt="Your repo and your agent feed context and rules into the agent's writing step; two peer skills draw the visuals; the README goes through check until clean, and the CI action runs the same check on every push" src="assets/diagram/architecture.svg" width="900">
</p>

Code gathers and checks. The agent you already pay for does the writing.

## Quick start

```bash
npx skills add oficiallyAkshay/readmerlin -g
```

Then tell your agent: "Write the README for this repo." It drafts each section in chat, writes the file, and adds the check to CI.

Without an agent, the CLI checks any README on its own:

```bash
npx readmerlin check README.md
```

## Configuration and security

| Setting | In `readmerlin.json` | Default |
|---|---|---|
| Level per rule | `rules` | as shipped, see [RULES.md](src/rules/RULES.md) |
| Headings to drop | `killList` | Contributing, License, What you need, Roadmap and friends |
| Names allowed to keep capitals | `headingAllowlist` | common hosts and formats |
| True number behind a count badge | `counts` | none |
| Hashed private words | `denylistFile` | `.readmerlin/denylist.sha256` |
| Limits | `maxSections`, `maxSectionLines`, `maxBadgesPerRow`, `maxImageHeight` | 8, 40, 6, 700 |

What leaves your machine: nothing, with two exceptions you control.

| Concern | What happens | Guard |
|---|---|---|
| The check fetches links | External links are requested, results cached for a day; badge logos are requested each run | `--no-links` |
| The writer sends your repo to a model | Manifests, commands and the old README go to the backend you chose | `--backend prompt` prints instead of sending |
| The action runs code on your runner | One `npx` of the version you set, no cache. Count-source commands from the config stay off | the `version` and `exec` inputs |

## Common workflows

| Situation | What you say | What comes back |
|---|---|---|
| New skill, no README | "Write the README for this repo" | Sections in chat, then the file, the hero spec and the workflow |
| README is long and code-shaped | "Cut this README to the fold" | Your sentences kept, boilerplate gone, check clean |
| A count in a badge drifted | Nothing, you pushed | The action fails on that badge with the real number |
| Someone else's repo | `npx readmerlin check README.md` | Every fail and warning with a one-line repair |
| No agent, a key in CI | `mode: write` on the action | A README written on the runner, checked before it lands |

## How it compares

| | AI generators | Templates and specs | Markdown linters | Link checkers | readmerlin |
|---|---|---|---|---|---|
| Writes from your repo | yes | no | no | no | yes |
| Uses the agent you already have | no, bring a key | no | no | no | yes |
| Badges must link and render | no | no | no | no | yes |
| Numbers tied to a source | no | no | no | no | yes |
| Privacy gate | no | no | no | no | yes |
| Value-first shape | no | fixed sections | no | no | properties, not an outline |
| Runs in CI | no | no | yes | yes | yes |

## For agents

- Skill path: `skills/readmerlin/SKILL.md`. Install with the skills CLI or copy the folder.
- Order of work: `context`, `rules`, draw with herofold and Archify, write, `check` until clean, `init-workflow`.
- Commands: `context [dir] --format md|json`, `rules`, `check [file] --format text|github|json [--no-links] [--no-exec]`, `write [dir] --backend auto|claude|anthropic|github|codex|gemini|prompt [--model id, anthropic and github only] [--rounds 1..10]`, `init-workflow [dir]`.
- Exit codes: 0 clean or warnings only, 1 any fail, 2 the tool itself failed.
- Rule ids read `group/name`: `hero/exists`, `shape/kill-list`, `badges/logo-renders`, `prose/no-dashes`, `visuals/spec-beside`, `privacy/denylist`, `links/external`. Every finding carries the id and a repair line.
- Library: `import { check, gather, write, rules } from "readmerlin"`. Types ship in the package.
- Peers, never dependencies: herofold draws the hero from `<name>.hero.json`, Archify draws the diagram from `<name>.archify.json`. Both specs sit beside their SVG, and `check` refuses an SVG without one.
