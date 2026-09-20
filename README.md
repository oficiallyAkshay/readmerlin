<h1 align="center">🧙 readmerlin</h1>

<p align="center">
  <b>Writes a README a person finishes in a minute, and keeps it true on every merge.</b>
</p>

<p align="center"><img alt="Your repo feeds three pages on every merge: the README a person reads, and the CONTRIBUTING and docs an agent reads, with every item on them checked" src="assets/readme/hero.svg" width="900"></p>

<p align="center">
  <a href="https://codecov.io/gh/oficiallyAkshay/readmerlin"><img alt="coverage" src="https://img.shields.io/codecov/c/github/oficiallyAkshay/readmerlin?logo=codecov&logoColor=white"></a>
  <a href="LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/license-MIT-2f6f4e?logo=opensourceinitiative&logoColor=white"></a>
  <a href="https://github.com/oficiallyAkshay/clonometer"><img alt="clones of this repository, last seven days and all time" src="https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/oficiallyAkshay/readmerlin/badges/clones.json&query=$.badge&label=clones&logo=github&logoColor=white"></a>
  <a href="https://www.bestpractices.dev/projects/14723"><img alt="OpenSSF Best Practices, passing" src="https://www.bestpractices.dev/projects/14723/badge"></a>
</p>

<p align="center">Works with<br>
  <a href="https://github.com/anthropics/claude-code"><img alt="Claude Code" src="https://img.shields.io/badge/Claude%20Code-1e1b4b?logo=claude&logoColor=white"></a>
  <a href="https://github.com/openai/codex"><img alt="Codex" src="https://img.shields.io/badge/Codex-1e1b4b?logo=data:image/svg%2bxml;base64,PHN2ZyBmaWxsPSJ3aGl0ZSIgcm9sZT0iaW1nIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPk9wZW5BSTwvdGl0bGU+PHBhdGggZD0iTTIyLjI4MTkgOS44MjExYTUuOTg0NyA1Ljk4NDcgMCAwIDAtLjUxNTctNC45MTA4IDYuMDQ2MiA2LjA0NjIgMCAwIDAtNi41MDk4LTIuOUE2LjA2NTEgNi4wNjUxIDAgMCAwIDQuOTgwNyA0LjE4MThhNS45ODQ3IDUuOTg0NyAwIDAgMC0zLjk5NzcgMi45IDYuMDQ2MiA2LjA0NjIgMCAwIDAgLjc0MjcgNy4wOTY2IDUuOTggNS45OCAwIDAgMCAuNTExIDQuOTEwNyA2LjA1MSA2LjA1MSAwIDAgMCA2LjUxNDYgMi45MDAxQTUuOTg0NyA1Ljk4NDcgMCAwIDAgMTMuMjU5OSAyNGE2LjA1NTcgNi4wNTU3IDAgMCAwIDUuNzcxOC00LjIwNTggNS45ODk0IDUuOTg5NCAwIDAgMCAzLjk5NzctMi45MDAxIDYuMDU1NyA2LjA1NTcgMCAwIDAtLjc0NzUtNy4wNzI5em0tOS4wMjIgMTIuNjA4MWE0LjQ3NTUgNC40NzU1IDAgMCAxLTIuODc2NC0xLjA0MDhsLjE0MTktLjA4MDQgNC43NzgzLTIuNzU4MmEuNzk0OC43OTQ4IDAgMCAwIC4zOTI3LS42ODEzdi02LjczNjlsMi4wMiAxLjE2ODZhLjA3MS4wNzEgMCAwIDEgLjAzOC4wNTJ2NS41ODI2YTQuNTA0IDQuNTA0IDAgMCAxLTQuNDk0NSA0LjQ5NDR6bS05LjY2MDctNC4xMjU0YTQuNDcwOCA0LjQ3MDggMCAwIDEtLjUzNDYtMy4wMTM3bC4xNDIuMDg1MiA0Ljc4MyAyLjc1ODJhLjc3MTIuNzcxMiAwIDAgMCAuNzgwNiAwbDUuODQyOC0zLjM2ODV2Mi4zMzI0YS4wODA0LjA4MDQgMCAwIDEtLjAzMzIuMDYxNUw5Ljc0IDE5Ljk1MDJhNC40OTkyIDQuNDk5MiAwIDAgMS02LjE0MDgtMS42NDY0ek0yLjM0MDggNy44OTU2YTQuNDg1IDQuNDg1IDAgMCAxIDIuMzY1NS0xLjk3MjhWMTEuNmEuNzY2NC43NjY0IDAgMCAwIC4zODc5LjY3NjVsNS44MTQ0IDMuMzU0My0yLjAyMDEgMS4xNjg1YS4wNzU3LjA3NTcgMCAwIDEtLjA3MSAwbC00LjgzMDMtMi43ODY1QTQuNTA0IDQuNTA0IDAgMCAxIDIuMzQwOCA3Ljg3MnptMTYuNTk2MyAzLjg1NThMMTMuMTAzOCA4LjM2NCAxNS4xMTkyIDcuMmEuMDc1Ny4wNzU3IDAgMCAxIC4wNzEgMGw0LjgzMDMgMi43OTEzYTQuNDk0NCA0LjQ5NDQgMCAwIDEtLjY3NjUgOC4xMDQydi01LjY3NzJhLjc5Ljc5IDAgMCAwLS40MDctLjY2N3ptMi4wMTA3LTMuMDIzMWwtLjE0Mi0uMDg1Mi00Ljc3MzUtMi43ODE4YS43NzU5Ljc3NTkgMCAwIDAtLjc4NTQgMEw5LjQwOSA5LjIyOTdWNi44OTc0YS4wNjYyLjA2NjIgMCAwIDEgLjAyODQtLjA2MTVsNC44MzAzLTIuNzg2NmE0LjQ5OTIgNC40OTkyIDAgMCAxIDYuNjgwMiA0LjY2ek04LjMwNjUgMTIuODYzbC0yLjAyLTEuMTYzOGEuMDgwNC4wODA0IDAgMCAxLS4wMzgtLjA1NjdWNi4wNzQyYTQuNDk5MiA0LjQ5OTIgMCAwIDEgNy4zNzU3LTMuNDUzN2wtLjE0Mi4wODA1TDguNzA0IDUuNDU5YS43OTQ4Ljc5NDggMCAwIDAtLjM5MjcuNjgxM3ptMS4wOTc2LTIuMzY1NGwyLjYwMi0xLjQ5OTggMi42MDY5IDEuNDk5OHYyLjk5OTRsLTIuNTk3NCAxLjQ5OTctMi42MDY3LTEuNDk5N1oiLz48L3N2Zz4="></a>
  <a href="https://cursor.com"><img alt="Cursor" src="https://img.shields.io/badge/Cursor-1e1b4b?logo=cursor&logoColor=white"></a>
  <a href="https://github.com/google-gemini/gemini-cli"><img alt="Gemini CLI" src="https://img.shields.io/badge/Gemini%20CLI-1e1b4b?logo=googlegemini&logoColor=white"></a>
</p>

<p align="center">Works with<br>
  <a href="https://github.com/features/copilot"><img alt="Copilot" src="https://img.shields.io/badge/Copilot-1e1b4b?logo=githubcopilot&logoColor=white"></a>
  <a href="https://github.com/anthropics/claude-agent-sdk-typescript"><img alt="Claude Agent SDK" src="https://img.shields.io/badge/Claude%20Agent%20SDK-1e1b4b?logo=claude&logoColor=white"></a>
  <a href="https://github.com/openclaw/openclaw"><img alt="OpenClaw" src="https://img.shields.io/badge/OpenClaw-1e1b4b"></a>
  <a href="https://github.com/NousResearch/hermes-agent"><img alt="Hermes Agent" src="https://img.shields.io/badge/Hermes%20Agent-1e1b4b"></a>
</p>

## Features

readmerlin writes your repo's README, docs and CONTRIBUTING.

<p align="center">⏱️<br><b>Read in a minute</b><br>One screen tells a person what it does, whether it is for them, and what it never does.</p>

<p align="center">🤝<br><b>One repo, two readers</b><br>The person gets the page. The agent gets CONTRIBUTING and docs, with everything it needs to act.</p>

<p align="center">🟢<br><b>Never goes stale</b><br>Every link, badge and number on the pages is checked on every merge.</p>

<p align="center">🗣️<br><b>Your words, not marketing</b><br>Your own sentences stay, and nothing is invented to fill a section.</p>

<p align="center">🔒<br><b>Private stays private</b><br>Names, emails and paths on your list never reach the page.</p>

<p align="center">📊<br><b>Numbers you can trust</b><br>Each number on the page is tied to the command that prints it.</p>

## How it compares

| | [oficiallyAkshay/readmerlin](https://github.com/oficiallyAkshay/readmerlin) | [eli64s/readme-ai](https://github.com/eli64s/readme-ai) | [DavidAnson/markdownlint](https://github.com/DavidAnson/markdownlint) | [lycheeverse/lychee](https://github.com/lycheeverse/lychee) |
| --- | --- | --- | --- | --- |
| README writer | ✅ | ✅ | ❌ | ❌ |
| Badge checks | ✅ | ❌ | ❌ | ❌ |
| Link checks | ✅ | ❌ | Anchors only | ✅ |
| Privacy checks | ✅ | ❌ | ❌ | ❌ |
| Installation | Skill | pip | npm | Binary |
| Model | Your agent | Optional | None | None |

## Security and limits

No credential. The writing runs on your agent's own login. The check calls no model.

- ❌ reads your code. It opens manifests, skill, command and agent files, workflows, the licence and the README
- ❌ sends a file anywhere
- ❌ updates itself. It prints one line when a newer version exists
- ❌ names a denylisted word in its output
- ❌ sends telemetry

By default the check fetches external links and badge logos, once a day per link; `--no-links` turns that off. By default the action never runs the count commands in your config; the workflow init-workflow writes turns them on, since the commands come from your own readmerlin.json and run in your own CI. It needs Node 20 or newer. A private repository gets every check; its clone badge needs a clonometer gist.
