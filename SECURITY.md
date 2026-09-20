# Security

## Supported versions

The current `main` branch and the version named in `package.json` on it.
Nothing older gets a fix.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on this repository:
https://github.com/oficiallyAkshay/readmerlin/security/advisories/new

Never open a public issue for a vulnerability. Expect an acknowledgement
within seven days.

## Scope

readmerlin handles no credential of its own. The writing runs on the
installing user's own agent login, and the check calls no model. The check
opens files in the installing repo — manifests, skill, command and agent
files, workflows, the licence and the README — and, by default, fetches
external links and badge logos over HTTPS once a day per link; `--no-links`
turns that off. It never sends a file anywhere and never sends telemetry.

The one input that runs anything from the installing repo is `exec`, off by
default: turning it on runs the count-source commands the repo's own
`readmerlin.json` names, in the runner's own shell. Treat that config the
same as any other code in the repository that turns it on.
