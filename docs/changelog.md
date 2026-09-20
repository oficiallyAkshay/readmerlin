# Changelog

## 1.0.2

Closes all 16 CodeQL alerts on the incomplete-multi-character-sanitization and incomplete-url-substring-sanitization queries. Every regex-based HTML tag, comment, CDATA and style-block strip now goes through a shared `stabilize()` helper that reapplies the removal until the string stops changing, instead of trusting a single pass; `stabilize()` takes the regex and replacement as data and calls `.replace()` itself inside its own loop, so CodeQL's incomplete-multi-character-sanitization query recognizes every call site as the pattern it documents. registry.ts's npm lookup URL now percent-encodes every slash in a package name with `replaceAll` instead of a single-occurrence replace. Hostname checks in tests now parse the URL and compare its hostname instead of testing a substring of the raw URL. Eighteen new regression tests cover the fixes; coverage stays at 100 on every metric.

CI hardens: the checks job verifies every action pin with pinact (fix off, verify on), and runs actionlint and zizmor alongside the existing pre-commit set. A dependency-review workflow flags a known-vulnerable package at pull request time, and a weekly npm audit workflow catches the rest on a schedule. Dependabot pull requests now auto-merge once the required ci check passes.

## 1.0.1

`init-workflow` pins to the commit of the action's latest release now, not the commit its main branch happens to point at, and writes a `# vX.Y.Z` comment naming that release in place of the earlier fixed wording. pinact, run in consumer CI with `--verify`, fails a SHA pin whose comment does not name a tag that resolves to that commit; two consumer repos hit this today. The same fix applies to the clonometer workflow `--clones` writes. When GitHub cannot be reached, the workflow still gets the `<sha>` placeholder, now paired with a `vX.Y.Z, replace before pushing` comment instead of the earlier wording, so it is clear a real release tag is still needed before the workflow can pass.

## 1.0.0

The first stable release. An `overrides` entry pins esbuild to 0.28.2, closing the Dependabot alert on the range tsup and vitest had pulled in (0.27.3-0.28.0, low severity, arbitrary file read from the dev server on Windows); `npm audit` now reports zero vulnerabilities, and build, typecheck, tests and the coverage floor all still pass.

## 0.8.3

links/external no longer hard-fails a link whose host refuses an automated request: a blind validation run on exa-labs/exa-mcp-server turned up two npmjs.com links failing CI only because npmjs.com answers a bot's HEAD or GET with 403. A status of 401, 403, 405, 429 or 999 now warns instead, naming the status and saying the link was not verified; a genuine 404, a 410 or a network error still fails, and a refused result is never cached as verified.

## 0.8.2

Test coverage now runs through @vitest/coverage-v8, with a real repo of new tests for the rules, context readers and commands that had none, and `npm test` enforces a coverage floor so it fails if coverage drops. A few defensive fallbacks that could never run, guarded by guarantees the parser and the GFM table shape already gave, were deleted in favour of a plain assertion; a couple of genuine OS-race fallbacks are marked instead of tested.

## 0.8.1

An ossemble pass over this repo closed its two open gaps: a pre-commit hook now runs gitleaks locally, matching the full-history scan CI already ran, and CI runs it too. Dependabot now groups its weekly GitHub Actions updates into one pull request, the way it already grouped npm. The comparison rules in privacy.ts now share one table walker instead of three, the section rules in shape.ts share one top-level-section reader, and visuals.ts reuses util.ts's own attribute reader instead of a second copy of the same regex. That reader also reads single-quoted and unquoted attributes, so visuals/svg-clipping and visuals/svg-text-overflow now catch a shape or a label written that way instead of missing it. CONTRIBUTING now points to RULES.md for the hero and spec-beside description instead of repeating it.

## 0.8.0

The agent block now lives in AGENTS.md at the repo root, under forty lines, instead of a "For agents" section in CONTRIBUTING: the shape/agents-in-contributing rule checks AGENTS.md's length and fails a CONTRIBUTING that still carries the section, `check --pages` reads AGENTS.md when the repo has one, and context lists it the way it lists a workflow. This repo's own agent block moved there from `.github/CONTRIBUTING.md`. The works-with row now says "Works with" once per row instead of on every badge: each host badge is message-only, a logo and the host name, so `hostBadgeSrc` drops the repeated label.

## 0.7.1

The works-with row knows Claude Agent SDK, OpenClaw and Hermes Agent, and Codex wears the OpenAI mark inline, since shields has none built in. A row of more than six hosts splits evenly. A host folder such as .claude names a host only when the repo ships a skill, a plugin or an MCP server, so a GitHub Action repo no longer claims to work with Claude Code.

## 0.7.0

A fresh write now lands close to the approved page. Context prints the badge row the repo's shape asks for, so a repo with no package carries its clone badge before any count exists, and a second works-with row with one badge per host, set by `worksWith` in readmerlin.json. It says when the repo is readmerlin's own page, which drops Fit and In action, and it prints the compare spec from readmerlin.json, whose repos and rows the table follows. The rules now say where the title emoji comes from, how the tagline opens, which six questions the feature blocks answer, what a comparison cell holds, and what the security checklist covers. The check warns on a missing clone or host badge, a table that differs from its spec, and a ❌ item that says never twice. The tidy-inbox example is gone. Five isolated eval runs, each writing this README with the old one and its history removed, moved from a different page to one matching the approved emoji, tagline, badges, sections and table.

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
