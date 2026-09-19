# Write a README

This is the order an agent works in once it has the skill, and what happens in the repo at each step.

## Gather what the repo offers

The agent runs the context command against the repo root and reads what comes back: the git remote, the licence, every skill, plugin, MCP server, command, agent, hook and workflow file it found, the names of the tracked root files, whether an AGENTS.md already exists, and, when one already exists, the current README's title, tagline, word count, badges, images and headings. Nothing is read by walking the source tree by hand.

## Read the rules

The agent runs the rules command and reads the whole thing: the principles behind the shape, the closed set of sections and their order, the kill list of headings that never earn their place, and the table of every rule id, its level and what a good README has.

## Scope the Fit section

From what context found, the agent writes short Fit lines: who the repo is for, who should look elsewhere, and the one plain sentence that names the install line context already printed. A product's own README, where the page itself is the proof, may drop this section.

## Find the proof

The agent looks for one committed file the product actually produced, a quoted result or a captured output, and ties the In action section to it. A product's own README may have none, since its page is the artifact.

## Draw the hero

The agent picks the layout that matches the product's own verb: a fan for many things gathered into one, a before and after for one thing made better, or pages for a repo that feeds several pages to different readers. It writes the spec as `<name>.hero.json` beside where the SVG will live, then renders it with the hero script that ships in this skill's own scripts folder, and looks at the result at full width and in dark theme before moving on.

## Write the parts

The agent writes the hero, Features, In action, Fit, How it compares, Security and limits, and Badges, in that order, dropping any part with nothing to say, and shows each one before it is saved to the file.

## Compare truthfully

For every row in How it compares, the agent reads the other project's own README and checks the cell against it before the table ships.

## Move the rest

Commands, settings, workflow files, badge recipe templates and the architecture diagram move to `.github/CONTRIBUTING.md`. The agent block moves to `AGENTS.md` at the repo root, under forty lines, pointing to CONTRIBUTING and docs for the rest. None of it stays on the README.

## Write the docs pages

The agent writes this docs folder: an index, a guide for each workflow the context found, a reference page per command built from that command's own source file, the rule table from the rules command, an examples page, and a changelog. Each page repeats nothing the README or CONTRIBUTING already says in full.

## Check until clean

The agent runs the check command with the pages flag, which checks the README, AGENTS.md when the repo has one, CONTRIBUTING and every docs page in one pass, reads every finding, fixes the page the finding names, and runs it again until every page shows zero fails. A clean run is the floor, so the agent still reads the README once more as the reader would.

## Offer the clone count

When the repo ships no registry package, the agent offers to add the clonometer workflow, since clones are the only count such a repo has, and tells the user it needs a TRAFFIC_TOKEN secret scoped to that one repository.
