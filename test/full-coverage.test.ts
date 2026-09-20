import { describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check } from "../src/check/index.js";
import { loadConfig } from "../src/check/config.js";
import { parseDoc } from "../src/check/doc.js";
import { collectImages } from "../src/check/util.js";
import { format } from "../src/check/format.js";
import { runCheck } from "../src/commands/check.js";
import { gather } from "../src/context/index.js";
import { toMarkdown } from "../src/context/markdown.js";

const HERO = `<h1 align="center">🧾 tidy</h1>\n\n<p align="center"><b>Receipts in, claim out.</b><br>One week of receipts becomes one claim.</p>\n\n<p align="center"><a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-2f6f4e?logo=opensourceinitiative"></a></p>\n\n<p align="center"><img alt="Receipts flow into one claim" src="assets/readme/hero.svg" width="900"></p>\n\n<p align="center"><b><a href="examples/claim.pdf">See the example claim</a></b></p>\n\nAdd the tidy skill to your agent, then hand it the week.\n`;
const QUICK = `## Features\n\n- 🧾 **Every receipt found.** The inbox is searched for the trip window only.\n`;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><style>text{font-family:system-ui}</style><rect x="0" y="0" width="100" height="40"/><text x="4" y="20" font-size="12">Hi</text></svg>';

function repo(readme: string, files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "rm-full-"));
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
const findingsFor = async (dir: string, id: string, opts?: { links?: boolean }) => (await run(dir, opts)).findings.filter((f) => f.id === id);

describe("config: JSON.parse throwing something other than an Error", () => {
  it("falls back to String(e) in the thrown message", () => {
    const dir = mkdtempSync(join(tmpdir(), "rm-cfg-"));
    writeFileSync(join(dir, "readmerlin.json"), "{}");
    // JSON.parse itself only ever throws a real SyntaxError; this stands in for something else
    // (a monkey-patched JSON, a runtime that throws a plain value) throwing through the same catch.
    const spy = vi.spyOn(JSON, "parse").mockImplementationOnce(() => {
      throw "boom, not an Error instance";
    });
    try {
      expect(() => loadConfig(undefined, dir)).toThrow(/Config is not valid JSON: .*\(boom, not an Error instance\)/);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("util: a markdown image with no alt text", () => {
  it("collects it with alt as an empty string", () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\n![](assets/readme/plain.png)\n", { "assets/readme/plain.png": "x" });
    const doc = parseDoc(join(dir, "README.md"), dir);
    const img = collectImages(doc).find((i) => i.src === "assets/readme/plain.png");
    expect(img?.alt).toBe("");
  });
});

describe("format: two findings, neither carrying a line number", () => {
  it("sorts them without throwing, both landing as line -", () => {
    const r = { file: "x.md", findings: [
      { id: "a/b", level: "warn" as const, message: "one" },
      { id: "c/d", level: "warn" as const, message: "two" },
    ], fails: 0, warns: 2, ran: ["a/b", "c/d"] };
    const text = format(r, "text");
    expect(text).toContain("  -\twarn\tone  [a/b]\n");
    expect(text).toContain("  -\twarn\ttwo  [c/d]\n");
  });
});

describe("links/external: a protocol-relative href", () => {
  const CACHE_FILE = join(tmpdir(), "readmerlin", "links.json");
  it("is probed and reported as https, the same as a normal external link", async () => {
    rmSync(CACHE_FILE, { force: true });
    const stub = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", stub);
    try {
      const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\n- [a](//readmerlin-test.example/proto-rel-f6)\n");
      const findings = await findingsFor(dir, "links/external", { links: true });
      expect(findings.some((f) => f.message.includes("https://readmerlin-test.example/proto-rel-f6"))).toBe(true);
    } finally {
      vi.unstubAllGlobals();
      rmSync(CACHE_FILE, { force: true });
    }
  });
});

describe("honesty/comparison-marks: an html comparison cell that is not yes/no", () => {
  it("does not flag it, only a cell that says yes or no", async () => {
    const dir = gitRepo(HERO + "\n" + QUICK + "\n## How it compares\n\n<table><tr><td>Calendar</td><td>Partial</td></tr></table>\n");
    expect(await idsOf(dir)).not.toContain("honesty/comparison-marks");
  });
});

describe("compare spec: rows that already match", () => {
  it("says nothing about rows when the table's rows already match readmerlin.json", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rm-cmp-"));
    writeFileSync(join(dir, "readmerlin.json"), JSON.stringify({ compare: { rows: ["Output"] } }));
    const f = join(dir, "README.md");
    writeFileSync(f, `# t\n\n**b**\n\nc\n\n## How it compares\n\n| | [acme/other](https://github.com/acme/other) |\n| --- | --- |\n| Output | Pages |\n`);
    const msgs = (await check(f, { format: "json", links: false, repoRoot: dir })).findings.filter((x) => x.id === "honesty/comparison-links").map((x) => x.message);
    expect(msgs.some((m) => /rows are/.test(m))).toBe(false);
  });
});

describe("badges/registry-present: the quiet and partial paths", () => {
  const versionBadge = '<img alt="npm version" src="https://img.shields.io/npm/v/thing?logo=npm">';
  const downloadsBadge = '<img alt="npm downloads" src="https://img.shields.io/npm/dw/thing?logo=npm">';

  it("says nothing when a published package already carries both its badges", async () => {
    const dir = repo(
      HERO.replace('<p align="center"><a href="LICENSE">', `<p align="center">${versionBadge} ${downloadsBadge}</p>\n\n<p align="center"><a href="LICENSE">`) + "\n" + QUICK,
      { "package.json": JSON.stringify({ name: "thing", main: "i.js" }) },
    );
    expect(await idsOf(dir)).not.toContain("badges/registry-present");
  });

  it("names only the missing badge when one of the two is already there", async () => {
    const dir = repo(
      HERO.replace('<p align="center"><a href="LICENSE">', `<p align="center">${downloadsBadge}</p>\n\n<p align="center"><a href="LICENSE">`) + "\n" + QUICK,
      { "package.json": JSON.stringify({ name: "thing", main: "i.js" }) },
    );
    const f = await findingsFor(dir, "badges/registry-present");
    expect(f[0]?.message).toMatch(/carries no version badge for it\./);
    expect(f[0]?.message).not.toMatch(/version or downloads/);
  });

  it("says nothing for a works-with host that already has its badge", async () => {
    const worksWithBadge = '<img alt="Cursor" src="https://img.shields.io/badge/Cursor-1e1b4b?logo=cursor&logoColor=white">';
    const dir = repo(
      HERO.replace('<p align="center"><a href="LICENSE">', `<p align="center">${worksWithBadge}</p>\n\n<p align="center"><a href="LICENSE">`) + "\n" + QUICK,
      { "readmerlin.json": JSON.stringify({ worksWith: ["Cursor"] }) },
    );
    const findings = await findingsFor(dir, "badges/registry-present");
    expect(findings.some((f) => /works-with badge for Cursor/.test(f.message))).toBe(false);
  });
});

describe("visuals/svg-clipping: a self-closing <g/> ahead of a rect", () => {
  it("still measures the following rect, and flags it as clipped", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><style>text{font-family:system-ui}</style><g/><rect x="90" y="0" width="20" height="10"/></svg>';
    const dir = repo(HERO + "\n" + QUICK, { "assets/readme/hero.svg": svg });
    expect(await idsOf(dir)).toContain("visuals/svg-clipping");
  });
});

describe("runCheck: an update notice the network says is newer", () => {
  it("prints the notice line under the report", async () => {
    const dir = repo(HERO + "\n" + QUICK);
    mkdirSync(join(dir, ".git"));
    const chunks: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((s: unknown) => {
      chunks.push(String(s));
      return true;
    });
    const cwd = process.cwd();
    process.chdir(dir);
    const noticeCache = join(tmpdir(), "readmerlin", "latest.json");
    rmSync(noticeCache, { force: true });
    const fetchStub = vi.fn(async () => new Response(JSON.stringify({ version: "99.9.9" })));
    vi.stubGlobal("fetch", fetchStub);
    try {
      await runCheck(["README.md"], { format: "text", links: true });
      expect(chunks.join("")).toMatch(/readmerlin 99\.9\.9 is out/);
    } finally {
      process.chdir(cwd);
      vi.unstubAllGlobals();
      spy.mockRestore();
      rmSync(noticeCache, { force: true });
    }
  });
});

describe("toMarkdown: a command with no name, and an mcp server with no args", () => {
  it("prints an empty label for the nameless command", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rm-md-"));
    writeFileSync(join(dir, "README.md"), "# t\n");
    const base = await gather(dir);
    const md = toMarkdown({ ...base, commands: [{ path: "commands/x.md", description: "does a thing" }] });
    expect(md).toContain("- : does a thing\n");
  });

  it("joins just the command when a server declares no args at all", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rm-md2-"));
    writeFileSync(join(dir, "README.md"), "# t\n");
    const base = await gather(dir);
    const md = toMarkdown({ ...base, mcp: [{ path: ".mcp.json", servers: [{ name: "svc", command: "npx" }] }] });
    expect(md).toContain("- svc (.mcp.json): npx\n");
  });
});
