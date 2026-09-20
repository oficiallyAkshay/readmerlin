import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check } from "../src/check/index.js";

const HERO = `<h1 align="center">🧾 tidy</h1>\n\n<p align="center"><b>Receipts in, claim out.</b><br>One week of receipts becomes one claim.</p>\n\n<p align="center"><a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-2f6f4e?logo=opensourceinitiative"></a></p>\n\n<p align="center"><img alt="Receipts flow into one claim" src="assets/readme/hero.svg" width="900"></p>\n\n<p align="center"><b><a href="examples/claim.pdf">See the example claim</a></b></p>\n\nAdd the tidy skill to your agent, then hand it the week.\n`;
const QUICK = `## Features\n\n- 🧾 **Every receipt found.** The inbox is searched for the trip window only.\n`;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><style>text{font-family:system-ui}</style><rect x="0" y="0" width="100" height="40"/><text x="4" y="20" font-size="12">Hi</text></svg>';

function repo(readme: string, files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "rm-shvi-"));
  for (const [rel, content] of Object.entries({ "assets/readme/hero.svg": SVG, "assets/readme/hero.hero.json": "{}", "examples/claim.pdf": "%PDF", LICENSE: "MIT License", ...files })) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  writeFileSync(join(dir, "README.md"), readme);
  return dir;
}

const run = (dir: string) => check(join(dir, "README.md"), { format: "json", links: false });
const idsOf = async (dir: string) => (await run(dir)).findings.map((f) => f.id);
const findingsFor = async (dir: string, id: string) => (await run(dir)).findings.filter((f) => f.id === id);

describe("shape/badges-in-hero, shape/hero-one-visual and shape/cta-link", () => {
  it("flags a badge that sits below the hero and outside any Badges section", async () => {
    const dir = repo(HERO + "\n" + QUICK + '\n## Notes\n\n<img alt="x" src="https://img.shields.io/badge/a-b-c">\n');
    expect(await idsOf(dir)).toContain("shape/badges-in-hero");
  });
  it("flags a second visual block in the hero", async () => {
    const dir = repo(HERO.replace("</p>\n\n<p align=\"center\"><b><a", '</p>\n\n<p align="center"><img alt="second" src="assets/readme/hero.svg" width="900"></p>\n\n<p align="center"><b><a') + "\n" + QUICK);
    const f = await findingsFor(dir, "shape/hero-one-visual");
    expect(f[0]?.message).toMatch(/More than one visual block in the hero \(2\)/);
  });
  it("flags a second bold link in the hero", async () => {
    const dir = repo(HERO.replace("Add the tidy skill", '<p align="center"><b><a href="LICENSE">Second link</a></b></p>\n\nAdd the tidy skill') + "\n" + QUICK);
    expect(await idsOf(dir)).toContain("shape/cta-link");
  });
  it("does not count an OpenSSF Best Practices badge or a Scorecard badge as a second hero visual", async () => {
    const row = '<p align="center"><a href="https://www.bestpractices.dev/projects/1"><img alt="OpenSSF Best Practices" src="https://www.bestpractices.dev/projects/1/badge"></a> <a href="https://scorecard.dev/viewer/?uri=github.com/o/r"><img alt="OpenSSF Scorecard" src="https://api.scorecard.dev/projects/github.com/o/r/badge"></a></p>\n\n';
    const dir = repo(HERO.replace('<p align="center"><img alt="Receipts flow into one claim"', row + '<p align="center"><img alt="Receipts flow into one claim"') + "\n" + QUICK);
    expect(await idsOf(dir)).not.toContain("shape/hero-one-visual");
  });
});

describe("shape/enable-step through a raw html <code> block", () => {
  it("finds an install command inside a raw <code> element in the hero", async () => {
    const bare = HERO.replace("Add the tidy skill to your agent, then hand it the week.", '<p align="center"><code>npx skills add owner/tidy -g</code></p>');
    expect(await idsOf(repo(bare + "\n" + QUICK))).not.toContain("shape/enable-step");
  });
  it("skips an unreadable CONTRIBUTING that is actually a directory", async () => {
    const bare = HERO.replace("Add the tidy skill to your agent, then hand it the week.", "Hand it the week.");
    const dir = repo(bare + "\n" + QUICK);
    mkdirSync(join(dir, ".github", "CONTRIBUTING.md"), { recursive: true });
    expect(await idsOf(dir)).toContain("shape/enable-step");
  });
  it("skips a CONTRIBUTING fence that names no install step before finding one in a later fence", async () => {
    const bare = HERO.replace("Add the tidy skill to your agent, then hand it the week.", "Hand it the week.");
    const dir = repo(bare + "\n" + QUICK, { ".github/CONTRIBUTING.md": "# Contributing\n\n```text\necho unrelated\n```\n\n```text\nnpx skills add owner/tidy -g\n```\n" });
    expect(await idsOf(dir)).not.toContain("shape/enable-step");
  });
});

describe("shape/structured-sections", () => {
  it("flags a section that is paragraphs only, over sixty words", async () => {
    const words = Array.from({ length: 65 }, (_, i) => `word${i}`).join(" ");
    const dir = repo(HERO + "\n" + QUICK + `\n## Notes\n\n${words}\n`);
    expect(await idsOf(dir)).toContain("shape/structured-sections");
  });
});

describe("shape/agents-in-contributing with unreadable files", () => {
  it("treats a CONTRIBUTING that is a directory as unreadable, and an AGENTS.md that is a directory as empty", async () => {
    const dir = repo(HERO + "\n" + QUICK);
    mkdirSync(join(dir, ".github", "CONTRIBUTING.md"), { recursive: true });
    mkdirSync(join(dir, "AGENTS.md"), { recursive: true });
    expect(await idsOf(dir)).not.toContain("shape/agents-in-contributing");
  });
});

describe("shape/section-order", () => {
  it("does nothing when sectionOrder is configured empty", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\n- x\n", { "readmerlin.json": JSON.stringify({ sectionOrder: [] }) });
    expect(await idsOf(dir)).not.toContain("shape/section-order");
  });
  it("flags sections that are out of the configured order", async () => {
    const parts = [HERO, "## Security and limits\n\nIt needs no credential.\n\n- ❌ x\n", QUICK].join("\n");
    const dir = repo(parts, { "readmerlin.json": JSON.stringify({ sectionOrder: ["Features", "Security and limits"] }) });
    const f = await findingsFor(dir, "shape/section-order");
    expect(f.some((x) => x.message === "Sections are out of order.")).toBe(true);
  });
});

describe("shape/feature-bullets: table before blocks, stray content, malformed block, no emoji, no line", () => {
  const block = (emoji: string, heading: string, line: string) => `<p align="center">${emoji}<br><b>${heading}</b><br>${line}</p>`;
  it("flags a table before the centred blocks", async () => {
    const feats = "## Features\n\n<table><tr><td>a</td></tr></table>\n\n" + block("🧾", "Every receipt found", "One line.") + "\n";
    const f = await findingsFor(repo(HERO + "\n" + feats), "shape/feature-bullets");
    expect(f.some((x) => x.message === "Features is a table.")).toBe(true);
  });
  it("flags a stray paragraph among the feature blocks", async () => {
    const feats = "## Features\n\n" + block("🧾", "Every receipt found", "One line.") + "\n\nA stray paragraph.\n";
    const f = await findingsFor(repo(HERO + "\n" + feats), "shape/feature-bullets");
    expect(f.some((x) => x.message === "Something other than a centred block among the feature blocks.")).toBe(true);
  });
  it("flags a block that does not match the centred shape, one with no emoji, and one with no closing line", async () => {
    const feats = "## Features\n\n" + block("🧾", "Every receipt found", "One line.") + '\n\n<p align="center">not the shape</p>\n\n<p align="center">X<br><b>Plain lead</b><br>Text.</p>\n\n<p align="center">🧾<br><b>No line here</b><br> </p>\n';
    const f = await findingsFor(repo(HERO + "\n" + feats), "shape/feature-bullets");
    const msgs = f.map((x) => x.message);
    expect(msgs).toContain("Feature block missing the emoji, bold heading and one line shape.");
    expect(msgs).toContain("Feature block does not lead with an emoji.");
    expect(msgs).toContain("Feature block has no line after the heading.");
  });
  it("flags a table used for a bullet-style Features section", async () => {
    const feats = "## Features\n\n<table><tr><td>a</td></tr></table>\n\n- 🧾 **Thing here.** One clause.\n";
    const f = await findingsFor(repo(HERO + "\n" + feats), "shape/feature-bullets");
    expect(f.some((x) => x.message === "Features is a table.")).toBe(true);
  });
});

describe("shape/security-checklist: two opening paragraphs, and no checklist at all", () => {
  it("flags a Security section that opens with two paragraphs", async () => {
    const sec = "## Security and limits\n\nOne sentence.\n\nAnother sentence.\n\n- ❌ sends a receipt anywhere\n";
    const f = await findingsFor(repo(HERO + "\n" + QUICK + "\n" + sec), "shape/security-checklist");
    expect(f.some((x) => /Security opens with 2 paragraphs/.test(x.message))).toBe(true);
  });
  it("flags a Security section with no checklist", async () => {
    const sec = "## Security and limits\n\nIt needs no credential of its own.\n";
    const f = await findingsFor(repo(HERO + "\n" + QUICK + "\n" + sec), "shape/security-checklist");
    expect(f.some((x) => x.message === "Security has no checklist.")).toBe(true);
  });
});

describe("visuals: alt text, remote svg, raster, data uri", () => {
  it("flags a local image with no alt text, and a remote svg", async () => {
    const dir = repo(HERO + "\n" + QUICK + '\n<img src="assets/readme/hero.svg">\n\n![](https://example.com/a.svg)\n');
    const ids = await idsOf(dir);
    expect(ids).toContain("visuals/images-exist");
    expect(ids).toContain("visuals/svg-local");
  });
  it("warns on a raster image and treats a data-uri image as remote, not local", async () => {
    const dir = repo(HERO + "\n" + QUICK + '\n<img alt="shot" src="assets/readme/shot.png">\n\n<img alt="inline" src="data:image/png;base64,iVBORw0KGgo=">\n', { "assets/readme/shot.png": Buffer.from("not a real png").toString() });
    const ids = await idsOf(dir);
    expect(ids).toContain("visuals/raster");
    expect(ids).not.toContain("visuals/images-exist");
  });
});

describe("visuals/height: unreadable image and missing local file", () => {
  it("skips an image file that imageSize cannot parse", async () => {
    const dir = repo(HERO + "\n" + QUICK + '\n<img alt="bad" src="assets/readme/bad.png">\n', { "assets/readme/bad.png": "not a real image" });
    expect(await idsOf(dir)).not.toContain("visuals/height");
  });
  it("skips an svg whose viewBox gives it zero width and height", async () => {
    const zero = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 0"></svg>';
    const dir = repo(HERO + "\n" + QUICK + '\n<img alt="zero" src="assets/readme/zero.svg">\n', { "assets/readme/zero.svg": zero });
    expect(await idsOf(dir)).not.toContain("visuals/height");
  });
});

describe("visuals/spec-beside", () => {
  it("passes a diagram svg with a matching .archify.json, and flags one with no spec at all", async () => {
    const withSpec = repo(HERO + "\n" + QUICK + '\n<img alt="d" src="assets/readme/diagram.svg">\n', { "assets/readme/diagram.svg": SVG, "assets/readme/diagram.archify.json": "{}" });
    expect(await idsOf(withSpec)).not.toContain("visuals/spec-beside");
    const noSpec = repo(HERO + "\n" + QUICK + '\n<img alt="d" src="assets/readme/diagram.svg">\n', { "assets/readme/diagram.svg": SVG });
    const f = await findingsFor(noSpec, "visuals/spec-beside");
    expect(f[0]?.message).toMatch(/No source spec beside/);
  });
});

describe("visuals/spec-agrees: invalid spec JSON", () => {
  it("flags a hero.hero.json that is not valid JSON", async () => {
    const dir = repo(HERO + "\n" + QUICK, { "assets/readme/hero.hero.json": "{not json" });
    const f = await findingsFor(dir, "visuals/spec-agrees");
    expect(f[0]?.message).toMatch(/is not valid JSON/);
  });
});

describe("visuals/svg-escaped and visuals/svg-font-stack", () => {
  it("flags an unescaped ampersand in svg text, and text with no font stack", async () => {
    const bad = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><text x="4" y="20" font-size="12">A & B</text></svg>';
    const dir = repo(HERO + "\n" + QUICK, { "assets/readme/hero.svg": bad });
    const ids = await idsOf(dir);
    expect(ids).toContain("visuals/svg-escaped");
    expect(ids).toContain("visuals/svg-font-stack");
  });
});

describe("visuals/svg-clipping and svg-text-overflow with no viewBox", () => {
  it("skips both rules when the svg has no viewBox", async () => {
    const noViewBox = '<svg xmlns="http://www.w3.org/2000/svg"><style>text{font-family:system-ui}</style><rect x="-999" y="0" width="10" height="10"/></svg>';
    const dir = repo(HERO + "\n" + QUICK, { "assets/readme/hero.svg": noViewBox });
    const ids = await idsOf(dir);
    expect(ids).not.toContain("visuals/svg-clipping");
    expect(ids).not.toContain("visuals/svg-text-overflow");
  });
  it("guesses an overflow from character count when a label has no textLength", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><style>text{font-family:system-ui}</style><text x="4" y="20" font-size="12">A very long label with many characters in it</text></svg>';
    const dir = repo(HERO + "\n" + QUICK, { "assets/readme/hero.svg": svg });
    const f = await findingsFor(dir, "visuals/svg-text-overflow");
    expect(f[0]?.message).toMatch(/may run past the edge/);
  });
});

describe("visuals/distinct-icons", () => {
  it("flags a repeated <use> reference and a repeated icon group", async () => {
    const useRepeats = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><style>text{font-family:system-ui}</style><use href="#i"/><use href="#i"/><use href="#i"/></svg>';
    const dir = repo(HERO + "\n" + QUICK, { "assets/readme/hero.svg": useRepeats });
    expect(await idsOf(dir)).toContain("visuals/distinct-icons");
    const groupRepeats = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><style>text{font-family:system-ui}</style><g class="icon-a"><circle/></g><g class="icon-a"><circle/></g><g class="icon-a"><circle/></g></svg>';
    const dir2 = repo(HERO + "\n" + QUICK, { "assets/readme/hero.svg": groupRepeats });
    expect(await idsOf(dir2)).toContain("visuals/distinct-icons");
  });
});
