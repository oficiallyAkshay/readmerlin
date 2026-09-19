<h1 align="center">🧾 tidy-inbox</h1>

<p align="center">
  <b>Your money went out and the receipts are scattered. tidy-inbox turns the week into one claim.</b>
</p>

<p align="center"><img alt="Inbox and calendar feed receipts of every kind into one claim with the receipts behind the summary" src="assets/readme/hero.svg" width="900"></p>

<p align="center">
  <a href="SKILL.md"><img alt="agent skill" src="https://img.shields.io/badge/agent-skill-7C3AED?logo=anthropic&logoColor=white"></a>
  <a href="https://github.com/oficiallyAkshay/readmerlin/blob/main/LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/license-MIT-2f6f4e?logo=opensourceinitiative&logoColor=white"></a>
</p>

<p align="center">
  <b><a href="SKILL.md">See the skill it documents</a></b>
</p>

## Features

tidy-inbox turns a work trip into one claim, one receipt at a time.

<p align="center">📅<br><b>Trip dates found</b><br>It reads them from your calendar, or asks once.</p>

<p align="center">🔎<br><b>One window searched</b><br>The inbox is searched for those days only.</p>

<p align="center">📋<br><b>Candidates shown first</b><br>You see the list before anything is built.</p>

<p align="center">🧾<br><b>Every receipt attached</b><br>One summary, then each receipt behind it.</p>

<p align="center">🗣️<br><b>Corrections, your way</b><br>Say "the flight was on the corporate card" and the total follows.</p>

## In action

"Total: $290.50 across three receipts, one flight moved to the corporate card." That is [the claim it built](examples/claim.md) for a June client trip.

## Fit

- Use it when you paid your own money for a work trip and need one claim to send.
- Look elsewhere when your company already runs expense software with receipt capture built in.
- It reads mail through the mail tool your agent already has, so it needs no separate inbox login.
- Add the owner/tidy-inbox skill to your agent, then say "Build my claim for the trip on June 11." It needs no secret.

## Security and limits

It needs no credential of its own; it reads mail through the mail tool your agent already has.

- ❌ sends the claim to anyone
- ❌ copies mail out of your inbox
- ❌ reads outside the trip window
- ❌ writes anywhere but the folder you name

By default it asks once for the trip dates when your calendar has none; answering once covers the whole claim.
