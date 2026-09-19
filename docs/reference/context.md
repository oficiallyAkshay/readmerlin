# context

Gathers what a repo offers before an agent drafts anything: its git remote, its licence, every skill, plugin manifest, marketplace entry, MCP server, command, agent, hook and workflow file it can find, the names of its tracked root files, whether it already has an AGENTS.md, and, when one already exists, the current README's title, tagline, word count, badge count, image list and headings.

## Arguments

`[dir]`, the repo to read. Default the current working directory.

## Flags

`--format json|md`, default `json`.

## Exit codes

0 always. An empty or minimal repo simply prints empty or short sections rather than failing.

## Output formats

`json` prints the full structured result, one field per thing gathered. `md` prints the same information as short, readable sections meant to be read directly, with any secret-shaped value inside an MCP server's command or URL replaced with `<hidden>`.

## Example

```
readmerlin context . --format md
```
