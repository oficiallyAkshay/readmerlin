# Changelog

## 0.5.0 (this branch)

The check command now takes several files at once and a `--pages` flag that expands to `README.md`, whichever CONTRIBUTING file exists, and every markdown page under `docs`, reporting each one in turn instead of the README alone. A parsed page now carries its own kind, so a rule can opt in to running on CONTRIBUTING and docs pages, rather than only on the README; twenty rules now do, covering links, badges, privacy and plain punctuation. The action and this repo's own CI check the pages by default. This docs folder is the first the pages check now holds to those twenty rules alongside the README and CONTRIBUTING, and CONTRIBUTING itself was trimmed of the settings table and the commands block now written out here in full.

## 0.4.0

The README's shape changed to three pages feeding two readers: the README stayed the person's page, while commands, settings, workflows, badge recipes, the architecture diagram and the agent block all moved into CONTRIBUTING. A repo whose own page feeds several pages for different readers, this project's own case, got a third hero layout, `pages`, alongside the existing fan and before-after ones, and the rebuild test started reading every field that layout's spec can hold. The tidy-inbox example was reshaped to match. Merged as pull request 7, install-step, and pull request 8, shape-0.4.

## 0.3.0

The rules started printing their own ids and levels as part of the rules command's output, the workflow template began pinning a commit of main instead of a moving branch, and a wrong command now exits with status 2 instead of silently doing nothing. The context gatherer, the hero generator and an early docs folder landed together, and the README-shape rules learned to read a README closer to the way GitHub itself renders it. Merged as pull request 5, leftovers, and pull request 6, ready.

## 0.2.0

The skill took its current shape: a six-part README, positive rules that each state what a good page has rather than only what is wrong, and the writing itself moved fully onto the user's own agent, with no separate model backend of its own. The skill started shipping as one folder, a script built from source and committed, so an installed skill runs with Node alone, and that script began counting installs with clonometer, pinned to a commit, for a repo with no registry package of its own. Merged as pull request 2, repo-handoff, pull request 3, clonometer, and pull request 4, agent-heading-precision.
