import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check } from "../src/check/index.js";
import { gather } from "../src/context/index.js";
import { write } from "../src/write/index.js";
import { extractReadme, buildRepairPrompt } from "../src/write/prompt.js";
import type { Backend } from "../src/write/backends.js";

const HERO = `<h1 align="center">🧾 tidy</h1>\n\n<p align="center"><b>Receipts in, claim out.</b><br>One week of receipts becomes one claim.</p>\n\n<p align="center"><a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-2f6f4e?logo=opensourceinitiative"></a></p>\n\n<p align="center"><img alt="Receipts flow into one claim" src="assets/readme/hero.svg" width="900"></p>\n\n<p align="center"><b><a href="examples/claim.pdf">See the example claim</a></b></p>\n`;
const QUICK = `## Quick start\n\n\`\`\`bash\nnpx skills add owner/tidy -g\n\`\`\`\n`;
const AGENTS = `## For agents\n\n- Read SKILL.md first.\n`;

function repo(readme: string, files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "rm-adv-"));
  for (const [rel, content] of Object.entries({ "assets/readme/hero.svg": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><style>text{font-family:system-ui}</style><rect x="0" y="0" width="100" height="40"/><text x="4" y="20" font-size="12">Hi</text></svg>', "assets/readme/hero.hero.json": "{}", "examples/claim.pdf": "%PDF", LICENSE: "MIT License", ...files })) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  writeFileSync(join(dir, "README.md"), readme);
  return dir;
}

const ids = async (dir: string, level?: "fail" | "warn") => {
  const r = await check(join(dir, "README.md"), { format: "json", links: false });
  return r.findings.filter((f) => !level || f.level === level).map((f) => f.id);
};

describe("a clean README passes", () => {
  it("has zero fails", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n" + AGENTS);
    expect(await ids(dir, "fail")).toEqual([]);
  });
});

describe("dashes", () => {
  it("ignores dashes inside urls, inline code and fences", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\nSee [the guide](https://example.com/a–b) and `foo—bar`.\n\n```\nx — y\n```\n\n" + AGENTS);
    expect(await ids(dir)).not.toContain("prose/no-dashes");
  });
  it("catches a dash in prose", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\nOne thing — another.\n\n" + AGENTS);
    expect(await ids(dir, "fail")).toContain("prose/no-dashes");
  });
});

describe("shape tricks", () => {
  it("does not read a heading inside an html comment or a fence", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n<!-- ## License -->\n\n```md\n## Contributing\n```\n\n" + AGENTS);
    expect(await ids(dir)).not.toContain("shape/kill-list");
  });
  it("does not count a badge inside a fence as a badge below the hero", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n```html\n<img src=\"https://img.shields.io/badge/a-b-c\">\n```\n\n" + AGENTS);
    expect(await ids(dir)).not.toContain("shape/badges-in-hero");
  });
  it("finds the enable step inside a list item", async () => {
    const dir = repo(HERO + "\n## Quick start\n\n1. `npx skills add owner/tidy`, then ask.\n\n" + AGENTS);
    expect(await ids(dir)).not.toContain("shape/enable-step");
  });
  it("fails an empty README without crashing", async () => {
    const dir = repo("");
    const f = await ids(dir, "fail");
    expect(f).toContain("hero/exists");
  });
  it("handles a huge README in reasonable time", async () => {
    const body = Array.from({ length: 4000 }, (_, i) => `- line ${i} with some words in it`).join("\n");
    const dir = repo(HERO + "\n" + QUICK + "\n## Big\n\n" + body + "\n\n" + AGENTS);
    const t = Date.now();
    await ids(dir);
    expect(Date.now() - t).toBeLessThan(5000);
  });
  it("leaves CJK and allowlisted headings alone", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## 使い方\n\n- x\n\n## Runs on Claude Code\n\n- y\n\n" + AGENTS);
    expect(await ids(dir)).not.toContain("prose/sentence-case");
  });
});

describe("links and anchors", () => {
  it("resolves anchors to headings with punctuation and flags missing files", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## How it works: the loop\n\n- See [the loop](#how-it-works-the-loop) and [missing](docs/nope.md).\n\n" + AGENTS);
    const r = await check(join(dir, "README.md"), { format: "json", links: false });
    const rel = r.findings.filter((f) => f.id === "links/relative");
    expect(rel.length).toBe(1);
    expect(rel[0].message).toContain("docs/nope.md");
  });
});

describe("privacy", () => {
  it("flags emails, home paths and keys but not noreply or tilde paths", async () => {
    const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\n- mail me at someone@corp.example.io\n- lives in /Users/alice/code\n- token sk-ant-abcdefghijklmnopqrstuvwxyz0123\n- bot 1234+bot@users.noreply.github.com\n- copy into `~/.claude/skills/x`\n\n" + AGENTS);
    const r = await check(join(dir, "README.md"), { format: "json", links: false });
    const pii = r.findings.filter((f) => f.id === "privacy/pii");
    const first = pii[0]?.line ?? 0;
    expect(pii.map((f) => f.line).sort()).toEqual([first, first + 1, first + 2].sort());
  });
  it("matches a hashed denylist token without naming it", async () => {
    const { createHash } = await import("node:crypto");
    const dir = repo(HERO + "\n" + QUICK + "\n## Notes\n\n- worked with Acme Corp\n\n" + AGENTS, { ".readmerlin/denylist.sha256": createHash("sha256").update("acme").digest("hex") + "\n" });
    const r = await check(join(dir, "README.md"), { format: "json", links: false });
    const d = r.findings.filter((f) => f.id === "privacy/denylist");
    expect(d.length).toBe(1);
    expect(d[0].message).not.toMatch(/acme/i);
  });
});

describe("config", () => {
  it("turns a rule off and honours a count source", async () => {
    const dir = repo(HERO.replace('<a href="LICENSE">', '<a href="docs/v.md"><img alt="vendors" src="https://img.shields.io/badge/vendors-3-6f42c1?logo=databricks"></a><a href="LICENSE">') + "\n" + QUICK + "\nOne thing — another.\n\n" + AGENTS, { "readmerlin.json": JSON.stringify({ rules: { "prose/no-dashes": "off" }, counts: { vendors: "echo 3" } }), "docs/v.md": "" });
    const r = await check(join(dir, "README.md"), { format: "json", links: false });
    expect(r.ran).not.toContain("prose/no-dashes");
    expect(r.findings.map((f) => f.id)).not.toContain("badges/count-source");
  });
});

describe("context", () => {
  it("survives broken frontmatter, missing git and odd manifests", async () => {
    const dir = repo("# x", { "SKILL.md": "---\nname: [unclosed\n---\n# s\n", ".claude-plugin/plugin.json": "{not json", ".mcp.json": "[]" });
    const c = await gather(dir);
    expect(c.skills.length).toBe(1);
    expect(c.plugin).toBeUndefined();
    expect(c.repo.owner).toBeUndefined();
  });
});

describe("writer", () => {
  it("extracts a README from tags, a fence, or raw text", () => {
    expect(extractReadme("junk <readme>\n# a\n</readme> junk")).toBe("# a\n");
    expect(extractReadme("```markdown\n# a\n\n## b\n```")).toBe("# a\n\n## b\n");
    expect(extractReadme("# a\n")).toBe("# a\n");
  });
  it("repairs through the check loop and stops at the round limit", async () => {
    const bad = HERO + "\n" + QUICK + "\nOne — two.\n\n" + AGENTS;
    const good = bad.replace(" — ", ", ");
    let calls = 0;
    const fixer: Backend = { name: "claude", complete: async (p) => { calls++; return `<readme>${calls === 1 ? bad : good}</readme>`; } };
    const dir = repo("# old");
    const r = await write(dir, { backend: fixer, dryRun: true });
    expect(r.rounds).toBe(2);
    expect(r.findings).toEqual([]);
    expect(r.readme).toBe(good);
    const stubborn: Backend = { name: "claude", complete: async () => `<readme>${bad}</readme>` };
    const r2 = await write(dir, { backend: stubborn, dryRun: true, rounds: 2 });
    expect(r2.rounds).toBe(2);
    expect(r2.findings.map((f) => f.id)).toContain("prose/no-dashes");
    expect(buildRepairPrompt("x", r2.findings)).toContain("prose/no-dashes");
  });
  it("writes nothing on the prompt backend", async () => {
    const dir = repo("# old");
    const orig = process.stdout.write;
    let printed = "";
    process.stdout.write = ((s: string) => { printed += s; return true; }) as typeof process.stdout.write;
    try {
      const r = await write(dir, { backend: "prompt" });
      expect(r.rounds).toBe(0);
      expect(printed).toContain("# Rules");
    } finally {
      process.stdout.write = orig;
    }
  });
});
