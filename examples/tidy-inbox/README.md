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

You spent your own money on someone else's behalf. An interview, a client trip, a contract gig. It works in Claude Code, Cursor and Codex, from your calendar or from dates you give it.

Add the owner/tidy-inbox skill to your agent, then say "Build my claim for the trip on June 11." It needs no secret.

## Features

- 📅 **Trip dates found.** It reads them from your calendar, or asks once.
- 🔎 **One window searched.** The inbox is searched for those days only.
- 📋 **Candidates shown first.** You see the list before anything is built.
- 🧾 **Every receipt attached.** One summary, then each receipt behind it.
- 🗣️ **Corrections, your way.** Say "the flight was on the corporate card" and the total follows.

## Security

It needs no credential of its own; it reads mail through the mail tool your agent already has.

- ❌ sends the claim to anyone
- ❌ copies mail out of your inbox
- ❌ reads outside the trip window
- ❌ writes anywhere but the folder you name

## Callouts

- It finds only receipts that reached the inbox your agent can read.
- You send the claim. The skill stops once it hands it back.
