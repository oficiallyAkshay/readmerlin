# Rule ids

The table below is the same one the rules command prints: every rule readmerlin ships, its id, its default level and what a good README has.

| Rule | Level | What a good README has |
|---|---|---|
| hero/exists | fail | Everything before the first section holds a title, one bold tagline and the picture; a plain one-liner joins them unless Features opens with one |
| shape/badges-in-hero | fail | Badges live in the hero or in a Badges section |
| shape/hero-visual | fail | The hero holds a visual |
| shape/hero-one-visual | warn | The hero holds one visual |
| shape/cta-link | warn | The hero holds at most one bold link, to the real artifact |
| shape/section-count | warn | The section count stays within the limit |
| shape/section-length | warn | Every section stays within the line limit |
| shape/enable-step | fail | The install step sits in the hero, the first four sections, or CONTRIBUTING |
| shape/structured-sections | warn | A long section holds a list, a table or a picture |
| shape/earned-headings | fail | Every heading earns its place; the kill list names the ones that never do |
| shape/agents-in-contributing | fail | The agent block lives in AGENTS.md at the repo root, under forty lines; CONTRIBUTING no longer carries it |
| shape/section-order | warn | Sections come from the configured set, in its order |
| shape/prose-before-features | fail | Everything above Features is words, the hero graphic and badges |
| shape/install-in-words | fail | Install and usage are said in plain sentences; commands live in CONTRIBUTING |
| shape/feature-bullets | warn | Features is a bullet list or centred blocks; each leads with an emoji and states a value |
| shape/security-checklist | warn | Security opens with the credential, holds a checklist of what never happens, and may close with defaults and their bypass |
| shape/badges-table | warn | A Badges section is one full-width HTML table of live badges |
| badges/linked | fail | Every badge is wrapped in a link |
| badges/logo-present | warn | Shields badges carry a logo where one exists |
| badges/logo-renders | fail | Every shields badge logo actually renders |
| badges/ci-matches-remote | fail | The CI badge points at this repo's own workflow |
| badges/carry-facts | fail | Every badge carries a number or a fact; CI status is table stakes and stays out |
| badges/live-status | fail | A status badge reads from the live service |
| badges/count-source | fail | Every numeric badge has a source command whose output matches |
| badges/claims-backed | warn | A badge that states a claim reads it from a file a tested job writes |
| badges/row-length | warn | A badge row stays within the limit |
| badges/shown-as-badges | fail | A badge URL appears only as the badge itself, linked |
| prose/plain-punctuation | fail | Sentences are joined with commas, colons and full stops |
| prose/about-the-product | fail | Every sentence is about the product |
| prose/sentence-case | warn | Headings in sentence case |
| prose/plain-headings | warn | Section headings are words only |
| prose/says-it-once | warn | The opening paragraphs add to the tagline |
| prose/paragraph-length | warn | A paragraph stays within the sentence limit |
| prose/code-outside-sentences | warn | Code sits in a table, a link, or a short clause that names it on its own |
| prose/unhedged | warn | The artifact speaks for itself, without disclaimers |
| visuals/images-exist | fail | Every image exists and has alt text |
| visuals/svg-local | fail | SVG diagrams are committed in the repo |
| visuals/raster | warn | A raster image shows real output at real proportions |
| visuals/height | warn | Every image shows within the height limit |
| visuals/spec-beside | fail | Every diagram SVG has its source spec beside it |
| visuals/spec-agrees | fail | A hero shows every label its spec names |
| visuals/svg-escaped | fail | SVG text is XML escaped |
| visuals/svg-font-stack | fail | SVG text declares a font stack |
| visuals/svg-clipping | fail | Every SVG shape sits inside its viewBox |
| visuals/svg-text-overflow | warn | SVG labels fit inside the viewBox |
| visuals/distinct-icons | warn | Every item in an SVG has its own icon |
| honesty/root-files | warn | Every tracked root file is one a host or a reader needs |
| honesty/comparison-links | warn | Comparison columns are the real alternatives, each header a link to its repo |
| honesty/comparison-product-first | warn | The product is the first column of its comparison |
| honesty/comparison-marks | fail | A boolean comparison cell is ✅ or ❌ |
| privacy/denylist-clear | fail | Every word is clear of the committed hashed denylist |
| privacy/personal-data-clear | fail | Contact goes through the platform, paths are relative, keys stay out |
| privacy/hosts-through-badges | fail | Host install notes are reached through the host badges |
| links/relative | fail | Every relative link resolves to a file and every anchor to a heading |
| links/reader-can-act | fail | Every link goes to something the reader acts on; YAML files are described in CONTRIBUTING |
| links/external | fail | Every external link answers; a host that refuses an automated request (401, 403, 405, 429, 999) warns instead of failing |
| badges/registry-present | warn | A published package carries its registry version and downloads badges; a repo with no package carries its clone count; each host in worksWith has its badge |

A level is set per rule id under the `rules` key of readmerlin.json, for example setting `prose/sentence-case` to `off`, and any id left out keeps the level shown above.

Twenty of these rules also run on CONTRIBUTING and every docs page, since a page other than the README is judged on links, badges, privacy and plain punctuation, never on the README's section shape: links/relative, links/reader-can-act, links/external, prose/plain-punctuation, badges/linked, badges/logo-present, badges/logo-renders, badges/ci-matches-remote, badges/carry-facts, badges/live-status, badges/count-source, badges/row-length, badges/claims-backed, badges/registry-present, visuals/images-exist, visuals/svg-local, visuals/spec-beside, privacy/denylist-clear, privacy/personal-data-clear and privacy/hosts-through-badges.
