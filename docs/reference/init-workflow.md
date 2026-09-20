# init-workflow

Writes `.github/workflows/readme-check.yml`, pinned to the commit its latest release tag points at, with a `# vX.Y.Z` comment naming that tag, so the pin passes a pinact-style verifiability check and the workflow always runs the exact code that release carries. An existing file of the same name is left alone and reported as already there rather than overwritten.

## Arguments

`[dir]`, the repo to write into. Default the current working directory.

## Flags

`--clones`, also writes `.github/workflows/clonometer.yml`, pinned the same way, and prints the two badge recipe URLs the repo can use once clonometer's first scheduled run has written its numbers to the badges branch. It needs a `TRAFFIC_TOKEN` secret: a fine-grained token scoped to that one repository, with Contents write and Administration read.

## Exit codes

0 always. When GitHub cannot be reached to resolve the latest release, the workflow is still written with a `<sha>` placeholder and a `# vX.Y.Z, replace before pushing` comment in place of the pin, and a line tells the user to replace both before pushing.

## Output formats

Console log lines only: `wrote: <path>` or `exists: <path>` for each workflow, and, with `--clones`, the TRAFFIC_TOKEN note and the two badge recipe URLs. There is no `--format` flag.

## Example

```
readmerlin init-workflow --clones
```
