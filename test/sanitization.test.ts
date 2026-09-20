import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check } from "../src/check/index.js";
import { parseDoc } from "../src/check/doc.js";
import { collectLinks, slug } from "../src/check/util.js";
import { readReadme } from "../src/context/readers.js";
import { stabilize } from "../src/text.js";

// Regression tests for the 13 js/incomplete-multi-character-sanitization CodeQL alerts (every
// regex-based HTML/markup strip in the repo now runs through stabilize(), which loops a
// removal to a fixed point instead of trusting a single pass), the js/incomplete-sanitization
// alert on the npm registry URL builder, and the 3 js/incomplete-url-substring-sanitization
// alerts in test/rules-more2.test.ts.

const HERO = `<h1 align="center">🧾 tidy</h1>\n\n<p align="center"><b>Receipts in, claim out.</b><br>One week of receipts becomes one claim.</p>\n\n<p align="center"><a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-2f6f4e?logo=opensourceinitiative"></a></p>\n\n<p align="center"><img alt="Receipts flow into one claim" src="assets/readme/hero.svg" width="900"></p>\n\n<p align="center"><b><a href="examples/claim.pdf">See the example claim</a></b></p>\n\nAdd the tidy skill to your agent, then hand it the week.\n`;
const QUICK = `## Features\n\n- 🧾 **Every receipt found.** The inbox is searched for the trip window only.\n`;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><style>text{font-family:system-ui}</style><rect x="0" y="0" width="100" height="40"/><text x="4" y="20" font-size="12">Hi</text></svg>';

function repo(readme: string, files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "rm-san-"));
  for (const [rel, content] of Object.entries({ "assets/readme/hero.svg": SVG, "assets/readme/hero.hero.json": "{}", "examples/claim.pdf": "%PDF", LICENSE: "MIT License", ...files })) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  writeFileSync(join(dir, "README.md"), readme);
  return dir;
}

function plainRepo(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "rm-san-plain-"));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  return dir;
}

const run = (dir: string, opts: { links?: boolean } = {}) => check(join(dir, "README.md"), { format: "json", links: opts.links ?? false });
const idsOf = async (dir: string, opts?: { links?: boolean }) => (await run(dir, opts)).findings.map((f) => f.id);
const findingsFor = async (dir: string, id: string, opts?: { links?: boolean }) => (await run(dir, opts)).findings.filter((f) => f.id === id);

describe("text: stabilize", () => {
  it("removes a match that a single replace pass leaves reformed by the characters it splices together", () => {
    // The textbook incomplete-sanitization witness: one pass over "aabb" deletes only the
    // middle "ab", leaving the outer "a" and "b" newly adjacent -- reforming "ab". A single
    // `.replace()` call, run once, cannot see that: it has to run again to catch it.
    expect(stabilize("aabb", /ab/g, "")).toBe("");
  });
  it("returns the input unchanged when nothing in it ever matches", () => {
    expect(stabilize("plain text", /<[^>]+>/g, "")).toBe("plain text");
  });
});

describe("context/readers.ts readReadme: title strips nested HTML down to plain text", () => {
  it("leaves no stray angle bracket in the title when the h1 holds a doubled-open tag", () => {
    const dir = plainRepo({ "README.md": "<h1><<script>Evil</script>Name</h1>\n\nBody text.\n" });
    const info = readReadme(dir);
    expect(info.title).toBe("EvilName");
    expect(info.title).not.toMatch(/[<>]/);
  });
});

describe("check/util.ts collectLinks: html <a> text and image-only detection strip nested tags fully", () => {
  it("reduces an html link's visible text to plain words through a nested tag", () => {
    const dir = plainRepo({ "README.md": '# t\n\n<a href="x.md"><<b>See</b> more</a>\n' });
    const doc = parseDoc(join(dir, "README.md"));
    const links = collectLinks(doc);
    expect(links[0].text).toBe("See more");
    expect(links[0].text).not.toMatch(/[<>]/);
  });
  it("recognizes an html link as image-only once its nested-tag content collapses to nothing", () => {
    const dir = plainRepo({ "README.md": '# t\n\n<a href="x.svg"><<img src="a.svg"></a>\n' });
    const doc = parseDoc(join(dir, "README.md"));
    const links = collectLinks(doc, true);
    expect(links[0].imageOnly).toBe(true);
  });
});

describe("check/util.ts slug: anchor slugs strip nested HTML from a heading", () => {
  it("produces a clean hyphenated slug when the heading text has a doubled-open tag", () => {
    expect(slug("<<b>Get</b> Started")).toBe("get-started");
  });
});

describe("visuals/spec-agrees (visuals.ts:136): hero SVG label matching ignores <style> body text", () => {
  it("still reports a spec label missing when it only appears inside the SVG's own <style> rule", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><style>.Fast{fill:red}</style><rect width="10" height="10"/></svg>';
    const dir = repo(HERO + "\n" + QUICK, { "assets/readme/hero.svg": svg, "assets/readme/hero.hero.json": JSON.stringify({ title: "Fast" }) });
    const f = await findingsFor(dir, "visuals/spec-agrees");
    expect(f[0]?.message).toMatch(/does not show what its spec names: Fast/);
  });
});

describe("visuals/svg-text-overflow (visuals.ts:175): svg <text> content strips a nested tag before its length is measured", () => {
  it("does not flag overflow once a doubled-open tag inside <text> collapses to its real short label", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><text x="4" y="20" font-size="12"><<tspan>Hi</tspan></text></svg>';
    const dir = repo(HERO + "\n" + QUICK, { "assets/readme/hero.svg": svg });
    expect(await idsOf(dir)).not.toContain("visuals/svg-text-overflow");
  });
});

describe("visuals/svg-escaped (visuals.ts:182): CDATA and comment removal before the ampersand scan", () => {
  it("does not flag an ampersand that only exists inside a CDATA block and an html comment", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><![CDATA[ a & b ]]><!-- c & d --><text x="4" y="20" font-size="12">A &amp; B</text></svg>';
    const dir = repo(HERO + "\n" + QUICK, { "assets/readme/hero.svg": svg });
    expect(await idsOf(dir)).not.toContain("visuals/svg-escaped");
  });
});

describe("honesty/comparison-product-first (privacy.ts:130): hero <h1> title strips nested HTML", () => {
  it("finds the product name behind a doubled-open tag in the hero's html h1, so the rule does not misfire", async () => {
    const readme = '<h1 align="center"><<b>MyTool</b></h1>\n\n<p align="center"><b>Tagline here.</b></p>\n\n## Comparison\n\n| [MyTool](https://example.com/a/mytool) | [Other](https://example.com/a/other) |\n| --- | --- |\n| Fast | Slow |\n';
    const dir = repo(readme);
    expect(await idsOf(dir)).not.toContain("honesty/comparison-product-first");
  });
});

describe("privacy/hosts-through-badges (privacy.ts:227): line-prefix check strips inline HTML first", () => {
  it("still recognizes an install-paths pointer line once its wrapping <b> tag is stripped", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\n<b>Install paths</b> vary by host.\n");
    expect(await idsOf(dir)).toContain("privacy/hosts-through-badges");
  });
});

describe("badges/shown-as-badges (badges.ts:209): raw html node strips a comment before the tag pass", () => {
  it("flags a raw badge url exposed after an html comment and a doubled-open tag are both removed", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n<!-- note --><p><<b>https://img.shields.io/badge/a-b-c</b></p>\n");
    expect(await idsOf(dir)).toContain("badges/shown-as-badges");
  });
});

describe("prose/about-the-product (prose.ts:37): html comment removal joins the sentence back together", () => {
  it("still catches a making-of sentence once an html comment sitting mid-sentence is removed", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\nThis screenshot<!-- note -->  was generated by our tool.\n");
    expect(await idsOf(dir)).toContain("prose/about-the-product");
  });
});

describe("prose/says-it-once (prose.ts:85): hero <b> tagline text strips a nested tag before comparison", () => {
  it("matches the tagline to a restating sentence once the tagline's doubled-open tag collapses", async () => {
    const readme = '<h1 align="center">Tidy</h1>\n\n<p align="center"><b><<i>Fast</i> and truly simple</b></p>\n\nIt stays truly fast and simple always.\n';
    const dir = repo(readme);
    expect(await idsOf(dir)).toContain("prose/says-it-once");
  });
});

describe("badges/registry-present (registry.ts:14): npm registry lookup URL, js/incomplete-sanitization", () => {
  it("percent-encodes every slash in a scoped npm package name, not just the first one", async () => {
    const dir = repo(HERO + "\n" + QUICK, { "package.json": JSON.stringify({ name: "@scope/sub/thing", main: "i.js" }) });
    const requested: string[] = [];
    const stub = vi.fn(async (url: string) => {
      requested.push(url);
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", stub);
    try {
      await run(dir, { links: true });
    } finally {
      vi.unstubAllGlobals();
    }
    const npmUrl = requested.find((u) => u.startsWith("https://registry.npmjs.org/"));
    // A single, non-global replace only turns the first "/" into "%2F", leaving
    // "@scope%2Fsub/thing" -- a path with the wrong number of segments. Every slash must go.
    expect(npmUrl).toBe("https://registry.npmjs.org/@scope%2Fsub%2Fthing");
    expect(npmUrl).not.toContain("/sub/");
  });
});
