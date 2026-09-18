import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { check } from "../src/check/index.js";

const README = resolve(__dirname, "fixtures/skill-repo/README.md");

describe("check", () => {
  it("finds the kill-list heading, the em dash and the meta sentence, and passes the hero", async () => {
    const r = await check(README, { format: "json", links: false });
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
