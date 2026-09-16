# How a README for a skill, agent or MCP server is written

Hand this to the agent before it drafts. The reader is someone deciding, in ten seconds, whether this repo will change their day. Write for that reader first, and for the agent that will run the thing second.

## Principles

1. Value before mechanism. The reader learns what they get and why it matters before a word about how it is built. Tooling and process belong in reference pages.
2. Show, do not narrate. A picture of the flow or of the real output replaces the paragraph that would describe it. Sentences that explain how the README itself was produced are noise.
3. One idea, one line. Sections, bullets and table cells stay short and structured. A thought that needs a paragraph belongs in a doc page.
4. Badges carry facts. CI, coverage, runtime, license, hosts, counts. If a badge states it, the sentence goes. Only badges that change what the reader does; nothing decorative. Every badge has a logo that actually renders and links somewhere useful.
5. Standard shape, nothing redundant. Centered emoji and name, tagline in bold, one-liner, badge rows, one hero graphic, one bold link to the real artifact, then the sections that earn their place. Nothing the platform already surfaces (license file, contributing guide) and no "what you need" boilerplate.
6. The author's own words stay verbatim. Restructure freely; rewrite only when asked, and say when a sentence changes.
7. Two audiences, two registers. People get short and punchy at the top of a document; agents get a named, denser section at the bottom. README for humans, reference pages for the model.
8. No code references mid-prose. File names, flags and paths go in code blocks, links or tables.
9. Visuals are real and specific. Real page ratios, real output, a distinct icon per item, never a repeated generic icon; height minimal but legible. Diagrams over screenshots: the hero graphic drawn from a committed spec, the architecture diagram rendered once from committed source. Screenshots only of real output at real proportions, and only when nothing else shows it.
10. Facts stay honest. No faked status badges; a number that can drift gets a test that fails when it does; comparisons name categories, not products.
11. Fewer files, fewer sections. The root and the README are trimmed to what a host or a reader needs; popular-repo conventions win ties.
12. Tone: sentence case, no em dashes, no emoji decoration on bullets or headers, short sentences, no filler.

## What is different about an agent repo

The reader does not install a library and call it. They enable a skill and then say something to an agent. So the README answers three questions in this order: what situation am I in, what do I say, what comes back. Every section serves one of those.

- Value comes from outcomes, not features. Derive the one-liner from what the skill produces for the reader, taken from its description and its workflows, never from its file tree.
- Mechanism is one diagram. Everything after the judgment step collapses into one box.
- The install line is how this audience installs: `npx skills add owner/repo -g`, a plugin command, or a folder copy. One line, no prerequisites paragraph.
- "Runs on" is a badge row of hosts, each linking to that host's install notes.
- Configuration is a settings table and then a privacy table: what leaves your machine, as concern, what happens, guard.

## The default shape

This is the shape that has worked. It is a default, not a law. Drop a section that has nothing to say. Never add one that restates a badge, a diagram or a table.

- Header: emoji plus name centered, tagline in bold, one-liner under it.
- Badge row 1: CI, coverage, runtime, then for every package the repo publishes its registry version and downloads badges (npm, PyPI, crates.io, RubyGems), a count badge if one matters (kept honest by a test), a clone count when the repo runs the clone-count workflow, license.
- Badge row 2: "Runs on" hosts, logo only where it renders, each linking to that host's install notes.
- Hero graphic: what the reader has on the left, what gets handled fanning out in the middle with a distinct icon each and an "and more" card, the one thing they wanted on the right shown with what backs it. Drawn from the reader's chair, never from the builder's. Drawn with the herofold skill from a committed spec.
- One bold centered link to the example artifact. No disclaimer sentence.
- Two opening sentences on the reader's problem, ending on their time, not on a third party waiting.
- Features: one structured block, grouped, one line each, under twelve words, ending with the link to the full rules.
- How it works: the architecture diagram plus at most one sentence. Drawn with Archify from a committed JSON source.
- Quick start: three lines, one install command.
- Configuration and security: a settings table, then "What leaves your machine: nothing" as a concern, what happens, guard table.
- Common workflows: situation, what you say, what comes back.
- How it compares: alternatives as columns by category, capabilities as rows.
- For agents: the named, denser section at the end.

## Kill list

Host-path pointer lines, "or the HTML master" style secondary links, "fully synthetic" disclaimers, screenshot captions, meta sentences about the tools that drew a diagram, "Where it runs", "Example", "What you need", "Contributing and license" sections, any paragraph that restates what a badge, a diagram or a table already says.

## Process that produced good results

- Draft the visuals first, then cut prose until every remaining sentence carries something no visual does.
- Show sections in chat before committing them.
- Run `readmerlin check` on every change: prose gate, badge honesty, privacy denylist, links.
- Drop the readme-check workflow into the repo so the check runs on every push.
