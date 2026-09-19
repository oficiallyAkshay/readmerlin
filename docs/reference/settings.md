# Settings

Every key readmerlin.json accepts, described by readmerlin.schema.json and applied by the config loader. A repo with no readmerlin.json gets every default below; a repo's own file only needs to name the keys it wants to change.

| Key | Default | Meaning |
|---|---|---|
| `$schema` | none | Points an editor at readmerlin.schema.json so the file is validated as it is typed. |
| `rules` | `{}` | Sets one rule id to `off`, `warn` or `fail`, overriding the level shown on [the rule ids reference](rule-ids.md). |
| `killList` | Limits, Configuration, Configuration and security, Quick start, Quickstart, Getting started, How it works, Common workflows, For agents, Where it runs, Example, Examples, What you need, Prerequisites, Requirements, Contributing, Contributing and license, License, Acknowledgments, Acknowledgements, Roadmap, Built with, Table of contents | Second-level headings on the README that never earn their place, checked by shape/earned-headings. |
| `disclaimers` | fully synthetic, for illustration, or the HTML master, illustrative purposes | Phrases that trip prose/unhedged wherever they appear. |
| `headingAllowlist` | README, CI, MCP, API, CLI, PDF, SVG, JSON, YAML, URL, HTML, Claude, Claude Code, Cursor, Codex, Gemini, Copilot, GitHub, OpenAI, Anthropic, Archify, Wi-Fi, Node, Python | Names allowed to keep their capitals in an otherwise sentence-case heading. |
| `sectionOrder` | Features, In action, Fit, How it compares, Security and limits, Badges | The set and order of second-level sections shape/section-order checks. An empty list turns that check off. |
| `maxSections` | 8 | The most second-level sections shape/section-count allows on the README. |
| `maxSectionLines` | 40 | The most lines one section may hold under shape/section-length. |
| `maxParagraphSentences` | 4 | The most sentences one paragraph may hold under prose/paragraph-length. |
| `maxBadgesPerRow` | 6 | The most badges badges/row-length allows on one line. |
| `maxImageHeight` | 700 | The tallest an image's declared height may be under visuals/height. |
| `maxFindingsPerRule` | 10 | Findings beyond this many, per rule per file, fold into one summary line instead of listing each one. |
| `denylistFile` | `.readmerlin/denylist.sha256` | The file of sha256 hashes privacy/denylist-clear reads, one hash per line, so a private word never has to be typed into the config itself. |
| `counts` | `{}` | Maps a badge label to a shell command whose printed output must match the number shown in a numeric badge, checked by badges/count-source unless `--no-exec` is given. |
