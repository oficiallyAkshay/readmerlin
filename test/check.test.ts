import { describe, expect, it } from "vitest";
import { dirname, resolve } from "node:path";
import { check } from "../src/check/index.js";

const README = resolve(__dirname, "fixtures/skill-repo/README.md");

describe("check", () => {
  it("finds the kill-list heading, the em dash and the meta sentence, and passes the hero", async () => {
    // Pinned to its own folder: the fixture has no .git, so without this it would inherit this project's real repo root.
    const r = await check(README, { format: "json", links: false, repoRoot: dirname(README) });
    const ids = r.findings.map((f) => f.id);
    expect(ids).toContain("shape/earned-headings");
    expect(ids).toContain("prose/plain-punctuation");
    expect(ids).toContain("prose/about-the-product");
    expect(ids).not.toContain("hero/exists");
    expect(ids).toContain("shape/hero-visual");
    expect(ids).toContain("shape/enable-step");
    expect(r.findings.filter((f) => f.level === "fail").map((f) => f.id).sort()).toEqual(["prose/about-the-product", "prose/plain-punctuation", "shape/earned-headings", "shape/enable-step", "shape/hero-visual"]);
  });
});

import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("prose/about-the-product", () => {
  const run = async (body: string) => {
    const dir = mkdtempSync(join(tmpdir(), "rm-"));
    const f = join(dir, "README.md");
    writeFileSync(f, `# t\n\n**b**\n\nc\n\n## s\n\n${body}\n`);
    const r = await check(f, { format: "json", links: false });
    return r.findings.filter((x) => x.id === "prose/about-the-product").length;
  };
  it("flags a diagram making-of and leaves product output alone", async () => {
    expect(await run("The diagram is rendered once from source with Archify.")).toBe(1);
    expect(await run("Rendered from the vendor's own email, markup untouched, one per page.")).toBe(0);
    expect(await run("This README was written by hand.")).toBe(1);
  });
});

describe("honesty/comparison-links", () => {
  const run = async (header: string) => {
    const dir = mkdtempSync(join(tmpdir(), "rm-"));
    const f = join(dir, "README.md");
    writeFileSync(f, `# t\n\n**b**\n\nc\n\n## How it compares\n\n| | ${header} |\n| --- | --- |\n| Output | Pages |\n`);
    return (await check(f, { format: "json", links: false, repoRoot: dir })).findings.filter((x) => x.id === "honesty/comparison-links");
  };
  it("passes a header that names its owner/repo", async () => {
    expect(await run("[acme/tool](https://github.com/acme/tool)")).toEqual([]);
  });
  it("warns on a header that drops the owner", async () => {
    expect((await run("[tool](https://github.com/acme/tool)"))[0]?.message).toMatch(/does not name its repo as acme\/tool/);
  });
});

describe("compare spec", () => {
  it("warns when the table's columns or rows differ from readmerlin.json", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rm-"));
    writeFileSync(join(dir, "readmerlin.json"), JSON.stringify({ compare: { repos: ["acme/tool"], rows: ["Output", "Model"] } }));
    const f = join(dir, "README.md");
    writeFileSync(f, `# t\n\n**b**\n\nc\n\n## How it compares\n\n| | [me/t](https://github.com/me/t) | [acme/other](https://github.com/acme/other) |\n| --- | --- | --- |\n| Output | Pages | Pages |\n`);
    const msgs = (await check(f, { format: "json", links: false, repoRoot: dir })).findings.filter((x) => x.id === "honesty/comparison-links").map((x) => x.message);
    expect(msgs.some((m) => /columns are acme\/other, the spec says acme\/tool/.test(m))).toBe(true);
    expect(msgs.some((m) => /rows are output, the spec says output, model/.test(m))).toBe(true);
  });
});

describe("works-with row", () => {
  it("warns on a missing host badge and on a ❌ item that says never twice", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rm-"));
    writeFileSync(join(dir, "readmerlin.json"), JSON.stringify({ worksWith: ["Claude Code"] }));
    const f = join(dir, "README.md");
    writeFileSync(f, `# t\n\n**b**\n\nc\n\n## Security and limits\n\nNo credential.\n\n- ❌ Never sends telemetry\n`);
    const r = await check(f, { format: "json", links: false, repoRoot: dir });
    expect(r.findings.some((x) => x.id === "badges/registry-present" && /Claude Code/.test(x.message))).toBe(true);
    expect(r.findings.some((x) => x.id === "shape/security-checklist" && /repeats the never/.test(x.message))).toBe(true);
  });
});
