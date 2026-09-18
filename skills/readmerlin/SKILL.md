---
name: readmerlin
description: Write or rewrite the README of a skill, agent, plugin or MCP server repo so it leads with the value to the reader, shows instead of narrates, and passes an honesty check. Use when the user asks for a README, a repo landing page, a rewrite of an existing README, or says a README is too long, too code-centric or unclear. Also use to run the README check or to add the readme-check workflow.
license: MIT
metadata:
  version: "0.1"
  peers: herofold for the hero graphic, archify for the architecture diagram in CONTRIBUTING
---

# readmerlin

Write the README from the reader's chair. The reader has ten seconds and has not decided to care yet.

## Steps

1. Gather. Run `npx -y readmerlin@latest context --format md` in the repo root and read what it prints. It lists the skills, commands, agents, manifests, hosts, workflows and the existing README. Do not walk the source tree.
2. Read the rules. Run `npx -y readmerlin@latest rules` and read all of it. The rules are short.
3. Draw first. Write the hero spec and render it with the herofold skill. If the skill is missing, tell the user the one install command and stop. Never use Mermaid. Look at the hero at full width and in dark theme before moving on.
4. Write. Six parts in this order and no others: hero, Features, Badges, Security, How it compares, Callouts. Derive the tagline from the outcome, not the file tree. Keep the user's own sentences verbatim; restructure, do not rewrite, and say when a sentence changes. Show each section in chat before writing it to disk.
5. Compare truthfully. Columns are the real alternative repos, linked, this project first. Read each one's README and verify every cell before it ships.
6. Move the rest. Workflow YAML, CLI usage, settings, badge recipes, the architecture diagram (drawn with Archify) and the agent block go to `.github/CONTRIBUTING.md`. The README holds no code.
7. Check. Run `npx -y readmerlin@latest check README.md` and fix every fail. Repeat until clean. A green check is the floor, not the standard: hold the page to the section shape as well. Warnings are judgment calls; mention them, do not silently accept them.
8. Install the workflow. Run `npx -y readmerlin@latest init-workflow` so the check runs on every push, pull request and once a week. Add `--clones` when the user wants a clone count badge: it writes the clonometer workflow pinned to a commit and prints the badge recipes. Tell them it needs a TRAFFIC_TOKEN secret, a fine-grained token on that repository with Contents write and Administration read.

## Register

Every noun in the hero and the opening sentences is the reader's noun, not the builder's. If a label matches a file, module or component name in the repo, it is in the wrong register.
