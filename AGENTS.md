# AGENTS.md

Skill path: `skills/readmerlin/SKILL.md`. Install with the skills CLI or copy the folder.

Reference: [CONTRIBUTING](.github/CONTRIBUTING.md) holds commands, settings, workflows and how the pieces fit. [docs/](docs/README.md) holds a guide per workflow and a reference page per command, read in full alongside this file.

Order of work: `context`, `rules`, scope the Fit lists, find the In action result, draw the hero with `hero-svg.mjs`, write the parts in order, compare truthfully, write the docs pages, `check --pages` until clean, `init-workflow`.

Rule ids read `group/name`: `hero/exists`, `shape/earned-headings`, `badges/carry-facts`, `prose/plain-punctuation`, `visuals/spec-beside`, `privacy/denylist-clear`, `links/external`. Every finding carries the id and a repair line.

The script is `skills/readmerlin/scripts/readmerlin.mjs`. Edit `src`, never the script, then run the build.

Peers, never dependencies: herofold draws the hero from `<name>.hero.json` when installed, and this skill's `hero-svg.mjs` draws it otherwise. Archify draws the diagram from `<name>.archify.json`. Both specs sit beside their SVG, and `check` refuses an SVG without one.
