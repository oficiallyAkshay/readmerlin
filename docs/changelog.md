# Changelog

## 0.6.0

A rerun now keeps the approved page. The context command prints the existing README in full, and the skill treats it as the draft: its tagline, feature blocks, comparison rows and checklist items stay word for word, and a sentence changes only when a fact moved, a rule fails, or the user asks. A fresh agent rerun on this repo left its README byte for byte as approved. The comparison check now also warns when a column header does not name the owner/repo its link points to.

## 0.5.0

The check command now takes several files at once and a `--pages` flag that expands to `README.md`, whichever CONTRIBUTING file exists, and every markdown page under `docs`, reporting each one in turn instead of the README alone. A parsed page now carries its own kind, so a rule can opt in to running on CONTRIBUTING and docs pages, rather than only on the README; twenty rules now do, covering links, badges, privacy and plain punctuation. The action and this repo's own CI check the pages by default. This docs folder arrived with it, written with the skill's own docs step, and CONTRIBUTING was trimmed of the settings table and the commands block, which live here in full. CI was hardened as well: pinned actions, a gate job, a secrets scan and dependabot. Merged as pull requests 9, 13 and 14.

## 0.4.0

The README's shape changed to three pages feeding two readers: the README stayed the person's page, while commands, settings, workflows, badge recipes, the architecture diagram and the agent block all moved into CONTRIBUTING. A repo whose own page feeds several pages for different readers, this project's own case, got a third hero layout, `pages`, alongside the existing fan and before-after ones, and the rebuild test started reading every field that layout's spec can hold. The tidy-inbox example was reshaped to match. Merged as pull request 8. Pull request 7 taught the install rule that a clone and build, or a download, is an install step.

## 0.3.0

The rules started printing their own ids and levels as part of the rules command's output, the workflow template began pinning a commit of main instead of a moving branch, and a wrong command now exits with status 2 instead of silently doing nothing. The hero generator moved into the skill folder, the context gatherer was hardened, and the rules learned to read a README the way GitHub renders it. Merged as pull request 5, leftovers, and pull request 6, ready.

## 0.2.0

The skill took its current shape: a six-part README, positive rules that each state what a good page has rather than only what is wrong, and the writing itself moved fully onto the user's own agent, with no separate model backend of its own. The skill started shipping as one folder, a script built from source and committed, so an installed skill runs with Node alone, and that script began counting installs with clonometer, pinned to a commit, for a repo with no registry package of its own. Merged as pull request 2, repo-handoff, pull request 3, clonometer, and pull request 4, agent-heading-precision.
