<h1 align="center">🧙 readmerlin</h1>

<p align="center">
  <b>Writes a README a person finishes in a minute, and keeps it true on every merge.</b>
</p>

<p align="center"><img alt="Your repo feeds three pages on every merge: the README a person reads, and the CONTRIBUTING and docs an agent reads, with every item on them checked" src="assets/readme/hero.svg" width="900"></p>

<p align="center">
  <a href="LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/license-MIT-2f6f4e?logo=opensourceinitiative&logoColor=white"></a>
  <a href="https://github.com/oficiallyAkshay/clonometer"><img alt="clones of this repository, last seven days and all time" src="https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/oficiallyAkshay/readmerlin/badges/clones.json&query=$.badge&label=clones&logo=github&logoColor=white"></a>
</p>

<p align="center">
  <a href="https://github.com/anthropics/claude-code"><img alt="works with Claude Code" src="https://img.shields.io/badge/works%20with-Claude%20Code-1e1b4b?logo=claude&logoColor=white"></a>
  <a href="https://github.com/openai/codex"><img alt="works with Codex" src="https://img.shields.io/badge/works%20with-Codex-1e1b4b"></a>
  <a href="https://cursor.com"><img alt="works with Cursor" src="https://img.shields.io/badge/works%20with-Cursor-1e1b4b?logo=cursor&logoColor=white"></a>
  <a href="https://github.com/google-gemini/gemini-cli"><img alt="works with Gemini CLI" src="https://img.shields.io/badge/works%20with-Gemini%20CLI-1e1b4b?logo=googlegemini&logoColor=white"></a>
  <a href="https://github.com/features/copilot"><img alt="works with Copilot" src="https://img.shields.io/badge/works%20with-Copilot-1e1b4b?logo=githubcopilot&logoColor=white"></a>
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

By default the check fetches external links and badge logos, once a day per link; `--no-links` turns that off. By default it never runs the count commands in your config; the `exec` input turns them on. It needs Node 20 or newer. A private repository gets every check; its clone badge needs a clonometer gist.
