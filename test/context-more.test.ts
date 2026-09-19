import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gather } from "../src/context/index.js";
import { toMarkdown } from "../src/context/markdown.js";
import { splitFrontmatter, headingsOf, firstParagraph } from "../src/context/frontmatter.js";
import { remoteOf } from "../src/context/git.js";
import { walk, readMarketplace, readMcp, readHooks, readWorkflows, readLicense, readPlugin, readPackages, readNamedDocs, detectHosts, installLines, readCompare, readWorksWith } from "../src/context/readers.js";

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "readmerlin-ctxmore-"));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(root, rel, ".."), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  return root;
}

describe("frontmatter", () => {
  it("turns a yaml date into its ISO string and plains an array", () => {
    const { data } = splitFrontmatter("---\ndate: !!timestamp 2024-01-02T00:00:00Z\ntags:\n  - a\n  - b\n---\n\nBody.\n");
    expect(data.date).toBe("2024-01-02T00:00:00.000Z");
    expect(data.tags).toEqual(["a", "b"]);
  });
  it("skips a fenced heading and reopens after it closes", () => {
    expect(headingsOf("# Real\n\n```\n# Not a heading\n```\n\n## Also real\n")).toEqual(["Real", "Also real"]);
  });
  it("finds the first plain paragraph, skipping a heading, quote, html, fence, table row and list item", () => {
    expect(firstParagraph("# H\n\n> quote\n\n<div>x</div>\n\n```\ncode\n```\n\n| a |\n\n- item\n\nActual paragraph text.\n")).toBe("Actual paragraph text.");
  });
});

describe("git remoteOf edge cases", () => {
  it("returns nothing for an empty origin url, and only the raw remote for one it cannot parse", () => {
    const dir = repo({ "x.txt": "x" });
    execFileSync("git", ["init", "-q", dir]);
    execFileSync("git", ["-C", dir, "config", "remote.origin.url", ""]);
    expect(remoteOf(dir)).toEqual({});
    execFileSync("git", ["-C", dir, "config", "remote.origin.url", "/local/path/to/repo"]);
    const r = remoteOf(dir);
    expect(r.remote).toBe("/local/path/to/repo");
    expect(r.owner).toBeUndefined();
  });
});

describe("readers: walk edge cases", () => {
  it("returns nothing for a root that does not exist, instead of throwing", () => {
    expect(walk(join(tmpdir(), "readmerlin-missing-root-xyz"), 3, () => true)).toEqual([]);
  });
  it("does not descend past maxDepth", () => {
    const root = repo({ "a/b/c/d/deep.md": "# x\n" });
    expect(walk(root, 2, (_r, name) => name === "deep.md")).toEqual([]);
    expect(walk(root, 4, (_r, name) => name === "deep.md")).toEqual(["a/b/c/d/deep.md"]);
  });
  it("skips a broken symlink instead of crashing", () => {
    const root = repo({ "keep.md": "# x\n" });
    symlinkSync(join(root, "does-not-exist"), join(root, "broken"));
    expect(walk(root, 2, (_r, name) => name.endsWith(".md"))).toEqual(["keep.md"]);
  });
  it("lists a file reached by two symlinks to it once", () => {
    const root = repo({ "real/SKILL.md": "---\nname: x\n---\n\nBody.\n" });
    symlinkSync(join(root, "real", "SKILL.md"), join(root, "SKILL.md"));
    const found = walk(root, 3, (_r, name) => name === "SKILL.md");
    expect(found.filter((f) => f.endsWith("SKILL.md")).length).toBeGreaterThanOrEqual(1);
  });
  it("skips a directory it cannot read", () => {
    const root = repo({ "locked/inside.md": "# x\n", "open.md": "# y\n" });
    chmodSync(join(root, "locked"), 0);
    try {
      expect(walk(root, 2, (_r, name) => name.endsWith(".md"))).toEqual(["open.md"]);
    } finally {
      chmodSync(join(root, "locked"), 0o755);
    }
  });
});

describe("readMarketplace", () => {
  it("reads a marketplace's plugin names, and drops an entry with no name", () => {
    const root = repo({ ".claude-plugin/marketplace.json": JSON.stringify({ name: "mine", plugins: [{ name: "a" }, {}] }) });
    expect(readMarketplace(root)).toEqual({ path: ".claude-plugin/marketplace.json", name: "mine", plugins: ["a"] });
  });
  it("gives an empty plugin list when the file carries no plugins array at all", () => {
    const root = repo({ ".claude-plugin/marketplace.json": JSON.stringify({ name: "mine" }) });
    expect(readMarketplace(root)?.plugins).toEqual([]);
  });
});

describe("readMcp: a single-server file shaped like server.json", () => {
  it("reads name, command from the first package and url when there is no mcpServers table", () => {
    const root = repo({ "server.json": JSON.stringify({ name: "receipts", url: "https://example.com", packages: [{ identifier: "pkg-id" }] }) });
    const [info] = readMcp(root);
    expect(info.servers).toEqual([{ name: "receipts", command: "pkg-id", url: "https://example.com" }]);
  });
  it("falls back to a package's name when it has no identifier, and to no command at all with no packages array", () => {
    const named = repo({ "server.json": JSON.stringify({ name: "receipts", packages: [{ name: "pkg-name" }] }) });
    expect(readMcp(named)[0].servers[0].command).toBe("pkg-name");
    const noPackages = repo({ "server.json": JSON.stringify({ name: "receipts" }) });
    expect(readMcp(noPackages)[0].servers[0].command).toBeUndefined();
  });
  it("lists no server at all for a file with neither a server table nor a top-level name", () => {
    const root = repo({ "server.json": "{}" });
    expect(readMcp(root)).toEqual([{ path: "server.json", servers: [] }]);
  });
});

describe("readPlugin", () => {
  it("carries no mcpServers key when the plugin.json has none", () => {
    const root = repo({ ".claude-plugin/plugin.json": JSON.stringify({ name: "tidy" }) });
    expect(readPlugin(root)?.mcpServers).toBeUndefined();
  });
  it("reads a single command written as a plain string, not only as an array", () => {
    const root = repo({ ".claude-plugin/plugin.json": JSON.stringify({ name: "tidy", commands: "solo-command" }) });
    expect(readPlugin(root)?.commands).toEqual(["solo-command"]);
  });
});

describe("readNamedDocs: a cross-directory duplicate", () => {
  it("lists a doc once when two configured folders both reach it", () => {
    const root = repo({ "commands/run.md": "---\nname: run\n---\n" });
    symlinkSync(join(root, "commands"), join(root, "aliased-commands"));
    const docs = readNamedDocs(root, ["commands", "aliased-commands"]);
    expect(docs.length).toBe(1);
  });
});

describe("readPackages: Cargo.toml with publish = false", () => {
  it("does not list a crate that opts out of publishing", () => {
    const root = repo({ "Cargo.toml": '[package]\nname = "thing"\nversion = "0.1.0"\npublish = false\n' });
    expect(readPackages(root)).toEqual([]);
  });
});

describe("readHooks", () => {
  it("reads hook names from a hooks file", () => {
    const root = repo({ "hooks/hooks.json": JSON.stringify({ hooks: { PreToolUse: [], PostToolUse: [] } }) });
    expect(readHooks(root)).toEqual(["hooks/hooks.json: PreToolUse", "hooks/hooks.json: PostToolUse"]);
  });
});

describe("readWorkflows", () => {
  it("names a workflow as unnamed when its yaml cannot be parsed", () => {
    const root = repo({ ".github/workflows/ci.yml": "name: [unterminated\non: push\n" });
    const [wf] = readWorkflows(root);
    expect(wf.name).toBeUndefined();
  });
});

describe("readLicense: every spdx branch", () => {
  it("recognises Apache, GPL-3, BSD and MPL headers, and leaves an unknown one without an spdx", () => {
    const lic = (head: string) => readLicense(repo({ LICENSE: head }))?.spdx;
    expect(lic("Apache License\nVersion 2.0\n")).toBe("Apache-2.0");
    expect(lic("GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007\n")).toBe("GPL-3.0");
    expect(lic("The BSD License\n")).toBe("BSD");
    expect(lic("Mozilla Public License\nVersion 2.0\n")).toBe("MPL-2.0");
    expect(lic("Some homemade license text.\n")).toBeUndefined();
  });
});

describe("detectHosts: a hosts page, and AGENTS.md as the Codex signal", () => {
  it("reads hosts from docs/hosts.md when present, instead of the README hero", () => {
    const root = repo({ "docs/hosts.md": "## Cursor\n\n## Windsurf\n", "README.md": "# x\n\n**Tag.**\n\nWorks with Claude Code.\n" });
    expect(detectHosts(root, undefined, []).sort()).toEqual(["Cursor", "Windsurf"]);
  });
  it("names Codex for a repo with an AGENTS.md and a skill, and no other host hint", async () => {
    const root = repo({ "skills/x/SKILL.md": "---\nname: x\ndescription: d\n---\n\nBody.\n", "AGENTS.md": "# AGENTS.md\n" });
    const { readSkills } = await import("../src/context/readers.js");
    const skills = readSkills(root);
    expect(detectHosts(root, undefined, skills)).toContain("Codex");
  });
});

describe("installLines: pypi, crates, gems and a marketplace with no plugin name", () => {
  it("adds the right install line for every registry, and a marketplace add line", () => {
    const packages = [
      { registry: "pypi" as const, name: "p", file: "pyproject.toml", badges: [] },
      { registry: "crates" as const, name: "c", file: "Cargo.toml", badges: [] },
      { registry: "gems" as const, name: "g", file: "g.gemspec", badges: [] },
    ];
    const lines = installLines({ owner: "o", name: "r" }, undefined, [], { name: "mp" }, packages);
    expect(lines).toContain("uvx p");
    expect(lines).toContain("cargo install c");
    expect(lines).toContain("gem install g");
    expect(lines).toContain("/plugin marketplace add o/r");
  });
});

describe("readCompare and readWorksWith with invalid JSON", () => {
  it("return undefined instead of throwing on a broken readmerlin.json", () => {
    const root = repo({ "readmerlin.json": "{not json" });
    expect(readCompare(root)).toBeUndefined();
    expect(readWorksWith(root)).toBeUndefined();
  });
});

describe("toMarkdown: packages, hooks and a wide works-with row", () => {
  it("lists published packages and hooks, and splits works-with into rows of six", async () => {
    const root = repo({
      "package.json": JSON.stringify({ name: "thing", bin: { thing: "x.js" } }),
      "hooks/hooks.json": JSON.stringify({ hooks: { PreToolUse: [] } }),
      "readmerlin.json": JSON.stringify({ worksWith: ["Claude Code", "Cursor", "Codex", "Gemini CLI", "Copilot", "Claude.ai", "OpenCode"] }),
    });
    const md = toMarkdown(await gather(root));
    expect(md).toContain("## Published packages");
    expect(md).toContain("npm: thing");
    expect(md).toContain("## Hooks");
    expect(md).toContain("hooks/hooks.json: PreToolUse");
    expect(md).toContain("2 rows of up to 4");
    expect(md).toContain("Row 1:");
    expect(md).toContain("Row 2:");
  });
  it("headers a nameless skill by its path, and drops a plugin's empty command/agent/skill lists", async () => {
    const root = repo({
      "skills/x/SKILL.md": "---\ndescription: d\n---\n\nBody.\n",
      ".claude-plugin/plugin.json": JSON.stringify({ name: "tidy", commands: [], agents: [], skills: [] }),
    });
    const md = toMarkdown(await gather(root));
    expect(md).toContain("### skills/x/SKILL.md");
    expect(md).not.toMatch(/- Commands:/);
    expect(md).not.toMatch(/- Agents:/);
  });
  it("names a workflow, and describes a command from its own frontmatter", async () => {
    const root = repo({
      ".github/workflows/ci.yml": "name: CI\non: push\n",
      "commands/run.md": "---\nname: run\ndescription: Runs the thing.\n---\n",
    });
    const md = toMarkdown(await gather(root));
    expect(md).toContain("- .github/workflows/ci.yml: CI");
    expect(md).toContain("- run: Runs the thing.\n");
  });
  it("lists an mcp server with no args at all, an unnamed workflow, and a command and an agent with no description", async () => {
    const root = repo({
      ".mcp.json": JSON.stringify({ mcpServers: { bare: { command: "node" } } }),
      ".github/workflows/broken.yml": "name: [unterminated\non: push\n",
      "commands/quiet.md": "---\nname: quiet\n---\n",
      "agents/silent.md": "---\nname: silent\n---\n",
    });
    const md = toMarkdown(await gather(root));
    expect(md).toContain("- bare (.mcp.json): node\n");
    expect(md).toContain("- .github/workflows/broken.yml\n");
    expect(md).not.toContain(".github/workflows/broken.yml:");
    expect(md).toContain("- quiet: \n");
    expect(md).toContain("- silent: \n");
  });
  it("names 'this repo' in the compare header with no git remote, and reports a README with no images or headings", async () => {
    const root = repo({
      "readmerlin.json": JSON.stringify({ compare: { repos: ["acme/x"] } }),
      "README.md": '<h1 align="center">t</h1>\n\n<p align="center"><b>Tag.</b></p>\n\nJust a plain paragraph, no images and no headings.\n',
    });
    const md = toMarkdown(await gather(root));
    expect(md).toContain("- Columns, in order: this repo, acme/x");
    expect(md).not.toMatch(/- Images:/);
    expect(md).not.toMatch(/- Headings:/);
  });
});
