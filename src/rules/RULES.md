# How a README for a skill, agent or MCP server is written

Hand this to the agent before it drafts. Two readers, one repo, three pages. A person reads the README in a minute and decides whether this repo will change their day. An agent reads CONTRIBUTING and docs in full before it acts. All three are kept true on every merge.

## Principles

1. Value before mechanism. The reader learns what they get before a word about how it is built. Tooling and process belong in CONTRIBUTING and docs.
2. Show the flow. A picture replaces the paragraph that would describe it, and every sentence is about the product.
3. Every sentence is short and plain, in the voice of someone explaining to a friend. Each fact is said once. Let the numbers praise the project.
4. Badges carry adoption and licence: the licence, downloads or clones, and the product's own live numbers. No language version, no dependency count, no rule count. Green CI is table stakes once merges require it, so CI status stays off the page. Every badge has a logo that renders and a link.
5. One shape, in the order below. A part with nothing to say is dropped. The platform already surfaces the licence and the contributing guide, so the page leaves them to it.
6. The author's own words stay verbatim. Restructure freely; rewrite only when asked, and say when a sentence changes.
7. README for people. The install step is one sentence in Fit, for a repo that has one; for the product's own page, CONTRIBUTING carries it. Either way it makes a Quick start section redundant. The agent block lives only in CONTRIBUTING under the .github folder, under forty lines.
8. The README is words, pictures, badges and tables. Workflow files, commands and badge recipes live in CONTRIBUTING and docs. A name that must appear as code sits in a table or a link.
9. Link only to what a reader acts on: a page to read, a package to install, a repo to compare.
10. Visuals are real and specific. One hero graphic, drawn as an SVG from a committed spec with a rebuild test. Registries render SVG and leave Mermaid as text, so the hero is an SVG. An animated hero has a complete still frame. A distinct icon per item. View the hero at full width and in dark theme before shipping it.
11. Facts stay honest. A status badge reads from the live service. A number that can drift has a source command or a test that fails when it does. A badge that states a claim is an endpoint badge whose JSON a tested CI job writes. Every comparison cell is checked against the other project's README.
12. Fewer files, fewer sections. The root holds what a host or a reader needs.
13. Tone: sentence case, short sentences joined with commas, colons and full stops. Emoji go in the title and lead a feature block or bullet.
14. Every rule says what a good README has. A finding says what is missing and how to repair it.
15. A green check is the floor, not the standard. Hold the page to this shape, then read it as the reader would.
16. No rhetoric. Every sentence carries a fact a reader acts on. A feature is an outcome, never a mechanism. No "from the reader's chair", no "honest", no claim about the page itself.
17. Two readers. The person reads the README. The agent reads CONTRIBUTING and docs in full. All three are kept true on every merge.

## What is different about an agent repo

The reader does not install a library and call it. They enable a skill and then say something to an agent. The README answers three questions in order: what situation am I in, what do I get, what should I know first.

- Value comes from outcomes, not features. Derive the tagline from what the skill produces for the reader, taken from its description and its workflows.
- Every noun in the hero and the opening paragraph is the reader's noun.
- The repo wears its own badge. A project that ships a badge, a check or a count shows its own live one.

## The shape

Hero, Features, In action, Fit, How it compares, Security and limits, Badges, in that order. A part with nothing to say is dropped. The set is closed.

### Hero

- The title with one emoji, centered.
- One tagline in bold. It states the outcome in a single line.
- The hero graphic comes next. Badge rows go below the graphic.
- The hero is designed, not diagrammed: a headline that states the value, an eyebrow, a short subtitle, and the mechanism drawn as a picture beside it. One colour wash, one colour per tier. Nothing negative: no "before" page, no confetti, no maturity line. GitHub's own sidebar already carries version and maintainer.
- The hero takes the shape of the product's own verb, and a new verb gets a new layout, never a borrowed one. A product that gathers many things into one draws a fan. A product that makes one thing better draws a before and after. A product whose repo feeds several pages for different readers draws them as pages. Learn from a good hero how it thinks: the reader's nouns, the real output at real proportions, the mechanism as one arrow.
- Badge row: licence, downloads or clones, and the product's own live numbers. A repo with no registry package carries a clone count from clonometer, since clones are its only count; a published package lets its downloads badge do that job.
- Number format in a badge: short form above a thousand, such as 1.2k. The label carries the unit.
- The install step is one plain sentence in Fit, for a repo that has one. The product's own page carries it in CONTRIBUTING instead, and drops Fit when the page itself is the proof and the scope is obvious.
- An example artifact, when the repo commits one, gets one bold centered link.

### Features

- One optional plain sentence saying what the product is, then centred blocks.
- Each block: one emoji, a bold heading of two to four words, one line. A bullet list with an emoji lead and a bold phrase also passes.
- Each block states a value the reader gets, never a mechanism. The customisation block goes last.
- Every block says something a badge does not.

### In action

- A real result the product produced, quoted or captured, tied to a committed file.
- The product's own README may drop this section when the page itself is the artifact.

### Fit

- Use it when: at most three lines.
- Look elsewhere when: at most three lines.
- Requirements stated as consequences, not a list of prerequisites.
- The install step, one plain sentence, for a repo that has one.
- An alternative named here matches a comparison column in How it compares.
- The product's own README may drop this section when the page itself is the proof and the scope is obvious.

### How it compares

- Columns are the real alternatives. The product is the first column.
- Every column header is the full owner/repo name as a link, the product's own included.
- Row labels are objective nouns: Installation, Storage, Output, Token.
- A boolean cell is ✅ or ❌. Any other cell is one or two words.
- Verify every cell against the other project's README before it ships.

### Security and limits

- One sentence: the single credential needed, its scope, and how it travels, such as in a request header only.
- Then one checklist of what the software never does. Every item starts with ❌.
- Then, optionally, one paragraph of "By default ..." lines, each naming its own bypass. Delays and what a private repository gets live here too.

### Badges

Optional, only when the product ships badges or numbers a reader will reuse.

- It shows data shape choices: which number, over which window. Style and colour are the reader's own.
- One lead sentence: click a badge for its recipe, and which shape is recommended.
- A matrix as an HTML table at full width, `<table width="100%">`. Rows are metrics. Columns are time windows: this week, all time, both.
- Every cell is a live badge from the project's own numbers, wrapped in a link to its own badge URL, so a click reveals the recipe.
- A badge URL appears only as the badge itself. Recipe templates go to CONTRIBUTING.

## Kill list

The one list of what to cut, kept so the rest of this page can say what to write.

Limits, Configuration, Configuration and security, Quick start, Quickstart, Getting started, How it works, Common workflows, For agents, Where it runs, Example, Examples, What you need, Prerequisites, Requirements, Contributing, Contributing and license, License, Acknowledgments, Acknowledgements, Roadmap, Built with and Table of contents sections. Host-path pointer lines, "fully synthetic" disclaimers, screenshot captions, meta sentences about the tools that drew a diagram, a settings table, a schema block at the top, any paragraph that restates what a badge, the hero or a table already says.

## What CONTRIBUTING and docs hold

CONTRIBUTING, under the .github folder: commands, settings, workflows, badge recipe templates, how the pieces fit together, and the order of work, plus the agent block under forty lines.

Docs: guides, one per workflow; reference, one page per command with its flags and settings; the rule ids and levels; examples; benchmarks or evals, when the repo has any; and a changelog.

## Specs the check accepts beside an SVG

- A hero: `<name>.hero.json`. The check reads it and fails a hero that does not show every label the spec names. Any other `<name>.<kind>.json` beside a hero passes spec-beside but is not read.
- A diagram: `<name>.archify.json`, `<name>.d2` or `<name>.mmd`.
- Anything else: `<name>.json`. The check only looks for it, so keep its generator script and a rebuild test in the repo.

## Process that produced good results

- Draft the hero first, then cut prose until every remaining sentence carries something the picture does not.
- Show sections in chat before committing them.
- Run `readmerlin check` on every change: shape, badge honesty, privacy denylist, links.
- Drop the readme-check workflow into the repo so the check runs on every push.
