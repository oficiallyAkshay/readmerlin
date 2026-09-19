import { describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check } from "../src/check/index.js";

const HERO = `<h1 align="center">🧾 tidy</h1>\n\n<p align="center"><b>Receipts in, claim out.</b><br>One week of receipts becomes one claim.</p>\n\n<p align="center"><a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-2f6f4e?logo=opensourceinitiative"></a></p>\n\n<p align="center"><img alt="Receipts flow into one claim" src="assets/readme/hero.svg" width="900"></p>\n\n<p align="center"><b><a href="examples/claim.pdf">See the example claim</a></b></p>\n\nAdd the tidy skill to your agent, then hand it the week.\n`;
const QUICK = `## Features\n\n- 🧾 **Every receipt found.** The inbox is searched for the trip window only.\n`;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><style>text{font-family:system-ui}</style><rect x="0" y="0" width="100" height="40"/><text x="4" y="20" font-size="12">Hi</text></svg>';

function repo(readme: string, files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "rm-more2-"));
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

const run = (dir: string, opts: { links?: boolean; exec?: boolean } = {}) => check(join(dir, "README.md"), { format: "json", links: opts.links ?? false, exec: opts.exec, repoRoot: dir });
const idsOf = async (dir: string, opts?: { links?: boolean }) => (await run(dir, opts)).findings.map((f) => f.id);
const findingsFor = async (dir: string, id: string) => (await run(dir)).findings.filter((f) => f.id === id);

describe("honesty/comparison-links spec, product-first and comparison-marks", () => {
  it("checks the columns of a comparison table against the spec, once this repo names itself first", async () => {
    const table = "## How it compares\n\n| | [owner/tidy](https://github.com/owner/tidy) | [acme/x](https://github.com/acme/x) |\n|---|---|---|\n| Output | Pages | Pages |\n";
    const good = gitRepo(HERO + "\n" + QUICK + "\n" + table, { "readmerlin.json": JSON.stringify({ compare: { repos: ["acme/x"] } }) });
    expect(await idsOf(good)).not.toContain("honesty/comparison-links");
    const bad = gitRepo(HERO + "\n" + QUICK + "\n" + table, { "readmerlin.json": JSON.stringify({ compare: { repos: ["other/y"] } }) });
    const msgs = (await findingsFor(bad, "honesty/comparison-links")).map((f) => f.message);
    expect(msgs.some((m) => /the spec says owner\/tidy, other\/y/.test(m))).toBe(true);
  });
  it("passes the product first by its repo name in the link, by plain text alone, and skips a table with no header columns at all", async () => {
    const table = (first: string) => `## How it compares\n\n| ${first} | [acme/x](https://github.com/acme/x) |\n|---|---|\n| Output | Pages |\n`;
    const linked = gitRepo(HERO + "\n" + QUICK + "\n" + table("[owner/tidy](https://github.com/owner/tidy)"));
    expect(await idsOf(linked)).not.toContain("honesty/comparison-product-first");
    const plainText = gitRepo(HERO + "\n" + QUICK + "\n" + table("tidy"));
    expect(await idsOf(plainText)).not.toContain("honesty/comparison-product-first");
    // A table with a single, blank header column has nothing comparisonProductFirst can call "the first column".
    const blankHeader = gitRepo(HERO + "\n" + QUICK + "\n## How it compares\n\n| |\n|---|\n| Output |\n");
    expect(await idsOf(blankHeader)).not.toContain("honesty/comparison-product-first");
  });
  it("flags a raw Yes/No cell written as html inside a comparison section", async () => {
    const dir = repo(HERO + "\n" + QUICK + '\n## How it compares\n\n<table><tr><td>Calendar</td><td>Yes</td></tr></table>\n');
    expect(await idsOf(dir)).toContain("honesty/comparison-marks");
  });
});

describe("privacy/hosts-through-badges", () => {
  it("flags a line that points the reader at per-host install paths", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\nInstall paths differ by host; see below.\n");
    expect(await idsOf(dir)).toContain("privacy/hosts-through-badges");
  });
});

describe("prose/says-it-once with no sections", () => {
  it("still compares the hero's own body paragraph against the tagline when there is no first section", async () => {
    const dir = repo("# t\n\n**Receipts in, claim out.**\n\nReceipts in, claim out, every week.\n");
    expect(await idsOf(dir)).toContain("prose/says-it-once");
  });
});

describe("prose/paragraph-length and prose/unhedged", () => {
  it("flags a paragraph with more sentences than the limit", async () => {
    const long = "One. Two. Three. Four. Five.";
    const dir = repo(HERO + "\n" + QUICK + `\n## Notes\n\n${long}\n`);
    const f = await findingsFor(dir, "prose/paragraph-length");
    expect(f[0]?.message).toMatch(/5 sentences, limit 4/);
  });
  it("flags a configured disclaimer phrase", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\nThis example is fully synthetic.\n");
    const f = await findingsFor(dir, "prose/unhedged");
    expect(f[0]?.message).toMatch(/fully synthetic/);
  });
});

describe("registry: pypi, crates and gems, and an unbadged registry", () => {
  it("warns for a pypi, a crates and a gems package with no badge, asking the registry when links are on", async () => {
    const dir = repo(HERO + "\n" + QUICK, {
      "pyproject.toml": '[build-system]\nrequires = ["hatchling"]\n[project]\nname = "thing-py"\n',
      "Cargo.toml": '[package]\nname = "thing-rs"\nversion = "0.1.0"\n',
      "thing.gemspec": 'Gem::Specification.new do |s|\n  s.name = "thing-rb"\nend\n',
    });
    const stub = vi.fn(async (url: string) => {
      if (url.includes("pypi.org")) return new Response("{}", { status: 404 });
      if (url.includes("crates.io")) return new Response("{}", { status: 200 });
      if (url.includes("rubygems.org")) return new Response("{}", { status: 500 });
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", stub);
    try {
      const r = await run(dir, { links: true });
      const msgs = r.findings.filter((f) => f.id === "badges/registry-present").map((f) => f.message);
      // pypi answers 404 (not published), so it is skipped entirely.
      expect(msgs.some((m) => /thing-py/.test(m))).toBe(false);
      expect(msgs.some((m) => /thing-rs is published on crates but/.test(m))).toBe(true);
      expect(msgs.some((m) => /thing-rb is published on gems but/.test(m))).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("names only the missing badge kind when the other one is already there", async () => {
    const version = '<a href="LICENSE"><img alt="v" src="https://img.shields.io/npm/v/thing?logo=npm"></a>';
    const dir = repo(HERO.replace('<p align="center"><a href="LICENSE">', version + '\n\n<p align="center"><a href="LICENSE">') + "\n" + QUICK, { "package.json": JSON.stringify({ name: "thing", main: "i.js" }) });
    const f = await findingsFor(dir, "badges/registry-present");
    expect(f[0]?.message).toMatch(/carries no downloads badge for it/);
  });
  it("names both badge kinds missing when neither is there", async () => {
    const dir = repo(HERO + "\n" + QUICK, { "package.json": JSON.stringify({ name: "thing", main: "i.js" }) });
    const f = await findingsFor(dir, "badges/registry-present");
    expect(f[0]?.message).toMatch(/carries no version or downloads badge for it/);
  });
  it("names an unrecognised works-with host and stays quiet once its badge is present", async () => {
    const dir = repo(HERO + "\n" + QUICK, { "readmerlin.json": JSON.stringify({ worksWith: ["Cursor"] }) });
    const f = await findingsFor(dir, "badges/registry-present");
    expect(f.some((x) => /No works-with badge for Cursor/.test(x.message))).toBe(true);
  });
});
