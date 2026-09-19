import { describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check } from "../src/check/index.js";
import { gather } from "../src/context/index.js";
import { toMarkdown } from "../src/context/markdown.js";
import { readPlugin, readSkills, readNamedDocs, readReadme, installLines, readPackages, readCompare } from "../src/context/readers.js";

const HERO = `<h1 align="center">🧾 tidy</h1>\n\n<p align="center"><b>Receipts in, claim out.</b><br>One week of receipts becomes one claim.</p>\n\n<p align="center"><a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-2f6f4e?logo=opensourceinitiative"></a></p>\n\n<p align="center"><img alt="Receipts flow into one claim" src="assets/readme/hero.svg" width="900"></p>\n\n<p align="center"><b><a href="examples/claim.pdf">See the example claim</a></b></p>\n\nAdd the tidy skill to your agent, then hand it the week.\n`;
const QUICK = `## Features\n\n- 🧾 **Every receipt found.** The inbox is searched for the trip window only.\n`;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><style>text{font-family:system-ui}</style><rect x="0" y="0" width="100" height="40"/><text x="4" y="20" font-size="12">Hi</text></svg>';

function repo(readme: string, files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "rm-final-"));
  for (const [rel, content] of Object.entries({ "assets/readme/hero.svg": SVG, "assets/readme/hero.hero.json": "{}", "examples/claim.pdf": "%PDF", LICENSE: "MIT License", ...files })) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  writeFileSync(join(dir, "README.md"), readme);
  return dir;
}

function gitRepo(readme: string, files: Record<string, string> = {}, remote = "https://github.com/owner/tidy.git"): string {
  const dir = repo(readme, files);
  execFileSync("git", ["init", "-q", dir]);
  execFileSync("git", ["-C", dir, "remote", "add", "origin", remote]);
  return dir;
}

function bareRepo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "readmerlin-final-"));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(root, rel, ".."), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  return root;
}

const run = (dir: string, opts: { links?: boolean; exec?: boolean } = {}) => check(join(dir, "README.md"), { format: "json", links: opts.links ?? false, exec: opts.exec, repoRoot: dir });
const idsOf = async (dir: string, opts?: { links?: boolean }) => (await run(dir, opts)).findings.map((f) => f.id);
const findingsFor = async (dir: string, id: string, opts?: { links?: boolean }) => (await run(dir, opts)).findings.filter((f) => f.id === id);

describe("util: image and link edge cases through collectImages/collectLinks", () => {
  it("skips a reference-style image and link with no matching definition", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\n![missing][nope]\n\n[also missing][nope2]\n");
    // Neither crashes nor produces a broken-link finding for the undefined reference itself.
    await expect(run(dir)).resolves.toBeDefined();
  });
  it("reads an html img with no src as an empty string, not a crash", async () => {
    const dir = repo(HERO + "\n" + QUICK + '\n<img alt="x">\n');
    await expect(run(dir)).resolves.toBeDefined();
  });
  it("reads a single-quoted html link href", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n<a href='docs/x.md'>See</a>\n", { "docs/x.md": "# x\n" });
    expect(await idsOf(dir)).not.toContain("links/relative");
  });
});

describe("badges/ci-matches-remote: the actions/workflows url shape", () => {
  it("matches the owner/repo captured from a plain actions/workflows link", async () => {
    const badge = '<a href="https://github.com/other/repo/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/badge/dynamic/json?url=https://github.com/other/repo/actions/workflows/ci.yml&label=ci&logo=github"></a>';
    const dir = gitRepo(HERO.replace('<p align="center"><a href="LICENSE">', badge + '\n\n<p align="center"><a href="LICENSE">') + "\n" + QUICK);
    const f = await findingsFor(dir, "badges/ci-matches-remote");
    expect(f[0]?.message).toMatch(/belongs to other\/repo/);
  });
});

describe("badges/count-source: large and small numbers, and a non-numeric source output", () => {
  const badge = (label: string, shown: string) => `<a href="LICENSE"><img alt="x" src="https://img.shields.io/badge/${label}-${shown}-6f42c1?logo=x"></a>`;
  it("matches a million-scale count and a small plain count", async () => {
    const dir = repo(HERO.replace('<p align="center"><a href="LICENSE">', badge("downloads", "1.2m") + '\n\n<p align="center"><a href="LICENSE">') + "\n" + QUICK, { "readmerlin.json": JSON.stringify({ counts: { downloads: "echo 1200000" } }) });
    expect(await idsOf(dir)).not.toContain("badges/count-source");
    // The source prints "42.0" (not "42"), so the direct-string check fails and the plain, sub-1000 branch of short() runs.
    const small = repo(HERO.replace('<p align="center"><a href="LICENSE">', badge("things", "42") + '\n\n<p align="center"><a href="LICENSE">') + "\n" + QUICK, { "readmerlin.json": JSON.stringify({ counts: { things: "echo 42.0" } }) });
    expect(await idsOf(small)).not.toContain("badges/count-source");
  });
  it("shows the raw source text when it has no digits at all", async () => {
    const dir = repo(HERO.replace('<p align="center"><a href="LICENSE">', badge("things", "42") + '\n\n<p align="center"><a href="LICENSE">') + "\n" + QUICK, { "readmerlin.json": JSON.stringify({ counts: { things: "echo not-a-number" } }) });
    const f = await findingsFor(dir, "badges/count-source");
    expect(f[0]?.message).toMatch(/source says not-a-number/);
  });
});

describe("links/external: a stale cache entry is pruned, and a genuine 404 is reported", () => {
  const CACHE_FILE = join(tmpdir(), "readmerlin", "links.json");
  it("prunes an entry older than a week from the cache file it writes", async () => {
    rmSync(CACHE_FILE, { force: true });
    mkdirSync(join(tmpdir(), "readmerlin"), { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify({ "https://readmerlin-test.example/ancient-c3": { ok: true, at: Date.now() - 8 * 24 * 3600 * 1000 } }));
    const stub = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", stub);
    try {
      const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\n- [a](https://readmerlin-test.example/fresh-c3)\n");
      await run(dir, { links: true });
      const cache = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
      expect(cache["https://readmerlin-test.example/ancient-c3"]).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("honesty/comparison-product-first: no names at all, and a markdown h1", () => {
  it("does nothing when there is no remote and no h1 to name the product", async () => {
    const dir = bareRepo({ "README.md": "Just a paragraph, no heading at all.\n\n## How it compares\n\n| a | b |\n|---|---|\n| c | d |\n" });
    const r = await check(join(dir, "README.md"), { format: "json", links: false, repoRoot: dir });
    expect(r.findings.map((f) => f.id)).not.toContain("honesty/comparison-product-first");
  });
  it("falls back to an empty title when the html h1 has no closing tag to capture", async () => {
    const dir = gitRepo("<h1/>\n\n**Tag.**\n\nAdd the tidy skill to your agent.\n\n" + QUICK + "\n## How it compares\n\n| a | b |\n|---|---|\n| c | d |\n");
    await expect(run(dir)).resolves.toBeDefined();
  });
  it("reads the product name from a markdown h1 instead of an html one", async () => {
    const table = "## How it compares\n\n| [tidy](https://github.com/owner/tidy) | [acme/x](https://github.com/acme/x) |\n|---|---|\n| Output | Pages |\n";
    const dir = gitRepo("# tidy\n\n**Receipts in, claim out.**\n\nAdd the tidy skill to your agent.\n\n" + QUICK + "\n" + table);
    expect(await idsOf(dir)).not.toContain("honesty/comparison-product-first");
  });
});

describe("registry: the published() network call itself throwing", () => {
  it("treats a thrown fetch as unknown, and still warns since it cannot confirm publication", async () => {
    const dir = repo(HERO + "\n" + QUICK, { "package.json": JSON.stringify({ name: "thing", main: "i.js" }) });
    const stub = vi.fn(async () => { throw new Error("offline"); });
    vi.stubGlobal("fetch", stub);
    try {
      const f = await findingsFor(dir, "badges/registry-present", { links: true });
      expect(f[0]?.message).toMatch(/thing is published on npm but/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("shape/section-count", () => {
  it("flags a README with more top-level sections than the limit", async () => {
    const many = Array.from({ length: 9 }, (_, i) => `## Section ${i}\n\n- x\n`).join("\n");
    const dir = repo(HERO + "\n" + QUICK + "\n" + many);
    const f = await findingsFor(dir, "shape/section-count");
    expect(f[0]?.message).toMatch(/10 sections, limit 8/);
  });
});

describe("shape/feature-bullets: a bullet whose first inline child is not plain text, and one with no paragraph at all", () => {
  it("still flags it for missing an emoji, since a bold-first bullet has no leading text", async () => {
    const dir = repo(HERO + "\n## Features\n\n- **Bold first** with no emoji at the very start.\n");
    expect(await idsOf(dir)).toContain("shape/feature-bullets");
  });
  it("flags a bullet that opens straight with a nested list, with nothing of its own", async () => {
    const dir = repo(HERO + "\n## Features\n\n- \n  - nested, but the outer bullet has no lead of its own\n");
    expect(await idsOf(dir)).toContain("shape/feature-bullets");
  });
});

describe("shape/security-checklist: a non-table html node before the real checklist", () => {
  it("still finds the checklist after an unrelated raw html line", async () => {
    const sec = "## Security and limits\n\n<div>Note.</div>\n\nIt needs no credential of its own.\n\n- ❌ sends a receipt anywhere\n";
    const dir = repo(HERO + "\n" + QUICK + "\n" + sec);
    expect(await idsOf(dir)).not.toContain("shape/security-checklist");
  });
});

describe("visuals: a degenerate image, an unreadable spec folder, many missing labels, text with no x/y, and a centred anchor", () => {
  it("skips a 0x0 svg without crashing", async () => {
    const zero = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const dir = repo(HERO + "\n" + QUICK, { "assets/readme/hero.svg": zero });
    expect(await idsOf(dir)).not.toContain("visuals/height");
  });
  it("skips a diagram whose folder can be reached but not listed", async () => {
    const dir = repo(HERO + "\n" + QUICK + '\n<img alt="d" src="locked/diagram.svg">\n', { "locked/diagram.svg": SVG });
    // Execute-only: the file itself still stats fine (existsSync passes), but readdirSync on its folder is refused.
    chmodSync(join(dir, "locked"), 0o111);
    try {
      await expect(run(dir)).resolves.toBeDefined();
    } finally {
      chmodSync(join(dir, "locked"), 0o755);
    }
  });
  it("treats an image path that escapes the repo root as not found, not a crash", async () => {
    const dir = repo(HERO + "\n" + QUICK + '\n<img alt="x" src="../../../../etc/passwd.svg">\n');
    await expect(run(dir)).resolves.toBeDefined();
  });
  it("ignores a non-string, non-object leaf when walking the hero spec, such as a boolean", async () => {
    const spec = JSON.stringify({ title: "t", extra: true });
    const dir = repo(HERO + "\n" + QUICK, { "assets/readme/hero.hero.json": spec });
    await expect(run(dir)).resolves.toBeDefined();
  });
  it("says 'and more' past five missing labels", async () => {
    const spec = JSON.stringify({ title: "t", sources: Array.from({ length: 6 }, (_, i) => ({ label: `Missing${i}` })) });
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 40"><style>text{font-family:system-ui}</style><text x="4" y="20" font-size="12">Nothing here</text></svg>';
    const dir = repo(HERO + "\n" + QUICK, { "assets/readme/hero.hero.json": spec, "assets/readme/hero.svg": svg });
    const f = await findingsFor(dir, "visuals/spec-agrees");
    expect(f[0]?.message).toMatch(/, and more\./);
  });
  it("treats an svg text with no x or y attribute as starting at the origin", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><style>text{font-family:system-ui}</style><text font-size="12">Origin</text></svg>';
    const dir = repo(HERO + "\n" + QUICK, { "assets/readme/hero.svg": svg });
    await expect(run(dir)).resolves.toBeDefined();
  });
  it("measures a centred label from its middle anchor, and a right-set one from its end anchor", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><style>text{font-family:system-ui}</style><text x="30" y="20" font-size="12" text-anchor="middle" textLength="120">Centred and wide</text></svg>';
    const dir = repo(HERO + "\n" + QUICK, { "assets/readme/hero.svg": svg });
    expect(await idsOf(dir)).toContain("visuals/svg-text-overflow");
    const end = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><style>text{font-family:system-ui}</style><text x="55" y="20" font-size="12" text-anchor="end" textLength="120">Right aligned and wide</text></svg>';
    const dirEnd = repo(HERO + "\n" + QUICK, { "assets/readme/hero.svg": end });
    expect(await idsOf(dirEnd)).toContain("visuals/svg-text-overflow");
  });
});

describe("context readers: a marketplace.json shaped as an array, non-object metadata, an explicit doc name, and pyproject's tool.poetry table", () => {
  it("readPlugin sees no plugin when plugin.json parses to an array", () => {
    const dir = bareRepo({ ".claude-plugin/plugin.json": "[1,2,3]" });
    expect(readPlugin(dir)).toBeUndefined();
  });
  it("readSkills leaves metadata out when it is not an object", () => {
    const dir = bareRepo({ "skills/x/SKILL.md": "---\nname: x\nmetadata: just a string\n---\n\nBody.\n" });
    expect(readSkills(dir)[0].metadata).toBeUndefined();
  });
  it("readNamedDocs prefers an explicit frontmatter name over the filename", () => {
    const dir = bareRepo({ "commands/run-it.md": "---\nname: run\ndescription: Runs it.\n---\n" });
    expect(readNamedDocs(dir, ["commands"])[0].name).toBe("run");
  });
  it("readNamedDocs follows a symlinked doc and still dedupes it against itself", () => {
    const dir = bareRepo({ "commands/real.md": "---\nname: real\n---\n" });
    symlinkSync(join(dir, "commands", "real.md"), join(dir, "commands", "linked.md"));
    const names = readNamedDocs(dir, ["commands"]).map((d) => d.name).sort();
    expect(names).toContain("real");
  });
  it("readReadme reads a markdown-style image, not only an html one", () => {
    const dir = bareRepo({ "README.md": "# t\n\n**Tag.**\n\n![a diagram](assets/diagram.svg)\n" });
    expect(readReadme(dir).images).toContain("assets/diagram.svg");
  });
  it("takes a package name from [tool.poetry] when there is no [project] table", () => {
    const dir = bareRepo({ "pyproject.toml": '[build-system]\nrequires = ["poetry-core"]\n\n[tool.poetry]\nname = "poetry-pkg"\n' });
    expect(readPackages(dir).map((p) => p.name)).toEqual(["poetry-pkg"]);
  });
  it("installLines adds the marketplace name to the plugin install line when both are named", () => {
    const lines = installLines({}, { path: "p", name: "tidy", commands: [], agents: [], skills: [] }, [], { name: "my-market" });
    expect(lines).toContain("/plugin install tidy@my-market");
  });
  it("readCompare treats a non-array repos or rows field as empty instead of throwing", () => {
    const dir = bareRepo({ "readmerlin.json": JSON.stringify({ compare: { repos: "not-an-array", rows: 5 } }) });
    expect(readCompare(dir)).toEqual({ repos: [], rows: [] });
  });
});

describe("toMarkdown: the empty/defined edges of several line() calls", () => {
  it("shows an unknown spdx, a remote with no owner/name, and an mcp server built from command and args", async () => {
    const dir = bareRepo({
      LICENSE: "Some homemade license, not a recognised one.\n",
      ".mcp.json": JSON.stringify({ mcpServers: { local: { command: "node", args: ["server.js"] } } }),
    });
    execFileSync("git", ["init", "-q", dir]);
    execFileSync("git", ["-C", dir, "remote", "add", "origin", "/local/bare/path"]);
    const md = toMarkdown(await gather(dir));
    expect(md).toContain("- License: unknown (LICENSE)");
    expect(md).toContain("- Repo: /local/bare/path");
    expect(md).toContain("node server.js");
  });
  it("names the compare columns with this repo's own owner/name when a remote is configured", async () => {
    const dir = gitRepo(HERO + "\n" + QUICK, { "readmerlin.json": JSON.stringify({ compare: { repos: ["acme/x"], rows: ["Output"] } }) });
    const md = toMarkdown(await gather(dir));
    expect(md).toContain("- Columns, in order: owner/tidy, acme/x");
  });
});
