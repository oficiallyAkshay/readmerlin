import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { check } from "../src/check/index.js";
import { format } from "../src/check/format.js";

// Review fixes, one small case each, so a defect cannot come back.

const HERO = `<h1 align="center">🧾 tidy</h1>\n\n<p align="center"><b>Receipts in, claim out.</b><br>One week of receipts becomes one claim.</p>\n\n<p align="center"><a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-2f6f4e?logo=opensourceinitiative"></a></p>\n\n<p align="center"><img alt="Receipts flow into one claim" src="assets/readme/hero.svg" width="900"></p>\n\n<p align="center"><b><a href="examples/claim.pdf">See the example claim</a></b></p>\n\nAdd the tidy skill to your agent, then hand it the week.\n`;
const BARE = HERO.replace("Add the tidy skill to your agent, then hand it the week.", "Hand it the week.");
const QUICK = `## Features\n\n- 🧾 **Every receipt found.** The inbox is searched for the trip window only.\n`;
const AGENTS = `## Callouts\n\n- It reads the inbox your agent can already read.\n`;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><style>text{font-family:system-ui}</style><rect x="0" y="0" width="100" height="40"/><text x="4" y="20" font-size="12">Hi</text></svg>';
const badge = (src: string, href = "LICENSE") => `<a href="${href}"><img alt="x" src="${src}"></a>`;
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

function repo(readme: string, files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "rm-fix-"));
  for (const [rel, content] of Object.entries({ "assets/readme/hero.svg": SVG, "assets/readme/hero.hero.json": "{}", "examples/claim.pdf": "%PDF", LICENSE: "MIT License", ...files })) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  writeFileSync(join(dir, "README.md"), readme);
  return dir;
}

const run = (dir: string, file = "README.md") => check(join(dir, file), { format: "json", links: false });
const ids = async (dir: string) => (await run(dir)).findings.map((f) => f.id);
const of = async (dir: string, id: string) => (await run(dir)).findings.filter((f) => f.id === id);

describe("badges", () => {
  it("sees an html badge inside a markdown link as linked, not as a raw URL", async () => {
    const dir = repo(HERO.replace('<p align="center"><a href="LICENSE">', '[<img alt="n" src="https://img.shields.io/badge/node-20%2B-339933?logo=nodedotjs">](https://nodejs.org)\n\n<p align="center"><a href="LICENSE">') + "\n" + QUICK);
    const f = await ids(dir);
    expect(f).not.toContain("badges/linked");
    expect(f).not.toContain("badges/shown-as-badges");
  });
  it("sees a badge inside a long picture element as linked", async () => {
    const long = "https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/o/r/badges/clones.json&query=$.badge&label=clones&logo=github&logoColor=white&style=flat-square&labelColor=1a1a1a&color=6f42c1";
    const dir = repo(HERO.replace('<p align="center"><a href="LICENSE">', `<a href="LICENSE"><picture><source media="(prefers-color-scheme: dark)" srcset="${long}&theme=dark"><source media="(prefers-color-scheme: light)" srcset="${long}&theme=light"><img alt="clones" src="${long}"></picture></a>\n\n<p align="center"><a href="LICENSE">`) + "\n" + QUICK);
    expect(await ids(dir)).not.toContain("badges/linked");
  });
  it("reads reference-style badges and links", async () => {
    const dir = repo(HERO + "\n[![g][gbadge]][glink]\n\n[gbadge]: https://img.shields.io/badge/build-passing-green?logo=x\n[glink]: missing-file.md\n\n" + QUICK);
    const f = await ids(dir);
    expect(f).toContain("badges/live-status");
    expect(f).not.toContain("badges/linked");
    expect((await of(dir, "links/relative")).map((x) => x.message)).toEqual(["Link target not found: missing-file.md"]);
  });
  it("decodes &amp; in a src before looking for the logo", async () => {
    const dir = repo(HERO.replace("?logo=opensourceinitiative", "?style=flat&amp;logo=opensourceinitiative") + "\n" + QUICK);
    expect(await ids(dir)).not.toContain("badges/logo-present");
  });
  it("tells a count badge from a dynamic label, reads the short form and escaped dashes, and normalises count keys", async () => {
    const rows = [
      badge("https://img.shields.io/badge/dynamic/json?url=https://x.test/b.json&query=$.badge&label=last-30-days&logo=github"),
      badge("https://img.shields.io/badge/downloads-1.2k-blue?logo=npm"),
      badge("https://img.shields.io/badge/last--7--days-1200-blue?logo=github"),
      badge("https://img.shields.io/badge/Things_Here-5-blue?logo=x"),
      badge("https://img.shields.io/badge/tests-1,204-blue?logo=vitest"),
    ].join("\n");
    const counts = { downloads: "echo 1234", "last-7-days": "echo 1200", "Things Here": "echo 5", tests: "echo 1204" };
    const dir = repo(HERO.replace('<p align="center"><a href="LICENSE">', rows + '\n\n<p align="center"><a href="LICENSE">') + "\n" + QUICK, { "readmerlin.json": JSON.stringify({ counts }) });
    const f = await ids(dir);
    expect(f).not.toContain("badges/count-source");
    expect(f).not.toContain("badges/live-status");
    expect(f).not.toContain("badges/claims-backed");
    const wrong = repo(HERO.replace('<p align="center"><a href="LICENSE">', badge("https://img.shields.io/badge/downloads-1.2k-blue?logo=npm") + '\n\n<p align="center"><a href="LICENSE">') + "\n" + QUICK, { "readmerlin.json": JSON.stringify({ counts: { downloads: "echo 1300" } }) });
    expect((await of(wrong, "badges/count-source"))[0]?.message).toContain("source says 1300");
  });
  it("splits a badge row on <br>", async () => {
    const four = Array(4).fill(badge("https://img.shields.io/badge/license-MIT-blue?logo=x")).join("\n  ");
    const oneRow = repo(HERO.replace(/<p align="center"><a href="LICENSE">.*?<\/p>/, `<p align="center">\n  ${four}\n  ${four}\n</p>`) + "\n" + QUICK);
    expect(await ids(oneRow)).toContain("badges/row-length");
    const twoRows = repo(HERO.replace(/<p align="center"><a href="LICENSE">.*?<\/p>/, `<p align="center">\n  ${four}\n  <br>\n  ${four}\n</p>`) + "\n" + QUICK);
    expect(await ids(twoRows)).not.toContain("badges/row-length");
  });
  it("does not take a local image under a badge folder for a badge", async () => {
    const dir = repo(HERO + "\n" + QUICK + '\n<img alt="shape" src="assets/badge/shape.svg">\n', { "assets/badge/shape.svg": SVG, "assets/badge/shape.json": "{}" });
    expect(await ids(dir)).not.toContain("shape/badges-in-hero");
  });
});

describe("links", () => {
  it("skips links with a custom scheme", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n- [VS Code](vscode:mcp/install?x) [Cursor](cursor://a/b) [tel](tel:123) [mail](mailto:a@example.com)\n");
    expect(await ids(dir)).not.toContain("links/relative");
  });
  it("resolves relative links from the README's folder, root-relative links and the config from the git root", async () => {
    const dir = repo("", { ".git": "gitdir: elsewhere", "sub/README.md": "# t\n\n**b**\n\nc — d\n\n## s\n\n- [a](../LICENSE) [b](/LICENSE) [c](../../LICENSE) [d](README.md)\n", "readmerlin.json": JSON.stringify({ rules: { "prose/plain-punctuation": "off" } }) });
    const r = await run(dir, "sub/README.md");
    expect(r.findings.filter((f) => f.id === "links/relative").map((f) => f.message)).toEqual(["Link points outside the repo: ../../LICENSE"]);
    expect(r.ran).not.toContain("prose/plain-punctuation");
  });
  it("keeps the leading hyphen of an emoji heading and underscores in an anchor", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## 🚀 Launch\n\n- [top](#-launch) and [u](#snake_case) and [c](#custom)\n\n<a id='custom'></a>\n\n## snake_case\n\n- y\n");
    expect(await ids(dir)).not.toContain("links/relative");
  });
  it("gives two hyphens for two spaces, keeps a variation selector and finds an id on any element", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n- [a](#-integration--messaging) and [b](#️-developer-tools--support) and [c](#tool-configuration)\n\n<details>\n<summary><b id=\"tool-configuration\">👉 Tool configuration</b></summary>\ntext\n</details>\n\n## 📡 Integration & Messaging\n\n- y\n\n## 🛠️ Developer Tools & Support\n\n- z\n");
    expect((await of(dir, "links/relative")).map((x) => x.message)).toEqual([]);
  });
  it("numbers the anchor of a repeated heading", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n- [a](#setup) and [b](#setup-1) and [c](#setup-2)\n\n## Setup\n\n- y\n\n## Setup\n\n- z\n");
    expect((await of(dir, "links/relative")).map((x) => x.message)).toEqual(["Anchor not found: #setup-2"]);
  });
  it("does not read a heading inside a fence as an anchor", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n- [s](#secret)\n\n```sh\n# secret\n```\n");
    expect((await of(dir, "links/relative")).map((x) => x.message)).toEqual(["Anchor not found: #secret"]);
  });
  it("checks the href a badge is wrapped in, while cta-link still ignores image-only links", async () => {
    const dir = repo(HERO.replace('<p align="center"><a href="LICENSE">', '[![b](https://img.shields.io/badge/license-MIT-blue?logo=x)](missing-a.md)\n\n<p align="center"><b><a href="missing-b.md"><img alt="x" src="https://img.shields.io/badge/license-MIT-blue?logo=x"></a></b><a href="LICENSE">') + "\n" + QUICK);
    const r = await run(dir);
    expect(r.findings.filter((f) => f.id === "links/relative").map((f) => f.message).sort()).toEqual(["Link target not found: missing-a.md", "Link target not found: missing-b.md"]);
    expect(r.findings.map((f) => f.id)).not.toContain("shape/cta-link");
  });
  it("always resolves an empty anchor, #top and #readme", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n- [a](#) [b](#top) [c](#readme)\n");
    expect(await ids(dir)).not.toContain("links/relative");
  });
});

describe("visuals", () => {
  const TALL = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000"><style>text{font-family:system-ui}</style><rect width="800" height="1000"/></svg>';
  it("reads an html height, a px width and a percent width", async () => {
    const dir = repo(HERO + "\n" + QUICK + '\n<img alt="a" src="assets/readme/tall.svg" height="300">\n\n<img alt="b" src="assets/readme/tall.svg" width="600px">\n\n<img alt="c" src="assets/readme/tall.svg" width="50%">\n', { "assets/readme/tall.svg": TALL, "assets/readme/tall.json": "{}" });
    const heights = await of(dir, "visuals/height");
    expect(heights.length).toBe(1);
    expect(heights[0].message).toContain("750px");
  });
  it("matches spec labels through numeric entities and tspans", async () => {
    const spec = JSON.stringify({ title: "t", sources: [{ label: "Don't panic" }], deliverable: { label: "one claim" } });
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 40"><style>text{font-family:system-ui}</style><text x="4" y="20" font-size="12" textLength="100">Don&#39;t panic</text><text x="4" y="30" font-size="12" textLength="100"><tspan>one</tspan> <tspan>claim</tspan></text></svg>';
    const dir = repo(HERO + "\n" + QUICK, { "assets/readme/hero.hero.json": spec, "assets/readme/hero.svg": svg });
    expect(await ids(dir)).not.toContain("visuals/spec-agrees");
  });
  it("measures clipping against the viewBox origin and skips transformed groups", async () => {
    const svg = (body: string, vb = "-50 -50 100 100") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><style>text{font-family:system-ui}</style>${body}</svg>`;
    const fine = repo(HERO + "\n" + QUICK, { "assets/readme/hero.svg": svg('<rect x="-40" y="-40" width="80" height="80"/><g transform="translate(100,50)"><rect x="-20" y="-20" width="40" height="40"/></g>') });
    expect(await ids(fine)).not.toContain("visuals/svg-clipping");
    const clipped = repo(HERO + "\n" + QUICK, { "assets/readme/hero.svg": svg('<rect x="-60" y="0" width="40" height="40"/>') });
    expect(await ids(clipped)).toContain("visuals/svg-clipping");
  });
});

describe("format", () => {
  it("escapes % and line breaks in github annotations", () => {
    const out = format({ file: "README.md", findings: [{ id: "badges/count-source", level: "fail", message: "says 5, source says 100%\nline two.", line: 3, repair: "Fix\nit." }], fails: 1, warns: 0, ran: [] }, "github");
    expect(out).toContain("::says 5, source says 100%25%0Aline two. Repair: Fix%0Ait.\n");
  });
});

describe("shape, prose and privacy", () => {
  it("gives CRLF and LF the same findings on the same lines", async () => {
    const lf = HERO.replace(/<p align="center"><img[^\n]*\n\n/, "") + "\n" + QUICK + '\n<img alt="late" src="assets/readme/hero.svg">\n';
    const a = (await run(repo(lf))).findings.map((f) => `${f.id}:${f.line}`);
    const b = (await run(repo(lf.replace(/\n/g, "\r\n")))).findings.map((f) => `${f.id}:${f.line}`);
    expect(a).toContain("shape/hero-visual:1");
    expect(b).toEqual(a);
  });
  it("matches denylist tokens with a trailing stop, unicode letters and compound parts", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\n- built at acme.\n- by zoë\n- with acme-corp\n- at acme.example.com\n- a clean line\n\n" + AGENTS, { ".readmerlin/denylist.sha256": [hash("acme"), hash("zoë")].join("\n") + "\n" });
    expect((await of(dir, "privacy/denylist-clear")).length).toBe(4);
  });
  it("resolves a relative denylistFile against the repo root", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\n- built at acme\n\n" + AGENTS, { "readmerlin.json": JSON.stringify({ denylistFile: "lists/deny.sha256" }), "lists/deny.sha256": hash("acme") + "\n" });
    expect((await of(dir, "privacy/denylist-clear")).length).toBe(1);
  });
  it("catches an email behind mailto:", async () => {
    const dir = repo(HERO + "\n" + QUICK + '\n## Notes\n\n- write to [me](mailto:john.doe@gmail.com)\n- or <a href="mailto:jane@gmail.com">Jane</a>\n\n' + AGENTS);
    expect((await of(dir, "privacy/personal-data-clear")).length).toBe(2);
  });
  it("leaves .readmerlin and a gemspec alone at the root", async () => {
    const dir = repo(HERO + "\n" + QUICK, { ".readmerlin/denylist.sha256": "", "foo.gemspec": "" });
    expect(await ids(dir)).not.toContain("honesty/root-files");
  });
  it("wants a plain one-liner beyond the title and the bold line, in html or inline html", async () => {
    const html = repo('<h1 align="center">t</h1>\n\n<p align="center"><b>Tag.</b></p>\n\n<p align="center"><b><a href="LICENSE">See</a></b></p>\n\n' + QUICK);
    expect((await of(html, "hero/exists")).map((f) => f.message)).toEqual(["No plain one-liner before the first section."]);
    const inline = repo('# t\n\n**b**\n\n<a href="LICENSE"><img alt="x" src="assets/readme/hero.svg"></a>\n\n' + QUICK);
    expect((await of(inline, "hero/exists")).map((f) => f.message)).toEqual(["No plain one-liner before the first section."]);
    expect(await ids(repo(HERO + "\n" + QUICK))).not.toContain("hero/exists");
  });
  it("takes a clone and build, or a download, for the install step", async () => {
    for (const line of ["Clone the repo, build it with Swift, and start the launcher.", "Download the app from the releases page and open it."]) {
      const dir = repo(HERO.replace("Add the tidy skill to your agent, then hand it the week.", line) + "\n" + QUICK);
      expect(await ids(dir)).not.toContain("shape/enable-step");
    }
  });
  it("finds the install sentence in an html block, a list item and a claude plugin command", async () => {
    expect(await ids(repo(BARE + '\n<p align="center">Add the tidy skill to your agent.</p>\n\n' + QUICK))).not.toContain("shape/enable-step");
    expect(await ids(repo(BARE + "\n## Features\n\n- 🧾 **Start.** Add the tidy skill to your agent.\n"))).not.toContain("shape/enable-step");
    expect(await ids(repo(BARE + "\n## Features\n\n1. `claude plugin install tidy@owner`, then ask.\n"))).not.toContain("shape/enable-step");
    expect(await ids(repo(BARE + "\n" + QUICK))).toContain("shape/enable-step");
  });
  it("does not take export default or export const for shell", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\nThe module has an `export default` entry.\n\n```\nexport const claim = build(week);\n```\n");
    expect(await ids(dir)).not.toContain("shape/install-in-words");
    expect(await ids(repo(HERO + "\n" + QUICK + "\n```\nexport TOKEN=abc\n```\n"))).toContain("shape/install-in-words");
  });
  it("tells For Claude from For Claude Desktop, and puts How it works on the kill list", async () => {
    expect(await ids(repo(HERO + "\n" + QUICK + "\n## For Claude Desktop\n\n- x\n"))).not.toContain("shape/agents-in-contributing");
    expect(await ids(repo(HERO + "\n" + QUICK + "\n## For Claude\n\n- x\n"))).toContain("shape/agents-in-contributing");
    expect(await ids(repo(HERO + "\n" + QUICK + "\n## How it works\n\n- x\n"))).toContain("shape/earned-headings");
  });
  it("ignores a dash inside an html comment, a four-backtick fence, a tilde fence and an indented block", async () => {
    const body = "\n<!-- TODO — tighten -->\n\n````md\n```\nfoo — bar\n```\n````\n\n~~~md\n```\nx — y\n```\n~~~\n\nExample:\n\n    total — 3\n\n";
    expect(await ids(repo(HERO + "\n" + QUICK + body))).not.toContain("prose/plain-punctuation");
    expect(await ids(repo(HERO + "\n" + QUICK + body + "after — fence\n"))).toContain("prose/plain-punctuation");
  });
  it("does not compare a tagline with a hard break against itself", async () => {
    const dir = repo("# t\n\n**Receipts in, claim out.**  \nOne week becomes one claim.\n\nAdd the tidy skill to your agent.\n\n" + QUICK);
    expect(await ids(dir)).not.toContain("prose/says-it-once");
  });
  it("lists maxFindingsPerRule in the schema", () => {
    const schema = JSON.parse(readFileSync(resolve(__dirname, "../readmerlin.schema.json"), "utf8"));
    expect(schema.properties.maxFindingsPerRule).toEqual(expect.objectContaining({ type: "integer", minimum: 1 }));
  });
});

describe("the 0.4 shape", () => {
  const block = (emoji: string, heading: string, line: string) => `<p align="center">${emoji}<br><b>${heading}</b><br>${line}</p>`;
  const BARE_HERO = '<h1 align="center">🧾 tidy</h1>\n\n<p align="center"><b>Receipts in, claim out.</b></p>\n\n<p align="center"><img alt="x" src="assets/readme/hero.svg" width="900"></p>\n';
  const GOOD_FEATURES = "## Features\n\ntidy turns receipts into one claim.\n\n" + [block("🧾", "Every receipt found", "The inbox is searched for the trip window only."), block("📋", "Candidates shown first", "You see the list before anything is built.")].join("\n\n") + "\n";

  it("accepts centred feature blocks with one opening sentence", async () => {
    expect(await ids(repo(HERO + "\n" + GOOD_FEATURES + "\n" + AGENTS))).not.toContain("shape/feature-bullets");
  });
  it("flags a feature heading outside two to four words", async () => {
    const bad = "## Features\n\n" + block("🧾", "Found", "The inbox is searched for the trip window only.") + "\n";
    expect(await ids(repo(HERO + "\n" + bad + "\n" + AGENTS))).toContain("shape/feature-bullets");
  });
  it("flags more than one plain sentence before the feature blocks", async () => {
    const bad = "## Features\n\nOne sentence.\n\nAnother sentence.\n\n" + block("🧾", "Every receipt found", "The inbox is searched for the trip window only.") + "\n";
    expect(await ids(repo(HERO + "\n" + bad + "\n" + AGENTS))).toContain("shape/feature-bullets");
  });

  it("accepts Security and limits closing with one By default paragraph", async () => {
    const sec = "## Security and limits\n\nIt needs no credential of its own.\n\n- ❌ sends a receipt anywhere\n- ❌ keeps a copy\n\nBy default it asks once for the trip dates; answering once covers the claim.\n";
    expect(await ids(repo(HERO + "\n" + QUICK + "\n" + sec))).not.toContain("shape/security-checklist");
  });
  it("flags two paragraphs after the Security and limits checklist", async () => {
    const sec = "## Security and limits\n\nIt needs no credential of its own.\n\n- ❌ sends a receipt anywhere\n\nBy default it asks once.\n\nAnd one more fact.\n";
    expect(await ids(repo(HERO + "\n" + QUICK + "\n" + sec))).toContain("shape/security-checklist");
  });
  it("flags a closing paragraph that does not read as defaults", async () => {
    const sec = "## Security and limits\n\nIt needs no credential of its own.\n\n- ❌ sends a receipt anywhere\n\nIt needs Node 20 or newer.\n";
    expect(await ids(repo(HERO + "\n" + QUICK + "\n" + sec))).toContain("shape/security-checklist");
  });

  it("lets the hero drop its plain line when Features opens with one", async () => {
    expect(await ids(repo(BARE_HERO + "\n" + GOOD_FEATURES + "\n" + AGENTS))).not.toContain("hero/exists");
  });
  it("still wants a plain line when Features opens straight with a block", async () => {
    const feats = "## Features\n\n" + block("🧾", "Every receipt found", "The inbox is searched for the trip window only.") + "\n";
    expect((await of(repo(BARE_HERO + "\n" + feats + "\n" + AGENTS), "hero/exists")).map((f) => f.message)).toEqual(["No plain one-liner before the first section."]);
  });

  it("finds the install step in CONTRIBUTING when the README names none", async () => {
    const dir = repo(BARE + "\n" + QUICK, { ".github/CONTRIBUTING.md": "# Contributing\n\n## How it ships\n\n```text\nnpx skills add owner/tidy -g\n```\n" });
    expect(await ids(dir)).not.toContain("shape/enable-step");
  });
  it("still fails when neither the README nor CONTRIBUTING names an install step", async () => {
    const dir = repo(BARE + "\n" + QUICK, { ".github/CONTRIBUTING.md": "# Contributing\n\nNothing to see here.\n" });
    expect(await ids(dir)).toContain("shape/enable-step");
  });

  it("puts Callouts outside the new default section order", async () => {
    expect(await ids(repo(HERO + "\n" + QUICK + "\n" + AGENTS))).toContain("shape/section-order");
  });
  it("keeps the new order quiet: Features, In action, Fit, How it compares, Security and limits, Badges", async () => {
    const parts = [
      HERO,
      QUICK,
      '## In action\n\n"One claim, three receipts, one flight corrected." That is what tidy built last month.\n',
      "## Fit\n\n- Use it when you travel for work.\n- Look elsewhere when you keep no receipts.\n",
      "## How it compares\n\n| | [owner/tidy](https://github.com/owner/tidy) |\n|---|---|\n| Installation | Skill |\n",
      "## Security and limits\n\nIt needs no credential of its own.\n\n- ❌ sends a receipt anywhere\n",
      '## Badges\n\nClick a badge for its recipe.\n\n<table width="100%">\n<tr><th></th><th>All time</th></tr>\n<tr><td>Claims</td><td><a href="https://img.shields.io/badge/dynamic/json?url=https://example.com/c.json&query=$.n&label=claims&logo=github"><img alt="claims" src="https://img.shields.io/badge/dynamic/json?url=https://example.com/c.json&query=$.n&label=claims&logo=github"></a></td></tr>\n</table>\n',
    ].join("\n");
    expect(await ids(repo(parts))).not.toContain("shape/section-order");
  });

  it("keeps a flag named in its own short clause quiet", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\nBy default the check runs each time; `--no-links` turns that off.\n\n" + AGENTS);
    expect(await ids(dir)).not.toContain("prose/code-outside-sentences");
  });
  it("flags a flag buried in a long sentence", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\nThe check reads every manifest, skill, command and agent file it can find in the repo before it ever writes to `README.md` on your behalf.\n\n" + AGENTS);
    expect(await ids(dir)).toContain("prose/code-outside-sentences");
  });
});

describe("a README below the repo root", () => {
  it("is judged on its own folder's files and manifest", async () => {
    const root = repo(HERO + "\n" + QUICK);
    writeFileSync(join(root, "package.json"), '{"name":"mono","private":true}');
    mkdirSync(join(root, "pkg"), { recursive: true });
    writeFileSync(join(root, "pkg/package.json"), '{"name":"wandr","main":"index.js"}');
    writeFileSync(join(root, "pkg/README.md"), HERO + "\n" + QUICK);
    writeFileSync(join(root, "pkg/LICENSE"), "MIT");
    execFileSync("git", ["init", "-q", root]);
    const r = await check(join(root, "pkg/README.md"), { format: "text", links: false, exec: false });
    expect(r.findings.filter((f) => f.id === "honesty/root-files")).toEqual([]);
    expect(r.findings.some((f) => f.id === "badges/registry-present" && /wandr/.test(f.message))).toBe(true);
  });
});
