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
  it("writes each workflow pinned to the commit its latest release tag points at, named in a version comment", async () => {
    const d = dir({});
    // Each workflow gets its own repo's release and commit, and the releases API answers first.
    const tagOf = (url: string) => (/readmerlin/.test(url) ? "v9.9.9" : "v1.0.0");
    const shaOf = (url: string) => (/readmerlin/.test(url) ? "a" : "b").repeat(40);
    const urls: string[] = [];
    const fetchFn = (async (url: string) => {
      urls.push(url);
      if (url.includes("/releases/latest")) return new Response(JSON.stringify({ tag_name: tagOf(url) }));
      return new Response(shaOf(url));
    }) as unknown as typeof fetch;
    await runInitWorkflow(d, { clones: true, fetch: fetchFn });
    expect(urls).toEqual([
      "https://api.github.com/repos/oficiallyAkshay/readmerlin/releases/latest",
      "https://api.github.com/repos/oficiallyAkshay/readmerlin/commits/v9.9.9",
      "https://api.github.com/repos/oficiallyAkshay/clonometer/releases/latest",
      "https://api.github.com/repos/oficiallyAkshay/clonometer/commits/v1.0.0",
    ]);
    expect(readFileSync(join(d, ".github/workflows/readme-check.yml"), "utf8")).toContain(`oficiallyAkshay/readmerlin@${"a".repeat(40)}   # v9.9.9`);
    const yml = readFileSync(join(d, ".github/workflows/clonometer.yml"), "utf8");
    expect(yml).toContain(`oficiallyAkshay/clonometer@${"b".repeat(40)}   # v1.0.0`);
    expect(yml).toContain("secrets.TRAFFIC_TOKEN");
  });
  it("falls back to the tag list when the latest release's tag_name is not a plain vX.Y.Z", async () => {
    const d = dir({});
    const sha = "f".repeat(40);
    const fetchFn = (async (url: string) => {
      if (url.includes("/releases/latest")) return new Response(JSON.stringify({ tag_name: "readmerlin-v6.0.0" }));
      if (url.includes("/tags")) return new Response(JSON.stringify([{ name: "v6.0.0" }]));
      return new Response(sha);
    }) as unknown as typeof fetch;
    await runInitWorkflow(d, { fetch: fetchFn });
    expect(readFileSync(join(d, ".github/workflows/readme-check.yml"), "utf8")).toContain(`oficiallyAkshay/readmerlin@${sha}   # v6.0.0`);
  });
  it("falls back to the highest v* tag when the repo has no release", async () => {
    const d = dir({});
    const sha = "d".repeat(40);
    const fetchFn = (async (url: string) => {
      if (url.includes("/releases/latest")) return new Response("not found", { status: 404 });
      if (url.includes("/tags")) return new Response(JSON.stringify([{ name: "v1.9.0" }, { name: "v1.10.0" }, { name: "latest" }, { name: "v1.2" }]));
      return new Response(sha);
    }) as unknown as typeof fetch;
    await runInitWorkflow(d, { fetch: fetchFn });
    expect(readFileSync(join(d, ".github/workflows/readme-check.yml"), "utf8")).toContain(`oficiallyAkshay/readmerlin@${sha}   # v1.10.0`);
  });
  it("falls back to git's ref listing when the commit lookup is rate limited, dereferencing an annotated tag's peeled commit, and leaves an existing workflow alone", async () => {
    const d = dir({});
    const sha = "c".repeat(40);
    const fetchFn = (async (url: string) => {
      if (url.includes("/releases/latest")) return new Response(JSON.stringify({ tag_name: "v2.0.0" }));
      if (url.includes("/commits/")) return new Response("rate limited", { status: 403 });
      return new Response(`001e# service=git-upload-pack\n0000${sha} refs/tags/v2.0.0^{}\n0000`);
    }) as unknown as typeof fetch;
    await runInitWorkflow(d, { fetch: fetchFn });
    expect(readFileSync(join(d, ".github/workflows/readme-check.yml"), "utf8")).toContain(`oficiallyAkshay/readmerlin@${sha}   # v2.0.0`);
    let asked = 0;
    await runInitWorkflow(d, { fetch: (async () => { asked++; return new Response("x".repeat(40)); }) as typeof fetch });
    expect(asked).toBe(0);
    expect(readFileSync(join(d, ".github/workflows/readme-check.yml"), "utf8")).toContain(`@${sha}`);
  });
  it("reads a lightweight tag's commit straight from the ref listing when there is no peeled line", async () => {
    const d = dir({});
    const sha = "e".repeat(40);
    const fetchFn = (async (url: string) => {
      if (url.includes("/releases/latest")) return new Response(JSON.stringify({ tag_name: "v3.0.0" }));
      if (url.includes("/commits/")) return new Response("rate limited", { status: 403 });
      return new Response(`001e# service=git-upload-pack\n0000${sha} refs/tags/v3.0.0\n0000`);
    }) as unknown as typeof fetch;
    await runInitWorkflow(d, { fetch: fetchFn });
    expect(readFileSync(join(d, ".github/workflows/readme-check.yml"), "utf8")).toContain(`oficiallyAkshay/readmerlin@${sha}   # v3.0.0`);
  });
  it("falls back to the placeholder when a release tag resolves but its commit does not, on either the API or the ref listing", async () => {
    const d = dir({});
    const fetchFn = (async (url: string) => {
      if (url.includes("/releases/latest")) return new Response(JSON.stringify({ tag_name: "v4.0.0" }));
      if (url.includes("/commits/")) return new Response("server error", { status: 500 });
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;
    await runInitWorkflow(d, { fetch: fetchFn });
    expect(readFileSync(join(d, ".github/workflows/readme-check.yml"), "utf8")).toContain("readmerlin@<sha>   # vX.Y.Z, replace before pushing");
  });
  it("leaves the placeholder when GitHub does not answer at all", async () => {
    const d = dir({});
    await runInitWorkflow(d, { clones: true, fetch: (async () => { throw new Error("offline"); }) as typeof fetch });
    expect(readFileSync(join(d, ".github/workflows/clonometer.yml"), "utf8")).toContain("clonometer@<sha>   # vX.Y.Z, replace before pushing");
    expect(readFileSync(join(d, ".github/workflows/readme-check.yml"), "utf8")).toContain("readmerlin@<sha>   # vX.Y.Z, replace before pushing");
  });
  it("leaves the placeholder when a resolved tag's commit lookup throws on both the API and the ref listing", async () => {
    const d = dir({});
    const fetchFn = (async (url: string) => {
      if (url.includes("/releases/latest")) return new Response(JSON.stringify({ tag_name: "v5.0.0" }));
      throw new Error("offline");
    }) as unknown as typeof fetch;
    await runInitWorkflow(d, { fetch: fetchFn });
    expect(readFileSync(join(d, ".github/workflows/readme-check.yml"), "utf8")).toContain("readmerlin@<sha>   # vX.Y.Z, replace before pushing");
  });
});
