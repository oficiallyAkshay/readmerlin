---
name: readmerlin
description: Write or rewrite a repo's README, CONTRIBUTING and docs so the README leads with the value to the reader, shows instead of narrates, and passes an honesty check, while CONTRIBUTING and docs carry what the agent needs. Use when the user asks for a README, a repo landing page, a rewrite of an existing README, or says a README is too long, too code-centric or unclear. Also use to check a README against the rules.
license: MIT
metadata:
  version: "1.0.0"
  peers: figurehead for the hero graphic, archify for the architecture diagram in CONTRIBUTING
---

# readmerlin

Write the README from the reader's chair. The reader has ten seconds and has not decided to care yet. The repo has two readers: the person reads the README, the agent reads CONTRIBUTING and docs in full.

## The script

Everything below runs one script that sits beside this file, at `scripts/readmerlin.mjs` in this skill's folder. It needs Node 20 or newer and nothing else. Run it with the repo root as the working directory, and give Node the script's full path. The steps write it as `readmerlin`.

## Steps

1. Gather. Run `readmerlin context --format md` and read what it prints. It lists the skills, commands, agents, manifests, hosts, workflows, an existing AGENTS.md, the badge row, the compare spec and the existing README in full. When it says this is the product's own page, follow that. Do not walk the source tree.
2. Read the rules. Run `readmerlin rules` and read all of it. The rules are short.
3. Scope. Write the Fit lists first: use it when, look elsewhere when, at most three lines each. State requirements as consequences, not a checklist. Name the install step in one sentence. On the product's own page, drop Fit: the page is the proof.
4. Show it. Find one real result the product produced, quoted or captured, tied to a file you commit, for In action. On the product's own page, drop In action: the page is the artifact. An example kept for tests is not a result.
5. Draw the hero. Name the product's verb before anything else: gather, improve, feed several pages. Pick a layout: `fan` for many things gathered into one, `before-after` for one thing made better, `pages` for one repo feeding several pages for different readers. A new verb gets a new layout in the renderer, never a borrowed one. The hero is designed, not diagrammed: a headline that states the value, an eyebrow, a short subtitle, one colour wash, one colour per tier, nothing negative. Write `<name>.hero.json` beside the SVG and draw it with figurehead: `npx skills add oficiallyAkshay/figurehead` when it is missing. figurehead renders `fan` and `before-after`; a `pages` hero, such as this repo's own, has no renderer yet. Never use Mermaid. Look at the hero at full width and in dark theme before moving on.
6. Write the parts in order: hero, Features, In action, Fit, How it compares, Security and limits, Badges. A part with nothing to say is dropped. Derive the tagline from the outcome, not the file tree. Take the title emoji from the product's name. Carry the badge row exactly as context prints it. When a README exists, it is the draft: keep its tagline, its feature blocks, its comparison rows and its checklist items word for word, and change a sentence only when a fact moved, a rule fails, or the user asks. Say which sentence changed and why. Show each section in chat before writing it to disk.
7. Compare truthfully. Columns are the real alternative repos, linked by full owner/repo, this project first. When context prints a compare spec, use its columns and rows in order. Read each repo's README online and verify every cell before it ships.
8. Move the rest. Workflow YAML, CLI usage, settings, badge recipes and the architecture diagram (drawn with Archify) go to `.github/CONTRIBUTING.md`. The agent block goes to `AGENTS.md` at the repo root, under forty lines, pointing to CONTRIBUTING and docs for the rest. The README holds no code.
9. Write the docs the agent needs, one page each, under `docs/`: a guide per workflow the context found, a reference page per command, read from the command file the context lists, with its flags and settings, the rule ids and levels from `readmerlin rules`, examples, benchmarks or evals when the repo has any, and a changelog. Each page is plain sentences and tables, links back to the README, and repeats nothing on it.
10. Check. Run `readmerlin check --pages` and fix every fail. Repeat until clean, and show the user only a page that checks clean. A green check is the floor, not the standard: hold the README to the section shape as well. Warnings are judgment calls; mention them, do not silently accept them.
11. Count. For a repo with no registry package, offer `readmerlin init-workflow --clones`: it writes the clonometer workflow pinned to a commit and prints the badge recipes. Tell the user it needs a TRAFFIC_TOKEN secret, a fine-grained token on that repository with Contents write and Administration read.

## Staying current

When `check` ends with a line saying a newer readmerlin is out, tell the user and offer to run `npx skills update readmerlin`. Run it only when they agree. Never update on your own.

## Register

Every noun in the hero and the opening sentences is the reader's noun, not the builder's. If a label matches a file, module or component name in the repo, it is in the wrong register.
