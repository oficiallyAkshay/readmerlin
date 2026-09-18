# How a README for a skill, agent or MCP server is written

Hand this to the agent before it drafts. The reader is someone deciding, in ten seconds, whether this repo will change their day. The README is for that reader. The agent that runs the thing reads CONTRIBUTING.

## Principles

1. Value before mechanism. The reader learns what they get before a word about how it is built. Tooling and process belong in CONTRIBUTING.
2. Show the flow. A picture replaces the paragraph that would describe it, and every sentence is about the product.
3. Every sentence is short and plain, in the voice of someone explaining to a friend. Each fact is said once. Let the numbers praise the project.
4. Badges carry a number or a fact: coverage, licence, language version, dependency count, OpenSSF Scorecard score, registry version and downloads, and the product's own live badges. Green CI is table stakes once merges require it, so CI status stays off the page. Every badge has a logo that renders and a link.
5. One shape. Six parts in one order, listed below. The platform already surfaces the licence and the contributing guide, so the page leaves them to it.
6. The author's own words stay verbatim. Restructure freely; rewrite only when asked, and say when a sentence changes.
7. README for people. The install step is one sentence in the hero, which makes a Quick start section redundant. The agent block lives only in CONTRIBUTING under the .github folder, under forty lines.
8. The README is words, pictures, badges and tables. Workflow files, commands and badge recipes live in CONTRIBUTING. A name that must appear as code sits in a table or a link.
9. Link only to what a reader acts on: a page to read, a package to install, a repo to compare.
10. Visuals are real and specific. One hero graphic, drawn as an SVG from a committed spec with a rebuild test. Registries render SVG and leave Mermaid as text, so the hero is an SVG. An animated hero has a complete still frame. A distinct icon per item. View the hero at full width and in dark theme before shipping it.
11. Facts stay honest. A status badge reads from the live service. A number that can drift has a source command or a test that fails when it does. A badge that states a claim is an endpoint badge whose JSON a tested CI job writes. Every comparison cell is checked against the other project's README.
12. Fewer files, fewer sections. The root holds what a host or a reader needs.
13. Tone: sentence case, short sentences joined with commas, colons and full stops. Emoji go in the title and at the start of feature bullets.
14. Every rule says what a good README has. A finding says what is missing and how to repair it.
15. A green check is the floor, not the standard. Hold the page to this shape, then read it as the reader would.

## What is different about an agent repo

The reader does not install a library and call it. They enable a skill and then say something to an agent. The README answers three questions in order: what situation am I in, what do I get, what should I know first.

- Value comes from outcomes, not features. Derive the tagline from what the skill produces for the reader, taken from its description and its workflows.
- Every noun in the hero and the opening paragraph is the reader's noun.
- The repo wears its own badge. A project that ships a badge, a check or a count shows its own live one.

## The shape

These six parts, in this order. A part with nothing to say is dropped. The set is closed.

### Hero

- The title with one emoji, centered.
- One tagline in bold. It states the problem and the fix in a single line, about the count or the outcome.
- The hero graphic comes next. Badge rows go below the graphic.
- The hero takes the shape of the product's own verb. A product that gathers many things into one is a fan-in. A product that makes one thing better is a before and after. A product that watches something over time is a timeline. Learn from a good hero how it thinks: the reader's nouns, the real output at real proportions, the mechanism as one arrow. Its layout belongs to its own product.
- Badge row 1 holds at most six of: coverage, licence, language version, dependency count, Scorecard, and the registry version and downloads of each published package. Past six, start a second row. Badge row 2: the product's own live badges. A repo with no registry package carries a clone count from clonometer, since clones are its only count; a published package lets its downloads badge do that job.
- Number format in a badge: short form above a thousand, such as 1.2k. The label carries the unit.
- The first paragraph names every supported approach, the default and the rest. It adds to the tagline.
- The install step is one plain sentence. It names the secret to store, if any, and the action, skill or package to add.
- An example artifact, when the repo commits one, gets one bold centered link.

### Features

- A bullet list.
- Each bullet: one emoji, a bold phrase of two to four words, one short clause.
- Lead with what it does for the reader. The customisation bullet goes last.
- Every bullet says something a badge does not, and states what the reader gets.

### Badges

Only when the product ships badges or numbers a reader will reuse.

- It shows data shape choices: which number, over which window. Style and colour are the reader's own.
- One lead sentence: click a badge for its recipe, and which shape is recommended.
- A matrix as an HTML table at full width, `<table width="100%">`. Rows are metrics. Columns are time windows: this week, all time, both.
- Every cell is a live badge from the project's own numbers, wrapped in a link to its own badge URL, so a click reveals the recipe.
- A badge URL appears only as the badge itself. Recipe templates go to CONTRIBUTING.

### Security

- One sentence: the single credential needed, its scope, and how it travels, such as in a request header only.
- Then one checklist of what the software never does. Every item starts with ❌.
- That is the whole section: one sentence and one list.

### How it compares

- Columns are the real alternatives. The product is the first column.
- Every column header is the full owner/repo name as a link, the product's own included.
- Row labels are objective nouns: Installation, Storage, Output, Token.
- A boolean cell is ✅ or ❌. Any other cell is one or two words.
- Verify every cell against the other project's README before it ships.

### Callouts

- The heading is "Callouts".
- Four or five one-line bullets in plain words: "Counting starts on the day you install it", "Expect up to a day of delay".
- One line says what a private repository gets.
- Each fact appears once.

## Kill list

The one list of what to cut, kept so the rest of this page can say what to write.

Limits, Configuration, Configuration and security, Quick start, Quickstart, Getting started, How it works, Common workflows, For agents, Where it runs, Example, Examples, What you need, Prerequisites, Requirements, Contributing, Contributing and license, License, Acknowledgments, Roadmap, Built with and Table of contents sections. Host-path pointer lines, "fully synthetic" disclaimers, screenshot captions, meta sentences about the tools that drew a diagram, a settings table, a schema block at the top, any paragraph that restates what a badge, the hero or a table already says.

## What CONTRIBUTING holds

Under the .github folder: the workflow YAML, CLI usage, the settings table, badge recipe templates, the architecture diagram, and the agent block under forty lines.

## Specs the check accepts beside an SVG

- A hero: `<name>.hero.json`. The check reads it and fails a hero that does not show every label the spec names. Any other `<name>.<kind>.json` beside a hero passes spec-beside but is not read.
- A diagram: `<name>.archify.json`, `<name>.d2` or `<name>.mmd`.
- Anything else: `<name>.json`. The check only looks for it, so keep its generator script and a rebuild test in the repo.

## Process that produced good results

- Draft the hero first, then cut prose until every remaining sentence carries something the picture does not.
- Show sections in chat before committing them.
- Run `readmerlin check` on every change: shape, badge honesty, privacy denylist, links.
- Drop the readme-check workflow into the repo so the check runs on every push.
