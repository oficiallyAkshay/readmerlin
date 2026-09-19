import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { check } from "../src/check/index.js";
import { format, formatResults } from "../src/check/format.js";
import { expandPages } from "../src/commands/check.js";

const SCRIPT = resolve(__dirname, "../skills/readmerlin/scripts/readmerlin.mjs");
const REPO_ROOT = resolve(__dirname, "..");

/** A synthetic repo: a real .git marker at its root, so gitRoot and expandPages find it, plus whatever files are given. */
function repo(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "rm-pages-"));
  mkdirSync(join(dir, ".git"));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  return dir;
}

const CLEAN_PAGE = "## Notes\n\nA plain sentence, joined with a comma.\n";

describe("formatResults", () => {
  it("keeps the single-file shape for one file, in every format", async () => {
    const dir = repo({ "a.md": CLEAN_PAGE });
    const r = await check(join(dir, "a.md"), { format: "json", links: false });
    expect(formatResults([r], "json")).toBe(format(r, "json"));
    expect(formatResults([r], "text")).toBe(format(r, "text"));
    expect(formatResults([r], "github")).toBe(format(r, "github"));
  });

  it("reports several files in turn, in text, github and json", async () => {
    const dir = repo({
      "a.md": "## Notes\n\nA dead link: [nope](missing.md).\n",
      "b.md": CLEAN_PAGE,
    });
    const ra = await check(join(dir, "a.md"), { format: "json", links: false });
    const rb = await check(join(dir, "b.md"), { format: "json", links: false });
    expect(ra.fails).toBeGreaterThan(0);
    expect(rb.fails).toBe(0);

    const text = formatResults([ra, rb], "text");
    expect(text).toContain(`${join(dir, "a.md")}: ${ra.fails} fails`);
    expect(text).toContain(`${join(dir, "b.md")}: ${rb.fails} fails`);

    const github = formatResults([ra, rb], "github");
    expect(github).toContain(`::notice::readmerlin ${join(dir, "a.md")}`);
    expect(github).toContain(`::notice::readmerlin ${join(dir, "b.md")}`);

    const json = JSON.parse(formatResults([ra, rb], "json"));
    expect(Array.isArray(json)).toBe(true);
    expect(json).toHaveLength(2);
    expect(json.map((r: { file: string }) => r.file)).toEqual([join(dir, "a.md"), join(dir, "b.md")]);
  });
});

describe("a page other than the README", () => {
  it("fails on a dead relative link in CONTRIBUTING", async () => {
    const dir = repo({ "CONTRIBUTING.md": "## Commands\n\nSee [the guide](docs/missing.md) for more.\n" });
    const r = await check(join(dir, "CONTRIBUTING.md"), { format: "json", links: false });
    expect(r.findings.map((f) => f.id)).toContain("links/relative");
    expect(r.fails).toBeGreaterThan(0);
  });

  it("fails on an em dash in a docs page", async () => {
    const dir = repo({ "docs/guide.md": "## Guide\n\nDo this — then that.\n" });
    const r = await check(join(dir, "docs/guide.md"), { format: "json", links: false });
    expect(r.findings.map((f) => f.id)).toContain("prose/plain-punctuation");
  });

  it("passes a docs page with a Quick start heading, since shape rules do not run on pages", async () => {
    const dir = repo({ "docs/guide.md": "## Quick start\n\nSay hello to the agent, in one plain sentence.\n" });
    const r = await check(join(dir, "docs/guide.md"), { format: "json", links: false });
    expect(r.findings.map((f) => f.id)).not.toContain("shape/earned-headings");
    expect(r.ran.some((id) => id.startsWith("shape/") || id.startsWith("hero/"))).toBe(false);
    expect(r.fails).toBe(0);
  });
});

describe("expandPages", () => {
  it("checks README.md and CONTRIBUTING.md when there is no docs folder", () => {
    const dir = repo({ "README.md": "# t\n", "CONTRIBUTING.md": "## Commands\n" });
    const { files, root } = expandPages(dir);
    expect(root).toBe(dir);
    expect(files).toEqual([join(dir, "README.md"), join(dir, "CONTRIBUTING.md")]);
  });

  it("prefers .github/CONTRIBUTING.md and adds every docs page", () => {
    const dir = repo({
      "README.md": "# t\n",
      "CONTRIBUTING.md": "## Root copy, not used\n",
      ".github/CONTRIBUTING.md": "## Commands\n",
      "docs/guide.md": "## Guide\n",
      "docs/nested/reference.md": "## Reference\n",
    });
    const { files } = expandPages(dir);
    expect(files).toEqual([join(dir, "README.md"), join(dir, ".github/CONTRIBUTING.md"), join(dir, "docs/guide.md"), join(dir, "docs/nested/reference.md")]);
  });
});

describe("the repo's own pages", () => {
  it("check --pages passes with 0 fails", () => {
    const out = execFileSync("node", [SCRIPT, "check", "--pages", "--no-links", "--no-exec", "--format", "json"], { cwd: REPO_ROOT, encoding: "utf8" });
    const results = JSON.parse(out) as Array<{ file: string; fails: number; warns: number }>;
    expect(results.length).toBeGreaterThanOrEqual(2);
    for (const r of results) expect(r.fails, `${r.file} has a fail`).toBe(0);
  });

  it("--pages lists every docs page, README and CONTRIBUTING", () => {
    const { files } = expandPages(REPO_ROOT);
    const rel = files.map((f) => f.slice(REPO_ROOT.length + 1));
    expect(rel).toContain("README.md");
    expect(rel).toContain(join(".github", "CONTRIBUTING.md"));
    const docsPages = [
      "README.md",
      "changelog.md",
      "examples.md",
      join("guides", "keep-it-true.md"),
      join("guides", "write-a-readme.md"),
      join("reference", "check.md"),
      join("reference", "context.md"),
      join("reference", "hero-spec.md"),
      join("reference", "init-workflow.md"),
      join("reference", "rule-ids.md"),
      join("reference", "rules.md"),
      join("reference", "settings.md"),
    ];
    for (const p of docsPages) expect(rel).toContain(join("docs", p));
    expect(rel).toHaveLength(2 + docsPages.length);
  });
});

describe("which README is the README", () => {
  it("is the one at the repo root or beside a manifest; a docs index named README.md is a page", async () => {
    const root = mkdtempSync(join(tmpdir(), "rm-kind-"));
    mkdirSync(join(root, ".git"));
    mkdirSync(join(root, "docs"));
    mkdirSync(join(root, "pkg"));
    writeFileSync(join(root, "docs/README.md"), "# Docs\n\nAn index.\n");
    writeFileSync(join(root, "pkg/package.json"), '{"name":"p"}');
    writeFileSync(join(root, "pkg/README.md"), "# p\n\nA package.\n");
    const page = await check(join(root, "docs/README.md"), { format: "json", links: false, exec: false });
    const readme = await check(join(root, "pkg/README.md"), { format: "json", links: false, exec: false });
    expect(page.ran.some((id) => id.startsWith("hero/"))).toBe(false);
    expect(readme.ran.some((id) => id.startsWith("hero/"))).toBe(true);
  });
});
