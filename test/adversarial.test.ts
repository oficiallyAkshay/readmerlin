import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check } from "../src/check/index.js";
import { gather } from "../src/context/index.js";

const HERO = `<h1 align="center">🧾 tidy</h1>\n\n<p align="center"><b>Receipts in, claim out.</b><br>One week of receipts becomes one claim.</p>\n\n<p align="center"><a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-2f6f4e?logo=opensourceinitiative"></a></p>\n\n<p align="center"><img alt="Receipts flow into one claim" src="assets/readme/hero.svg" width="900"></p>\n\n<p align="center"><b><a href="examples/claim.pdf">See the example claim</a></b></p>\n\nAdd the tidy skill to your agent, then hand it the week.\n`;
const QUICK = `## Features\n\n- 🧾 **Every receipt found.** The inbox is searched for the trip window only.\n`;
const AGENTS = `## Callouts\n\n- It reads the inbox your agent can already read.\n`;

function repo(readme: string, files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "rm-adv-"));
  for (const [rel, content] of Object.entries({ "assets/readme/hero.svg": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><style>text{font-family:system-ui}</style><rect x="0" y="0" width="100" height="40"/><text x="4" y="20" font-size="12">Hi</text></svg>', "assets/readme/hero.hero.json": "{}", "examples/claim.pdf": "%PDF", LICENSE: "MIT License", ...files })) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  writeFileSync(join(dir, "README.md"), readme);
  return dir;
}

const ids = async (dir: string, level?: "fail" | "warn") => {
  const r = await check(join(dir, "README.md"), { format: "json", links: false });
  return r.findings.filter((f) => !level || f.level === level).map((f) => f.id);
};

describe("a clean README passes", () => {
  it("has zero fails", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n" + AGENTS);
    expect(await ids(dir, "fail")).toEqual([]);
  });
});

describe("dashes", () => {
  it("ignores dashes inside urls, inline code and fences", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\nSee [the guide](https://example.com/a–b) and `foo—bar`.\n\n```\nx — y\n```\n\n" + AGENTS);
    expect(await ids(dir)).not.toContain("prose/plain-punctuation");
  });
  it("catches a dash in prose", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\nOne thing — another.\n\n" + AGENTS);
    expect(await ids(dir, "fail")).toContain("prose/plain-punctuation");
  });
});

describe("shape tricks", () => {
  it("does not read a heading inside an html comment or a fence", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n<!-- ## License -->\n\n```md\n## Contributing\n```\n\n" + AGENTS);
    expect(await ids(dir)).not.toContain("shape/earned-headings");
  });
  it("does not count a badge inside a fence as a badge below the hero", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n```html\n<img src=\"https://img.shields.io/badge/a-b-c\">\n```\n\n" + AGENTS);
    expect(await ids(dir)).not.toContain("shape/badges-in-hero");
  });
  it("finds the enable step inside a list item, and as a plain sentence", async () => {
    const bare = HERO.replace("Add the tidy skill to your agent, then hand it the week.", "Hand it the week.");
    expect(await ids(repo(bare + "\n" + QUICK + "\n" + AGENTS))).toContain("shape/enable-step");
    expect(await ids(repo(bare + "\n## Features\n\n1. `npx skills add owner/tidy`, then ask.\n\n" + AGENTS))).not.toContain("shape/enable-step");
    expect(await ids(repo(HERO + "\n" + QUICK + "\n" + AGENTS))).not.toContain("shape/enable-step");
  });
  it("fails an empty README without crashing", async () => {
    const dir = repo("");
    const f = await ids(dir, "fail");
    expect(f).toContain("hero/exists");
  });
  it("handles a huge README in reasonable time", async () => {
    const body = Array.from({ length: 4000 }, (_, i) => `- line ${i} with some words in it`).join("\n");
    const dir = repo(HERO + "\n" + QUICK + "\n## Big\n\n" + body + "\n\n" + AGENTS);
    const t = Date.now();
    await ids(dir);
    expect(Date.now() - t).toBeLessThan(5000);
  });
  it("leaves CJK and allowlisted headings alone", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## 使い方\n\n- x\n\n## Runs on Claude Code\n\n- y\n\n" + AGENTS);
    expect(await ids(dir)).not.toContain("prose/sentence-case");
  });
});

describe("links and anchors", () => {
  it("resolves anchors to headings with punctuation and flags missing files", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## How it works: the loop\n\n- See [the loop](#how-it-works-the-loop) and [missing](docs/nope.md).\n\n" + AGENTS);
    const r = await check(join(dir, "README.md"), { format: "json", links: false });
    const rel = r.findings.filter((f) => f.id === "links/relative");
    expect(rel.length).toBe(1);
    expect(rel[0].message).toContain("docs/nope.md");
  });
});

describe("privacy", () => {
  it("flags emails, home paths and keys but not noreply or tilde paths", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\n- mail me at someone@corp.example.io\n- lives in /Users/alice/code\n- token sk-ant-abcdefghijklmnopqrstuvwxyz0123\n- bot 1234+bot@users.noreply.github.com\n- copy into `~/.claude/skills/x`\n\n" + AGENTS);
    const r = await check(join(dir, "README.md"), { format: "json", links: false });
    const pii = r.findings.filter((f) => f.id === "privacy/personal-data-clear");
    const first = pii[0]?.line ?? 0;
    expect(pii.map((f) => f.line).sort()).toEqual([first, first + 1, first + 2].sort());
  });
  it("matches a hashed denylist token without naming it", async () => {
    const { createHash } = await import("node:crypto");
    const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\n- worked with Acme Corp\n\n" + AGENTS, { ".readmerlin/denylist.sha256": createHash("sha256").update("acme").digest("hex") + "\n" });
    const r = await check(join(dir, "README.md"), { format: "json", links: false });
    const d = r.findings.filter((f) => f.id === "privacy/denylist-clear");
    expect(d.length).toBe(1);
    expect(d[0].message).not.toMatch(/acme/i);
  });
});

describe("config", () => {
  it("turns a rule off and honours a count source", async () => {
    const dir = repo(HERO.replace('<a href="LICENSE">', '<a href="docs/v.md"><img alt="vendors" src="https://img.shields.io/badge/vendors-3-6f42c1?logo=databricks"></a><a href="LICENSE">') + "\n" + QUICK + "\nOne thing — another.\n\n" + AGENTS, { "readmerlin.json": JSON.stringify({ rules: { "prose/plain-punctuation": "off" }, counts: { vendors: "echo 3" } }), "docs/v.md": "" });
    const r = await check(join(dir, "README.md"), { format: "json", links: false });
    expect(r.ran).not.toContain("prose/plain-punctuation");
    expect(r.findings.map((f) => f.id)).not.toContain("badges/count-source");
  });
});

describe("context", () => {
  it("survives broken frontmatter, missing git and odd manifests", async () => {
    const dir = repo("# x", { "SKILL.md": "---\nname: [unclosed\n---\n# s\n", ".claude-plugin/plugin.json": "{not json", ".mcp.json": "[]" });
    const c = await gather(dir);
    expect(c.skills.length).toBe(1);
    expect(c.plugin).toBeUndefined();
    expect(c.repo.owner).toBeUndefined();
  });
});

describe("review regressions", () => {
  it("does not crash on a bare percent in a link and rejects paths outside the repo", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\n- see [a](docs/100%.md) and [b](/examples/claim.pdf) and [c](../../etc/passwd)\n\n" + AGENTS);
    const r = await check(join(dir, "README.md"), { format: "json", links: false });
    const rel = r.findings.filter((f) => f.id === "links/relative").map((f) => f.message);
    expect(rel.some((m) => m.includes("100%"))).toBe(true);
    expect(rel.some((m) => m.includes("outside the repo"))).toBe(true);
    expect(rel.some((m) => m.includes("/examples/claim.pdf"))).toBe(false);
  });
  it("ignores links and images inside fences, inline code and comments", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\n```html\n<a href=\"docs/nope.md\">x</a>\n```\n\nUse `<img src=\"https://img.shields.io/badge/a-b-c\">` in yours.\n\n<!-- <img src=\"https://img.shields.io/badge/a-b-c\"> -->\n\n" + AGENTS);
    const ids = (await check(join(dir, "README.md"), { format: "json", links: false })).findings.map((f) => f.id);
    expect(ids).not.toContain("links/relative");
    expect(ids).not.toContain("shape/badges-in-hero");
    expect(ids).not.toContain("badges/linked");
  });
  it("wants a plain one-liner in a markdown hero too", async () => {
    const dir = repo("# t\n\n**b**\n\n" + QUICK + "\n" + AGENTS);
    const r = await check(join(dir, "README.md"), { format: "json", links: false });
    expect(r.findings.some((f) => f.id === "hero/exists" && /one-liner/.test(f.message))).toBe(true);
  });
  it("ignores a dash inside a markdown image alt", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\n![a — b](assets/readme/hero.svg)\n\n" + AGENTS);
    expect(await ids(dir)).not.toContain("prose/plain-punctuation");
  });
  it("keeps count-source commands off with exec false and names a missing config", async () => {
    const dir = repo(HERO.replace('<a href="LICENSE">', '<a href="docs/v.md"><img alt="vendors" src="https://img.shields.io/badge/vendors-3-6f42c1?logo=databricks"></a><a href="LICENSE">') + "\n" + QUICK + "\n" + AGENTS, { "readmerlin.json": JSON.stringify({ counts: { vendors: "echo 99" } }), "docs/v.md": "" });
    const r = await check(join(dir, "README.md"), { format: "json", links: false, exec: false });
    const c = r.findings.filter((f) => f.id === "badges/count-source");
    expect(c.length).toBe(1);
    expect(c[0].message).toMatch(/not verified/);
    expect(c[0].level).toBe("warn");
    await expect(check(join(dir, "README.md"), { format: "json", links: false, configPath: join(dir, "missing.json") })).rejects.toThrow(/Config not found/);
  });
  it("allowlist matches whole words only", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## SCIM Provisioning\n\n- x\n\n" + AGENTS, { "readmerlin.json": JSON.stringify({ headingAllowlist: ["CI"] }) });
    const r = await check(join(dir, "README.md"), { format: "json", links: false });
    expect(r.findings.some((f) => f.id === "prose/sentence-case")).toBe(true);
  });
});

describe("the shape", () => {
  const SHAPED = [
    HERO,
    QUICK,
    "## How it compares\n\n| | [owner/tidy](https://github.com/owner/tidy) | [other/claims](https://github.com/other/claims) |\n|---|---|---|\n| Installation | Skill | Script |\n| Calendar | ✅ | ❌ |\n",
    "## Security and limits\n\nIt needs no credential of its own and reads mail through your agent.\n\n- ❌ sends a receipt anywhere\n- ❌ keeps a copy\n",
    '## Badges\n\nClick a badge for its recipe.\n\n<table width="100%">\n<tr><th></th><th>All time</th></tr>\n<tr><td>Claims</td><td><a href="https://img.shields.io/badge/dynamic/json?url=https://example.com/c.json&query=$.n&label=claims&logo=github"><img alt="claims" src="https://img.shields.io/badge/dynamic/json?url=https://example.com/c.json&query=$.n&label=claims&logo=github"></a></td></tr>\n</table>\n',
  ].join("\n");
  it("passes clean, fails and warnings both", async () => {
    expect(await ids(repo(SHAPED))).toEqual([]);
  });
  it("fails a fence before Features, a shell snippet, a Yes cell, a Limits heading, a CI badge, a yml link and a raw badge URL", async () => {
    const bad = (SHAPED.replace("## Features", "```yaml\non: push\n```\n\n## Features")
      .replace("| Calendar | ✅ | ❌ |", "| Calendar | Yes | No |")
      .replace("- ❌ keeps a copy", "- See [the workflow](.github/workflows/ci.yml), run `curl -s https://example.com/x`, paste `https://img.shields.io/badge/a-b-c`.\n- ❌ keeps a copy")
      .replace('<a href="LICENSE">', '<a href="https://github.com/owner/tidy/actions"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/owner/tidy/ci.yml?logo=githubactions"></a><a href="LICENSE">')) + "\n## Limits\n\n- x\n";
    const f = await ids(repo(bad, { ".github/workflows/ci.yml": "on: push\n" }), "fail");
    for (const id of ["shape/prose-before-features", "shape/install-in-words", "honesty/comparison-marks", "shape/earned-headings", "badges/carry-facts", "links/reader-can-act", "badges/shown-as-badges"]) expect(f).toContain(id);
  });
  it("warns on a restated tagline, a bare feature bullet, a product that is not first, a markdown badge table and a security table", async () => {
    const bad = SHAPED.replace("Add the tidy skill", "Receipts go in and a claim comes out. Add the tidy skill")
      .replace("- 🧾 **Every receipt found.**", "- Every receipt found.")
      .replace("| | [owner/tidy](https://github.com/owner/tidy) | [other/claims](https://github.com/other/claims) |", "| | [other/claims](https://github.com/other/claims) | tidy |")
      .replace('<table width="100%">', "<table>")
      .replace("- ❌ keeps a copy", "- ✅ reads mail\n\n| Does | Never |\n|---|---|\n| a | b |");
    const w = await ids(repo(bad), "warn");
    for (const id of ["prose/says-it-once", "shape/feature-bullets", "honesty/comparison-product-first", "honesty/comparison-links", "shape/badges-table", "shape/security-checklist"]) expect(w).toContain(id);
  });
  it("fails a Quick start section and an agent section in the README, but not on the agent-block rule: that heading is only on the kill list now", async () => {
    const f = await check(join(repo(SHAPED + "\n## Quick start\n\n- Ask it.\n\n## For agents\n\n- Read SKILL.md first.\n"), "README.md"), { format: "json", links: false });
    const fails = f.findings.filter((x) => x.level === "fail").map((x) => `${x.id}: ${x.message}`);
    expect(fails).toEqual(['shape/earned-headings: Heading "Quick start" is on the kill list.', 'shape/earned-headings: Heading "For agents" is on the kill list.']);
  });
  it("tells a section written for agents from one merely about agents, when it sits in CONTRIBUTING", async () => {
    const titled = async (t: string) => (await ids(repo(SHAPED, { ".github/CONTRIBUTING.md": `# Contributing\n\n## ${t}\n\n- x\n` }), "fail")).includes("shape/agents-in-contributing");
    for (const t of ["For agents", "For AI agents", "Notes for LLMs", "Agent instructions", "AGENTS.md"]) expect(await titled(t), t).toBe(true);
    for (const t of ["Supported agents", "Agent skills", "What are agent skills?", "Skill not loading in agent", "Hermes Agent"]) expect(await titled(t), t).toBe(false);
  });
  it("no longer flags a README section merely titled for agents; that block now lives in AGENTS.md", async () => {
    expect(await ids(repo(SHAPED + "\n## For agents\n\n- x\n"), "fail")).not.toContain("shape/agents-in-contributing");
  });
  it("fails CONTRIBUTING that still carries a for-agents section, whatever its length", async () => {
    const dir = repo(SHAPED, { ".github/CONTRIBUTING.md": "# Contributing\n\n## For agents\n\n- one line\n" });
    const r = await check(join(dir, "README.md"), { format: "json", links: false });
    expect(r.findings.map((f) => f.id)).toEqual(["shape/agents-in-contributing"]);
    expect(r.findings[0].message).toMatch(/still carries a section written for agents/);
  });
  it("fails an AGENTS.md over forty lines, and passes CONTRIBUTING once the section moved out", async () => {
    const dir = repo(SHAPED, {
      ".github/CONTRIBUTING.md": "# Contributing\n\nSee AGENTS.md.\n",
      "AGENTS.md": "# AGENTS.md\n\n" + Array.from({ length: 45 }, (_, i) => `- step ${i}`).join("\n") + "\n",
    });
    const r = await check(join(dir, "README.md"), { format: "json", links: false });
    expect(r.findings.map((f) => f.id)).toEqual(["shape/agents-in-contributing"]);
    expect(r.findings[0].message).toContain("46 lines");
  });
  it("warns on a hand-written claim badge, and leaves facts, counts and hosts alone", async () => {
    const badge = (src: string) => HERO.replace('<a href="LICENSE">', `<a href="LICENSE"><img alt="x" src="${src}"></a><a href="LICENSE">`);
    const claims = async (src: string) => (await ids(repo(badge(src) + "\n" + QUICK), "warn")).includes("badges/claims-backed");
    expect(await claims("https://img.shields.io/badge/tests-passing-green?logo=github")).toBe(true);
    expect(await claims("https://img.shields.io/badge/privacy-local_only-blue?logo=github")).toBe(true);
    expect(await claims("https://img.shields.io/badge/python-3.11%2B-3776AB?logo=python")).toBe(false);
    expect(await claims("https://img.shields.io/badge/Claude%20Code-3f3f46?logo=anthropic")).toBe(false);
  });
  it("fails a hero that does not show what its spec names", async () => {
    const spec = JSON.stringify({ title: "t", sources: [{ label: "Inbox" }], handled: [{ label: "Rides" }], deliverable: { label: "one claim" } });
    const svg = (words: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 40"><title>t</title><style>text{font-family:system-ui}</style><text x="4" y="20" font-size="12" textLength="200">${words}</text></svg>`;
    const agrees = repo(SHAPED, { "assets/readme/hero.hero.json": spec, "assets/readme/hero.svg": svg("Inbox Rides one claim") });
    expect(await ids(agrees)).not.toContain("visuals/spec-agrees");
    const drifted = repo(SHAPED, { "assets/readme/hero.hero.json": spec, "assets/readme/hero.svg": svg("Inbox one claim") });
    const r = await check(join(drifted, "README.md"), { format: "json", links: false });
    expect(r.findings.find((f) => f.id === "visuals/spec-agrees")?.message).toContain("Rides");
  });
  it("measures a label with textLength and only guesses with a wide margin without it", async () => {
    const svg = (t: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><style>text{font-family:system-ui}</style>${t}</svg>`;
    const fits = repo(SHAPED, { "assets/readme/hero.svg": svg('<text x="4" y="20" font-size="12" textLength="90">A label the estimate would flag</text><text x="4" y="30" font-size="12">Fifteen letters</text>') });
    expect(await ids(fits)).not.toContain("visuals/svg-text-overflow");
    const over = repo(SHAPED, { "assets/readme/hero.svg": svg('<text x="4" y="20" font-size="12" textLength="120">Wide</text>') });
    expect(await ids(over)).toContain("visuals/svg-text-overflow");
  });
});

describe("format", () => {
  it("prints github annotations", async () => {
    const { format } = await import("../src/check/format.js");
    const out = format({ file: "README.md", findings: [{ id: "prose/plain-punctuation", level: "fail", message: "Em dash.", line: 3, repair: "Split it." }], fails: 1, warns: 0, ran: ["prose/plain-punctuation"] }, "github");
    expect(out).toContain("::error file=README.md,line=3,title=prose/plain-punctuation::Em dash. Repair: Split it.");
    expect(out).toContain("::notice::");
  });
});
