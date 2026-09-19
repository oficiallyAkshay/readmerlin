import { describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check } from "../src/check/index.js";
import { probe } from "../src/check/rules/links.js";

const HERO = `<h1 align="center">🧾 tidy</h1>\n\n<p align="center"><b>Receipts in, claim out.</b><br>One week of receipts becomes one claim.</p>\n\n<p align="center"><a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-2f6f4e?logo=opensourceinitiative"></a></p>\n\n<p align="center"><img alt="Receipts flow into one claim" src="assets/readme/hero.svg" width="900"></p>\n\n<p align="center"><b><a href="examples/claim.pdf">See the example claim</a></b></p>\n\nAdd the tidy skill to your agent, then hand it the week.\n`;
const QUICK = `## Features\n\n- 🧾 **Every receipt found.** The inbox is searched for the trip window only.\n`;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><style>text{font-family:system-ui}</style><rect x="0" y="0" width="100" height="40"/><text x="4" y="20" font-size="12">Hi</text></svg>';

function repo(readme: string, files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "rm-more-"));
  for (const [rel, content] of Object.entries({ "assets/readme/hero.svg": SVG, "assets/readme/hero.hero.json": "{}", "examples/claim.pdf": "%PDF", LICENSE: "MIT License", ...files })) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  writeFileSync(join(dir, "README.md"), readme);
  return dir;
}

/** A repo with a real git remote, so remoteOf(dir) resolves an owner and a name. */
function gitRepo(readme: string, files: Record<string, string> = {}, remote = "https://github.com/owner/tidy.git"): string {
  const dir = repo(readme, files);
  execFileSync("git", ["init", "-q", dir]);
  execFileSync("git", ["-C", dir, "remote", "add", "origin", remote]);
  return dir;
}

const run = (dir: string, opts: { links?: boolean; exec?: boolean } = {}) => check(join(dir, "README.md"), { format: "json", links: opts.links ?? false, exec: opts.exec, repoRoot: dir });
const idsOf = async (dir: string, opts?: { links?: boolean }) => (await run(dir, opts)).findings.map((f) => f.id);
const findingsFor = async (dir: string, id: string, opts?: { links?: boolean }) => (await run(dir, opts)).findings.filter((f) => f.id === id);

describe("badges/linked and badges/logo-present", () => {
  it("flags a badge that is not wrapped in a link, and a shields badge with no logo", async () => {
    const dir = repo(HERO.replace('<p align="center"><a href="LICENSE">', '<img alt="build" src="https://img.shields.io/badge/build-passing-4c1">\n\n<p align="center"><a href="LICENSE">') + "\n" + QUICK);
    const ids = await idsOf(dir);
    expect(ids).toContain("badges/linked");
    expect(ids).toContain("badges/logo-present");
  });
});

describe("badges/logo-renders", () => {
  it("fetches a shields logo svg once per url, and flags one whose logo does not render", async () => {
    let calls = 0;
    const stub = vi.fn(async (url: string) => {
      calls++;
      if (url.includes("logo=bogus")) return new Response('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
      return new Response('<svg xmlns="http://www.w3.org/2000/svg"><image href="x"/></svg>');
    });
    vi.stubGlobal("fetch", stub);
    try {
      const src = (logo: string) => `https://img.shields.io/badge/license-MIT-blue?logo=${logo}`;
      const dir = repo(
        HERO.replace('<p align="center"><a href="LICENSE">', `<a href="LICENSE"><img alt="a" src="${src("bogus")}"></a><a href="LICENSE"><img alt="b" src="${src("opensourceinitiative")}"></a><a href="LICENSE"><img alt="c" src="${src("bogus")}"></a><a href="LICENSE">`) + "\n" + QUICK,
      );
      const r = await run(dir, { links: true });
      const findings = r.findings.filter((f) => f.id === "badges/logo-renders");
      expect(findings.length).toBe(2);
      // Three distinct urls in the doc (the hero's own license badge, plus b and the bogus one),
      // but the bogus one appears twice and the cache means only one network call for it.
      expect(calls).toBe(3);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("does nothing when links are off", async () => {
    const dir = repo(HERO.replace('<p align="center"><a href="LICENSE">', '<a href="LICENSE"><img alt="a" src="https://img.shields.io/badge/license-MIT-blue?logo=bogus"></a><a href="LICENSE">') + "\n" + QUICK);
    expect(await idsOf(dir, { links: false })).not.toContain("badges/logo-renders");
  });
  it("skips a badge whose svg cannot be fetched at all, whether shields answers with an error or the network fails", async () => {
    const stub = vi.fn(async (url: string) => {
      if (url.includes("logo=notfound")) return new Response(null, { status: 404 });
      throw new Error("offline");
    });
    vi.stubGlobal("fetch", stub);
    try {
      const dir = repo(
        HERO.replace('<p align="center"><a href="LICENSE">', '<a href="LICENSE"><img alt="a" src="https://img.shields.io/badge/x-y-blue?logo=notfound"></a><a href="LICENSE"><img alt="b" src="https://img.shields.io/badge/x-y-blue?logo=offline"></a><a href="LICENSE">') + "\n" + QUICK,
      );
      expect(await idsOf(dir, { links: true })).not.toContain("badges/logo-renders");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("badges/ci-matches-remote", () => {
  it("flags a CI badge that belongs to a different repo, and passes one that matches", async () => {
    const badge = (owner: string, name: string) => `<a href="https://github.com/${owner}/${name}/actions"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/${owner}/${name}/ci.yml?logo=githubactions"></a>`;
    const wrong = gitRepo(HERO.replace('<p align="center"><a href="LICENSE">', badge("other", "repo") + '\n\n<p align="center"><a href="LICENSE">') + "\n" + QUICK);
    const wrongFindings = await findingsFor(wrong, "badges/ci-matches-remote");
    expect(wrongFindings[0]?.message).toMatch(/belongs to other\/repo, this repo is owner\/tidy/);
    const right = gitRepo(HERO.replace('<p align="center"><a href="LICENSE">', badge("owner", "tidy") + '\n\n<p align="center"><a href="LICENSE">') + "\n" + QUICK);
    expect(await idsOf(right)).not.toContain("badges/ci-matches-remote");
  });
});

describe("badges/count-source", () => {
  it("skips a fact-shaped label such as a language version", async () => {
    const dir = repo(HERO.replace('<p align="center"><a href="LICENSE">', '<a href="LICENSE"><img alt="node" src="https://img.shields.io/badge/node-20-339933?logo=nodedotjs"></a><a href="LICENSE">') + "\n" + QUICK);
    expect(await idsOf(dir)).not.toContain("badges/count-source");
  });
  it("names a missing source command, and reports when the source command itself fails", async () => {
    const badge = (label: string) => `<a href="LICENSE"><img alt="x" src="https://img.shields.io/badge/${label}-5-6f42c1?logo=x"></a>`;
    const missing = repo(HERO.replace('<p align="center"><a href="LICENSE">', badge("vendors") + '\n\n<p align="center"><a href="LICENSE">') + "\n" + QUICK);
    const missingFindings = await findingsFor(missing, "badges/count-source");
    expect(missingFindings[0]?.message).toMatch(/has no source command/);
    const failing = repo(HERO.replace('<p align="center"><a href="LICENSE">', badge("vendors") + '\n\n<p align="center"><a href="LICENSE">') + "\n" + QUICK, { "readmerlin.json": JSON.stringify({ counts: { vendors: "exit 1" } }) });
    const failFindings = await findingsFor(failing, "badges/count-source", { links: false });
    // exec defaults to true, so the failing command actually runs.
    expect(failFindings[0]?.message).toMatch(/Source command for "vendors" failed\./);
  });
});

describe("badges/shown-as-badges", () => {
  it("flags a raw badge url shown as a markdown link, and one inside raw html", async () => {
    const raw = "https://img.shields.io/badge/a-b-c";
    const asLink = repo(HERO + "\n" + QUICK + `\n[${raw}](${raw})\n`);
    expect(await idsOf(asLink)).toContain("badges/shown-as-badges");
    const asHtml = repo(HERO + "\n" + QUICK + `\n<p>${raw}</p>\n`);
    expect(await idsOf(asHtml)).toContain("badges/shown-as-badges");
  });
});

describe("probe", () => {
  it("returns the HEAD status directly when it succeeds", async () => {
    const fetchFn = (async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
    expect(await probe(fetchFn, "https://example.com")).toBe(200);
  });
  it("falls back to GET when HEAD is refused, and returns its status", async () => {
    const fetchFn = (async (_u: string, init?: { method?: string }) => (init?.method === "HEAD" ? new Response(null, { status: 405 }) : new Response("ok", { status: 200 }))) as unknown as typeof fetch;
    expect(await probe(fetchFn, "https://example.com")).toBe(200);
  });
  it("returns 0 after two network errors", async () => {
    const fetchFn = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect(await probe(fetchFn, "https://example.com", 100)).toBe(0);
  });
});

describe("links/external", () => {
  const CACHE_FILE = join(tmpdir(), "readmerlin", "links.json");
  const clearCache = () => rmSync(CACHE_FILE, { force: true });

  it("flags a link that answers with an error status, and one that never answers", async () => {
    clearCache();
    const stub = vi.fn(async (url: string) => {
      if (url.includes("dead")) return new Response(null, { status: 404 });
      if (url.includes("unreachable")) throw new Error("offline");
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", stub);
    try {
      const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\n- [dead](https://readmerlin-test.example/dead-link-a1) [unreachable](https://readmerlin-test.example/unreachable-link-a1) [ok](https://readmerlin-test.example/ok-link-a1)\n");
      const r = await run(dir, { links: true });
      const findings = r.findings.filter((f) => f.id === "links/external");
      const byUrl = Object.fromEntries(findings.map((f) => [f.message, true]));
      expect(Object.keys(byUrl).some((m) => /answers 404: .*dead-link-a1/.test(m))).toBe(true);
      expect(Object.keys(byUrl).some((m) => /answers with a network error: .*unreachable-link-a1/.test(m))).toBe(true);
      expect(findings.some((f) => /ok-link-a1/.test(f.message))).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("does nothing when links are off, or when the document has no external link", async () => {
    clearCache();
    const dir = repo(HERO + "\n" + QUICK);
    expect(await idsOf(dir, { links: true })).not.toContain("links/external");
  });
  it("reuses a cached answer instead of asking again the same day", async () => {
    clearCache();
    let calls = 0;
    const stub = vi.fn(async () => { calls++; return new Response(null, { status: 200 }); });
    vi.stubGlobal("fetch", stub);
    try {
      const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\n- [a](https://readmerlin-test.example/cache-check-b2)\n");
      await run(dir, { links: true });
      await run(dir, { links: true });
      expect(calls).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
