# check

Reads one or more markdown pages and reports every rule finding against each one. A page other than the README is judged only on the rules that opt into running on pages: links, badges, privacy and plain punctuation, never the README's section shape.

## Arguments

`file...`, one or more paths. When none are given and the pages flag is absent, it checks `README.md` alone.

## Flags

`--format text|github|json`, default `text`. `--config <file>`, the path to a readmerlin.json, default `readmerlin.json` at the repo root. `--pages`, checks `README.md`, whichever of `.github/CONTRIBUTING.md` or `CONTRIBUTING.md` exists, and every markdown file under `docs`, in place of any given files. `--no-links`, skips every external link and badge logo request. `--no-exec`, never runs a count-source command from readmerlin.json.

## Exit codes

0 when every checked page is clean or carries only warnings. 1 when any page has a fail. 2 when the command line itself is wrong, such as an unknown flag or an unrecognised `--format` value.

## Output formats

`text` prints each finding's line number, level, message and rule id, its repair line when it has one, and a summary line per file. When a single file is checked in text format with links on, a line about a newer readmerlin version is appended if one is out. `github` prints the same findings as `::error` or `::warning` workflow commands, one per finding, plus a `::notice` summary, so a pull request shows them as inline annotations. `json` prints the full result object for one file, or an array of them for several.

## Example

```
readmerlin check --pages --no-links --no-exec
```
