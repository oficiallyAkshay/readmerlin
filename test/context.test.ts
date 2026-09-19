import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { gather } from "../src/context/index.js";
import { toMarkdown } from "../src/context/markdown.js";

const FIX = resolve(__dirname, "fixtures/skill-repo");

describe("context", () => {
  it("reads skills, plugin, mcp, commands, agents, workflows, license and readme", async () => {
    const c = await gather(FIX);
    expect(c.skills.map((s) => s.name).sort()).toEqual(["tidy", "tidy-inbox"]);
    expect(c.skills.find((s) => s.name === "tidy-inbox")?.summary).toMatch(/one claim/);
    expect(c.plugin?.name).toBe("tidy");
    expect(c.plugin?.mcpServers).toEqual(["receipts"]);
    expect(c.mcp[0].servers.map((s) => s.name)).toEqual(["receipts", "remote"]);
    expect(c.commands[0]).toMatchObject({ name: "claim" });
    expect(c.agents[0]).toMatchObject({ name: "reviewer" });
    expect(c.workflows[0]).toMatchObject({ file: ".github/workflows/ci.yml", name: "CI" });
    expect(c.license?.spdx).toBe("MIT");
    expect(c.readme.title).toBe("🧾 tidy");
    expect(c.readme.tagline).toBe("Receipts in, claim out.");
    expect(c.readme.badges).toBe(1);
    expect(c.hosts).toContain("Claude Code");
    expect(c.install.some((i) => i.startsWith("npx skills add"))).toBe(true);
  });

  it("renders markdown", async () => {
    const md = toMarkdown(await gather(FIX));
    expect(md).toContain("## Skills");
    expect(md).toContain("### tidy-inbox");
    expect(md).toContain("## MCP servers");
  });
});

import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "readmerlin-ctx-"));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(root, rel, ".."), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  return root;
}

describe("context on odd repos", () => {
  it("skips a null MCP server entry instead of crashing", async () => {
    const c = await gather(repo({ ".mcp.json": '{"mcpServers":{"a":{"command":"npx"},"b":null}}' }));
    expect(c.mcp[0].servers.map((s) => s.name)).toEqual(["a"]);
  });

  it("survives a YAML anchor cycle in frontmatter", async () => {
    const c = await gather(repo({ "skills/c/SKILL.md": "---\nname: c\nmetadata: &m\n  self: *m\n---\n\nBody.\n" }));
    expect(() => JSON.stringify(c)).not.toThrow();
    expect(c.skills[0].name).toBe("c");
  });

  it("lists a skill once when a symlink points back at its folder", async () => {
    const root = repo({ "skills/d/SKILL.md": "---\nname: d\n---\n\nBody.\n", "commands/run.md": "---\ndescription: run it\n---\n" });
    mkdirSync(join(root, ".claude"));
    symlinkSync("../skills", join(root, ".claude/skills"));
    symlinkSync("../commands", join(root, ".claude/commands"));
    const c = await gather(root);
    expect(c.skills.map((s) => s.name)).toEqual(["d"]);
    expect(c.commands.map((s) => s.name)).toEqual(["run"]);
  });

  it("never reads through a symlink that leaves the repo", async () => {
    const outside = repo({ "skills/ext/SKILL.md": "---\nname: ext\n---\n\nBody.\n" });
    const root = repo({ "README.md": "# x\n" });
    symlinkSync(outside, join(root, "docs"));
    const c = await gather(root);
    expect(c.skills).toEqual([]);
  });

  it("keeps a skill named test or spec, and leaves examples out", async () => {
    const c = await gather(repo({
      "skills/test/SKILL.md": "---\nname: test\n---\n\nBody.\n",
      "skills/spec/SKILL.md": "---\nname: spec\n---\n\nBody.\n",
      "examples/demo/SKILL.md": "---\nname: demo\n---\n\nBody.\n",
    }));
    expect(c.skills.map((s) => s.name).sort()).toEqual(["spec", "test"]);
  });

  it("keeps a heading's trailing hash and one-lines a multi-line description", async () => {
    const c = await gather(repo({
      "README.md": "# Using F#\n\n## C#\n",
      "commands/review.md": "---\ndescription: |\n  Reviews code.\n  # not a heading\n---\n",
    }));
    expect(c.readme.headings).toEqual(["Using F#", "C#"]);
    expect(toMarkdown(c)).toContain("- review: Reviews code. # not a heading\n");
  });

  it("takes the package name from the [project] table only, and tells GPL-2 from GPL-3", async () => {
    const c = await gather(repo({
      "pyproject.toml": '[project]\nauthors = [{ name = "Bob" }]\nname = "pkg"\n\n[build-system]\nrequires = ["hatchling"]\n\n[tool.hatch.build]\nname = "not-the-package"\n',
      "LICENSE": "GNU GENERAL PUBLIC LICENSE\nVersion 2, June 1991\n",
    }));
    expect(c.packages.map((p) => p.name)).toEqual(["pkg"]);
    expect(c.license?.spdx).toBe("GPL-2.0");
  });

  it("masks a token in an MCP url and reads hosts from the hero", async () => {
    const c = await gather(repo({
      ".mcp.json": '{"mcpServers":{"r":{"url":"https://mcp.example/sse?token=SECRET123"},"c":{"command":"srv","args":["--key","sk-live-ABCDEFGHIJ"]}}}',
      "README.md": "# x\n\n**Tagline.**\n\nA skill for Claude Code, Cursor and Gemini CLI.\n\n## Features\n\nThe check runs on Codex.\n",
    }));
    const md = toMarkdown(c);
    expect(md).not.toContain("SECRET123");
    expect(md).not.toContain("sk-live-ABCDEFGHIJ");
    expect(c.hosts.sort()).toEqual(["Claude Code", "Cursor", "Gemini CLI"]);
  });
});
