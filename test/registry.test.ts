import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readPackages } from "../src/context/readers.js";
import { check } from "../src/check/index.js";
import { runInitWorkflow } from "../src/commands/init-workflow.js";

function dir(files: Record<string, string>): string {
  const d = mkdtempSync(join(tmpdir(), "rm-reg-"));
  for (const [rel, c] of Object.entries(files)) {
    mkdirSync(join(d, rel, ".."), { recursive: true });
    writeFileSync(join(d, rel), c);
  }
  return d;
}

describe("published packages", () => {
  it("sees a publishable package.json and a built pyproject, not tooling files", () => {
    const d = dir({
      "package.json": JSON.stringify({ name: "@scope/thing", bin: { thing: "x.js" } }),
      "pyproject.toml": '[build-system]\nrequires = ["hatchling"]\n[project]\nname = "thing-py"\n',
    });
    const p = readPackages(d);
    expect(p.map((x) => `${x.registry}:${x.name}`)).toEqual(["npm:@scope/thing", "pypi:thing-py"]);
    expect(p[0].badges[0].src).toContain(encodeURIComponent("@scope/thing"));
    const tooling = dir({ "package.json": JSON.stringify({ name: "site", private: true }), "pyproject.toml": '[project]\nname = "skill"\n[tool.pytest.ini_options]\n' });
    expect(readPackages(tooling)).toEqual([]);
  });
  it("warns when a published package has no registry badges", async () => {
    const d = dir({ "package.json": JSON.stringify({ name: "thing", main: "i.js" }), "README.md": "# t\n\n**b**\n\nc\n\n## s\n\n- x\n" });
    const r = await check(join(d, "README.md"), { format: "json", links: false });
    const f = r.findings.find((x) => x.id === "badges/registry-present");
    expect(f?.message).toMatch(/thing is published on npm/);
    expect(f?.repair).toContain("shields.io/npm/v/thing");
  });
  it("writes the clone-count workflow on request", () => {
    const d = dir({});
    runInitWorkflow(d, { clones: true });
    const { existsSync } = require("node:fs");
    expect(existsSync(join(d, ".github/workflows/readme-check.yml"))).toBe(true);
    expect(existsSync(join(d, ".github/workflows/clone-count.yml"))).toBe(true);
  });
});
