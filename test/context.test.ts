import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { gather } from "../src/context/index.js";
import { README_CAP, toMarkdown } from "../src/context/markdown.js";

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

  it("prints the existing README in full, so a rerun starts from it", async () => {
    const md = toMarkdown(await gather(FIX));
    expect(md).toContain("~~~~markdown\n");
    expect(md).toContain("Receipts in, claim out.");
  });

  it("fences the README longer than any fence inside it, and caps a huge one", async () => {
    const base = await gather(FIX);
    const inner = toMarkdown({ ...base, readme: { ...base.readme, text: "a\n~~~~~~\ncode\n~~~~~~\nb" } });
    expect(inner).toContain("~~~~~~~markdown\n");
    expect(inner.trimEnd().endsWith("~~~~~~~")).toBe(true);
    const huge = toMarkdown({ ...base, readme: { ...base.readme, text: "x".repeat(README_CAP + 10) } });
    expect(huge).toContain("Read README.md for the rest.");
    expect(huge).not.toContain("x".repeat(README_CAP + 1));
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

describe("badge row, own page and compare spec", () => {
  it("gives a repo with no package a clone badge, from its shape alone", async () => {
    const root = repo({ LICENSE: "MIT License\n", "skills/x/SKILL.md": "---\nname: x\ndescription: d\n---\n\nBody.\n" });
    const c = await gather(root);
    c.repo = { host: "github.com", owner: "o", name: "r" };
    const { badgeRow } = await import("../src/context/readers.js");
    const row = badgeRow(c.repo, c.license, c.packages);
    expect(row.map((b) => b.alt)).toEqual(["MIT licence", "clones of this repository, last seven days and all time"]);
    expect(row[1].src).toContain("raw.githubusercontent.com/o/r/badges/clones.json");
    expect(c.self).toBe(false);
  });
  it("names no host for a repo that ships nothing an agent loads, even with a .claude folder", async () => {
    const c = await gather(repo({ ".claude/settings.json": "{}", "tool.py": "x = 1\n" }));
    expect(c.hosts).toEqual([]);
    expect(c.worksWith).toEqual([]);
  });
  it("keeps the host of an MCP-server-only repo", async () => {
    const c = await gather(repo({ ".cursor/mcp.json": JSON.stringify({ mcpServers: { s: { command: "node", args: ["s.js"] } } }) }));
    expect(c.hosts).toContain("Cursor");
  });
  it("gives Codex its OpenAI mark inline", async () => {
    const { worksWithRow } = await import("../src/context/readers.js");
    expect(worksWithRow(["Codex"])[0].src).toMatch(/logo=data:image\/svg%2bxml;base64,/);
  });
  it("draws a works-with badge for a known host and names an unknown one", async () => {
    const root = repo({ "readmerlin.json": JSON.stringify({ worksWith: ["Windsurf", "Hermes"] }) });
    const c = await gather(root);
    expect(c.worksWith.map((b) => b.alt)).toEqual(["Windsurf"]);
    expect(c.unbadgedHosts).toEqual(["Hermes"]);
    expect(toMarkdown(c)).toContain("No works-with badge recipe for Hermes");
  });
  it("draws a message-only host badge with no repeated works-with label", async () => {
    const { hostBadgeSrc, MARKLESS_HOST_BADGES } = await import("../src/context/readers.js");
    expect(hostBadgeSrc("Claude Code")).toBe("https://img.shields.io/badge/Claude%20Code-1e1b4b?logo=claude&logoColor=white");
    expect(hostBadgeSrc("Claude Code")).not.toContain("works");
    const openClaw = hostBadgeSrc("OpenClaw");
    expect(openClaw).toBe("https://img.shields.io/badge/OpenClaw-1e1b4b");
    expect(MARKLESS_HOST_BADGES()).toContain(openClaw);
  });
  it("lists an existing AGENTS.md the way it lists a workflow", async () => {
    const withFile = await gather(repo({ "AGENTS.md": "# AGENTS.md\n\nStart here.\n" }));
    expect(withFile.agentsFile).toBe("AGENTS.md");
    expect(toMarkdown(withFile)).toContain("AGENTS.md: AGENTS.md");
    const without = await gather(repo({}));
    expect(without.agentsFile).toBeUndefined();
  });
  it("marks readmerlin's own repo and reads its compare spec", async () => {
    const root = repo({ "skills/readmerlin/SKILL.md": "---\nname: readmerlin\ndescription: d\n---\n\nBody.\n", "readmerlin.json": JSON.stringify({ compare: { repos: ["a/b"], rows: ["Output"] } }) });
    const c = await gather(root);
    expect(c.self).toBe(true);
    expect(c.compare).toEqual({ repos: ["a/b"], rows: ["Output"] });
    const md = toMarkdown(c);
    expect(md).toContain("drops In action and Fit");
    expect(md).toContain("- Rows, in order: Output");
  });
});
