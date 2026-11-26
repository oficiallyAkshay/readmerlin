# Keep it true

The README, CONTRIBUTING and every docs page are held to the same check on every push and pull request, so none of the three can drift from the code without the build noticing.

## What runs

This repo's own CI has two jobs that matter to the pages. One scans the full git history for secrets. The other runs the test suite on two Node versions, then runs a self check: the built script checking its own three pages with the pages flag on and the output written in the GitHub annotation format, so a broken link or a stray em dash shows up as an inline comment on the pull request. A third job gates on both: it only succeeds when every job it needs succeeded, and that gate job is the one check branch protection requires, so a red secrets scan or a red test run blocks the merge just as surely as a red check would.

## What fails the build and what only warns

A rule at the fail level turns into a nonzero exit code the moment one finding reaches it, and that failing exit code is what turns the self check step, and so the gate, red. A rule at the warn level prints its finding in the same run but never changes the exit code, so the build stays green. Warnings are left for a person to read and decide on, not fixed automatically or hidden.

## Pinning the action to a commit

A repo that consumes readmerlin's own action rather than running the script by hand should pin it to one commit of this repository, never to a branch name, with a version comment naming the tag that commit came from, so a tool like pinact can verify the pin and the workflow always runs the exact code that commit carries. The init-workflow command does this for a new repo automatically: it asks GitHub for this repository's latest release, resolves the commit that release's tag points at, and writes both the commit and a `# vX.Y.Z` comment into the workflow file it creates. Once the pin is in place, this repo's own Dependabot configuration opens a weekly pull request bumping it, along with every other GitHub Actions pin and npm dependency, so the pin ages instead of going stale unnoticed.

## What --no-links and exec do

By default the command line checks external links and badge logos, and that is what --no-links turns off, useful offline or when a run should not depend on the network answering. The command line runs no count-source command from a repo's own readmerlin.json unless you pass --exec, since a count-source command is a shell command taken from the checked repo's own configuration. The old --no-exec is still accepted and keeps them off. The shipped action matches this: links stay on, but exec stays off unless a workflow sets it, and the action passes --exec only then. Only a repo whose maintainer opted in should let a CI run execute these commands. init-workflow writes that opt-in into every workflow it creates: the commands it would run come from that same repo's own readmerlin.json, so in that repo's own CI they are already trusted, and seven repos had to flip the input by hand before the template did this on its own. A workflow written by hand, or one checking a different repo's README from outside it, keeps the action's bare default of off.
