# Keep it true

The README, CONTRIBUTING and every docs page are held to the same check on every push and pull request, so none of the three can drift from the code without the build noticing.

## What runs

This repo's own CI has two jobs that matter to the pages. One scans the full git history for secrets. The other runs the test suite on two Node versions, then runs a self check: the built script checking its own three pages with the pages flag on and the output written in the GitHub annotation format, so a broken link or a stray em dash shows up as an inline comment on the pull request. A third job gates on both: it only succeeds when every job it needs succeeded, and that gate job is the one check branch protection requires, so a red secrets scan or a red test run blocks the merge just as surely as a red check would.

## What fails the build and what only warns

A rule at the fail level turns into a nonzero exit code the moment one finding reaches it, and that failing exit code is what turns the self check step, and so the gate, red. A rule at the warn level prints its finding in the same run but never changes the exit code, so the build stays green. Warnings are left for a person to read and decide on, not fixed automatically or hidden.

## Pinning the action to a commit

A repo that consumes readmerlin's own action rather than running the script by hand should pin it to one commit of this repository, never to a branch name, with a version comment naming the tag that commit came from, so a tool like pinact can verify the pin and the workflow always runs the exact code that commit carries. The init-workflow command does this for a new repo automatically: it asks GitHub for this repository's latest release, resolves the commit that release's tag points at, and writes both the commit and a `# vX.Y.Z` comment into the workflow file it creates. Once the pin is in place, this repo's own Dependabot configuration opens a weekly pull request bumping it, along with every other GitHub Actions pin and npm dependency, so the pin ages instead of going stale unnoticed.

## What --no-links and exec do

By default the command line checks external links and badge logos, and that is what --no-links turns off, useful offline or when a run should not depend on the network answering. The command line also runs any count-source command a repo has listed in its own readmerlin.json by default, and --no-exec turns that off. The shipped action inverts the second default: links stay on, but exec stays off unless a workflow sets it, since a count-source command is a shell command taken from the repo's own configuration, and only a repo whose maintainer opted in should let a CI run execute it.
