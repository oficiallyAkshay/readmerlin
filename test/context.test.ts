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
