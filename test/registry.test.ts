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
    // Each workflow gets its own repo's commit, and the API answers first.
    const shaOf = (url: string) => (/readmerlin/.test(url) ? "a" : "b").repeat(40);
    const urls: string[] = [];
    await runInitWorkflow(d, { clones: true, fetch: (async (url: string) => { urls.push(url); return new Response(shaOf(url)); }) as unknown as typeof fetch });
    expect(urls).toEqual(["https://api.github.com/repos/oficiallyAkshay/readmerlin/commits/main", "https://api.github.com/repos/oficiallyAkshay/clonometer/commits/main"]);
    expect(readFileSync(join(d, ".github/workflows/readme-check.yml"), "utf8")).toContain(`oficiallyAkshay/readmerlin@${"a".repeat(40)}`);
    const yml = readFileSync(join(d, ".github/workflows/clonometer.yml"), "utf8");
    expect(yml).toContain(`oficiallyAkshay/clonometer@${"b".repeat(40)}`);
    expect(yml).toContain("secrets.TRAFFIC_TOKEN");
  });
  it("falls back to git's ref listing when the API is rate limited, and leaves an existing workflow alone", async () => {
    const d = dir({});
    const sha = "c".repeat(40);
    const fetchFn = (async (url: string) => (/api\.github\.com/.test(url) ? new Response("rate limited", { status: 403 }) : new Response(`001e# service=git-upload-pack\n0000${sha} refs/heads/main\n0000`))) as unknown as typeof fetch;
    await runInitWorkflow(d, { fetch: fetchFn });
    expect(readFileSync(join(d, ".github/workflows/readme-check.yml"), "utf8")).toContain(`oficiallyAkshay/readmerlin@${sha}`);
    let asked = 0;
    await runInitWorkflow(d, { fetch: (async () => { asked++; return new Response("x".repeat(40)); }) as typeof fetch });
    expect(asked).toBe(0);
    expect(readFileSync(join(d, ".github/workflows/readme-check.yml"), "utf8")).toContain(`@${sha}`);
  });
  it("leaves the placeholder when GitHub does not answer", async () => {
    const d = dir({});
    await runInitWorkflow(d, { clones: true, fetch: (async () => { throw new Error("offline"); }) as typeof fetch });
    expect(readFileSync(join(d, ".github/workflows/clonometer.yml"), "utf8")).toContain("clonometer@<sha>");
    expect(readFileSync(join(d, ".github/workflows/readme-check.yml"), "utf8")).toContain("readmerlin@<sha>");
  });
});
