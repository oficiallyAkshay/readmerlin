import { describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
    expect(f?.message).toMatch(/thing is set up to publish to npm/);
    expect(f?.repair).toContain("shields.io/npm/v/thing");
  });
  it("asks the registry before warning, and stays quiet for a package that is not there", async () => {
    const d = dir({ "package.json": JSON.stringify({ name: "thing", main: "i.js" }), "README.md": "# t\n\n**b**\n\nc\n\n## s\n\n- x\n" });
    const answer = (status: number) => vi.stubGlobal("fetch", async () => new Response("{}", { status }));
    try {
      answer(404);
      expect((await check(join(d, "README.md"), { format: "json", links: true })).findings.map((x) => x.id)).not.toContain("badges/registry-present");
      answer(200);
      expect((await check(join(d, "README.md"), { format: "json", links: true })).findings.find((x) => x.id === "badges/registry-present")?.message).toMatch(/is published on npm/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("writes the clonometer workflow pinned to a commit on request", async () => {
    const d = dir({});
    const sha = "a".repeat(40);
    await runInitWorkflow(d, { clones: true, fetch: (async () => new Response(sha)) as typeof fetch });
    expect(existsSync(join(d, ".github/workflows/readme-check.yml"))).toBe(true);
    const yml = readFileSync(join(d, ".github/workflows/clonometer.yml"), "utf8");
    expect(yml).toContain(`oficiallyAkshay/clonometer@${sha}`);
    expect(yml).toContain("secrets.TRAFFIC_TOKEN");
  });
  it("leaves the placeholder when GitHub does not answer", async () => {
    const d = dir({});
    await runInitWorkflow(d, { clones: true, fetch: (async () => { throw new Error("offline"); }) as typeof fetch });
    expect(readFileSync(join(d, ".github/workflows/clonometer.yml"), "utf8")).toContain("clonometer@<sha>");
  });
});
