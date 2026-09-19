import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check } from "../src/check/index.js";
import { format, formatResults } from "../src/check/format.js";
import { loadConfig, DEFAULT_CONFIG } from "../src/check/config.js";
import { parseDoc } from "../src/check/doc.js";
import { decodeEntities, localPath, collectImages, collectLinks, attr, safeDecode } from "../src/check/util.js";

function repo(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "rm-core-"));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  return dir;
}

describe("loadConfig", () => {
  it("throws when an explicit config path does not exist", () => {
    const dir = repo();
    expect(() => loadConfig(join(dir, "missing.json"), dir)).toThrow(/Config not found:/);
  });
  it("throws when the config is not valid JSON", () => {
    const dir = repo({ "readmerlin.json": "{not json" });
    expect(() => loadConfig(undefined, dir)).toThrow(/Config is not valid JSON:/);
  });
  it("keeps warn and fail rule levels and drops one that is neither", () => {
    const dir = repo({ "readmerlin.json": JSON.stringify({ rules: { "a/b": "warn", "c/d": "fail", "e/f": "off", "g/h": "bogus" } }) });
    const cfg = loadConfig(undefined, dir);
    expect(cfg.rules).toEqual({ "a/b": "warn", "c/d": "fail", "e/f": "off" });
  });
  it("falls back to the default config when the file at cwd is missing, with no explicit path given", () => {
    const dir = repo();
    expect(loadConfig(undefined, dir)).toEqual(DEFAULT_CONFIG);
  });
});

describe("parseDoc", () => {
  it("treats a folder above the readme with no manifest and no .git as its own root", () => {
    const dir = repo({ "README.md": "# t\n\nHello.\n" });
    const doc = parseDoc(join(dir, "README.md"));
    expect(doc.repoRoot).toBe(dir);
    expect(doc.kind).toBe("readme");
  });
});

describe("format", () => {
  it("sorts findings with a missing line first and orders a warning as a warning annotation", () => {
    const r = { file: "README.md", findings: [
      { id: "a/b", level: "warn" as const, message: "second" },
      { id: "c/d", level: "fail" as const, message: "first", line: 1 },
    ], fails: 1, warns: 1, ran: ["a/b", "c/d"] };
    const text = format(r, "text");
    // A finding with no line number sorts as if it were line 0, so it comes first.
    expect(text.indexOf("second")).toBeLessThan(text.indexOf("first"));
    expect(text).toContain("  -\twarn\tsecond  [a/b]\n");
    const github = format(r, "github");
    expect(github).toContain("::warning file=README.md,title=a/b::second\n");
    expect(github).not.toContain("Repair:");
  });
});

describe("check's per-rule finding cap", () => {
  it("caps findings per rule and reports how many more were cut", async () => {
    const dir = repo({
      "readmerlin.json": JSON.stringify({ maxFindingsPerRule: 1 }),
      "README.md": '<h1 align="center">t</h1>\n\n<p align="center"><b>Tag line here.</b></p>\n\n<p align="center"><img alt="hero" src="a.svg"></p>\n\nAdd the skill to your agent.\n\n## Notes\n\n- mail one@corp.example.io\n- mail two@corp.example.io\n- mail three@corp.example.io\n',
      "a.svg": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>',
    });
    const r = await check(join(dir, "README.md"), { format: "json", links: false });
    const pii = r.findings.filter((f) => f.id === "privacy/personal-data-clear");
    expect(pii.length).toBe(2);
    expect(pii[1].message).toMatch(/2 more of the same\. Fix these and run again\./);
  });
});

describe("util: decodeEntities", () => {
  it("decodes a decimal and a hex entity, keeps an unknown code point and an unknown name as-is", () => {
    expect(decodeEntities("&#65;")).toBe("A");
    expect(decodeEntities("&#x41;")).toBe("A");
    expect(decodeEntities("&#99999999;")).toBe("&#99999999;");
    expect(decodeEntities("&madeupname;")).toBe("&madeupname;");
    expect(decodeEntities("&amp;")).toBe("&");
  });
});

describe("util: localPath and safeDecode", () => {
  it("returns the input unchanged on a malformed escape", () => {
    expect(safeDecode("%zz")).toBe("%zz");
  });
  it("resolves a root-relative path from the repo root, not the file's folder", () => {
    const dir = repo({ "docs/a.md": "x", "b.md": "y" });
    expect(localPath(dir, "/b.md", join(dir, "docs"))).toBe(join(dir, "b.md"));
  });
});

describe("util: attr", () => {
  it("reads a single-quoted and an unquoted attribute", () => {
    expect(attr("<img src='a.svg' width=200>", "src")).toBe("a.svg");
    expect(attr("<img src='a.svg' width=200>", "width")).toBe("200");
  });
});

describe("util: collectImages and collectLinks", () => {
  it("falls back to an empty alt for a markdown image with none, and reads an unwrapped image as not linked", () => {
    const dir = repo({ "README.md": "# t\n\n![](a.svg)\n" });
    const doc = parseDoc(join(dir, "README.md"));
    const images = collectImages(doc);
    expect(images[0].alt).toBe("");
    expect(images[0].linked).toBe(false);
  });
  it("reads a percent height with no reference width as undefined", () => {
    const dir = repo({ "README.md": '# t\n\n<img alt="x" src="a.svg" height="50%">\n' });
    const doc = parseDoc(join(dir, "README.md"));
    const images = collectImages(doc);
    expect(images[0].height).toBeUndefined();
  });
  it("treats a non-numeric width as undefined instead of NaN", () => {
    const dir = repo({ "README.md": '# t\n\n<img alt="x" src="a.svg" width="big">\n' });
    const doc = parseDoc(join(dir, "README.md"));
    expect(collectImages(doc)[0].width).toBeUndefined();
  });
  it("reads an html link's bold state from a <b> right before it", () => {
    const dir = repo({ "README.md": '# t\n\n<b><a href="x.md">See</a></b>\n' });
    const doc = parseDoc(join(dir, "README.md"));
    const links = collectLinks(doc);
    expect(links[0].bold).toBe(true);
    expect(links[0].html).toBe(true);
  });
});
