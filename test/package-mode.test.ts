import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check } from "../src/check/index.js";

// Package mode: one install line and one example of the package's own command pass by exact shape; everything else fails.

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><rect x="0" y="0" width="100" height="40"/></svg>';
const readme = (blocks: string) => `# wandr\n\n**Walks a tree.**\n\nOne plain sentence.\n\n## Features\n\n- It walks.\n\n${blocks}\n`;

function pkg(blocks: string, opts: { packageMode?: boolean; manifest?: string | null; files?: Record<string, string> } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "rm-pkg-"));
  const files: Record<string, string> = { LICENSE: "MIT", "assets/hero.svg": SVG, ...opts.files };
  if (opts.manifest !== null) files["package.json"] = opts.manifest ?? JSON.stringify({ name: "wandr", bin: { wandr: "cli.js", "wandr-tool": "x.js" } });
  if (opts.packageMode) files["readmerlin.json"] = JSON.stringify({ packageMode: true });
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  writeFileSync(join(dir, "README.md"), readme(blocks));
  return dir;
}

const fence = (...lines: string[]) => "```bash\n" + lines.join("\n") + "\n```";
const shell = async (dir: string) => (await check(join(dir, "README.md"), { format: "json", links: false })).findings.filter((f) => f.id === "shape/install-in-words");
const root = async (dir: string) => (await check(join(dir, "README.md"), { format: "json", links: false })).findings.filter((f) => f.id === "honesty/root-files");

describe("package mode, shell commands", () => {
  it("passes one install line and one example", async () => {
    expect(await shell(pkg(fence("npm install wandr", "wandr src --depth 2"), { packageMode: true }))).toEqual([]);
    expect(await shell(pkg(fence("$ pip install wandr", "npx wandr-tool src"), { packageMode: true }))).toEqual([]);
    expect(await shell(pkg(fence("pipx install wandr", "npx wandr src"), { packageMode: true }))).toEqual([]);
    expect(await shell(pkg(fence("npm i wandr"), { packageMode: true }))).toEqual([]);
  });
  it("reads the name and bin from pyproject.toml too", async () => {
    const dir = pkg(fence("pip install wandr-py", "wpy run"), { packageMode: true, manifest: null, files: { "pyproject.toml": '[project]\nname = "wandr-py"\n\n[project.scripts]\nwpy = "wandr:main"\n' } });
    expect(await shell(dir)).toEqual([]);
    expect((await shell(pkg(fence("pip install wandr"), { packageMode: true, manifest: null, files: { "pyproject.toml": '[project]\nname = "wandr-py"\n' } }))).length).toBeGreaterThan(0);
  });
  it("allows nothing from a pyproject.toml with no project name", async () => {
    expect((await shell(pkg(fence("wpy run"), { packageMode: true, manifest: null, files: { "pyproject.toml": '[project.scripts]\nwpy = "wandr:main"\n# note\n' } }))).length).toBeGreaterThan(0);
  });
  it("skips blank lines, and leaves plain inline code and a bare npx to their own rules", async () => {
    expect(await shell(pkg("```bash\nnpm install wandr\n\nwandr src\n```\n\nPass `--depth` to go deeper.", { packageMode: true }))).toEqual([]);
    expect((await shell(pkg(fence("npx"), { packageMode: true }))).length).toBeGreaterThan(0);
    expect(await shell(pkg(fence("wandr src"), { packageMode: true, manifest: JSON.stringify({ name: "wandr", bin: 5 }) }))).toEqual([]);
  });
  it("fails the same README without the mode", async () => {
    expect((await shell(pkg(fence("npm install wandr", "wandr src")))).length).toBeGreaterThan(0);
  });
  it("is off unless the config value is exactly true", async () => {
    const dir = pkg(fence("npm install wandr"), { files: { "readmerlin.json": JSON.stringify({ packageMode: "true" }) } });
    expect((await shell(dir)).length).toBeGreaterThan(0);
  });
  it.each([
    ["rm -rf", "rm -rf /"],
    ["curl piped to sh", "curl installer | sh"],
    ["force push", "git push --force origin main"],
    ["python bundled flag", 'python3 -Bc "import shutil; shutil.rmtree(\'x\')"'],
    ["npx rm-rf", "npx rm-rf /"],
    ["npx premove", "npx premove /"],
    ["npx with a flag first", "npx -y wandr src"],
    ["another package install", "npm install left-pad"],
    ["install with a flag", "npm install wandr --global"],
    ["install with a suffix", "npm install wandr;rm"],
    ["install and example chained with &&", "npm install wandr && wandr src"],
    ["example chained with ;", "wandr src; wandr other"],
    ["example with a pipe", "wandr src | tee out"],
    ["example with a command substitution", "wandr $(id)"],
    ["example with a backtick", "wandr `id`"],
    ["example with a redirect", "wandr src > out"],
    ["example with a quote", 'wandr "src"'],
    ["env prefix", "X=1 wandr src"],
    ["unrelated command", "git status"],
  ])("fails %s in package mode", async (_name, cmd) => {
    expect((await shell(pkg(fence(cmd), { packageMode: true }))).length).toBeGreaterThan(0);
  });
  it("fails a second install line and a second example", async () => {
    expect((await shell(pkg(fence("npm install wandr", "pip install wandr"), { packageMode: true }))).length).toBe(1);
    expect((await shell(pkg(fence("wandr a", "wandr b"), { packageMode: true }))).length).toBe(1);
  });
  it("names a destructive command as such, besides refusing its shape", async () => {
    const found = await shell(pkg(fence("npx rm-rf /"), { packageMode: true }));
    expect(found.map((f) => f.message)).toContain("Destructive command.");
    expect(found.length).toBe(2);
  });
  it("judges an unlabeled block and inline code", async () => {
    expect((await shell(pkg("```\npython3 -Bc 'x'\n```", { packageMode: true }))).length).toBeGreaterThan(0);
    expect((await shell(pkg("Run `npm install left-pad` first.", { packageMode: true }))).length).toBeGreaterThan(0);
  });
  it("leaves a block in another language alone", async () => {
    expect(await shell(pkg('```json\n{ "a": 1 }\n```', { packageMode: true }))).toEqual([]);
  });
  it("allows nothing without a usable manifest", async () => {
    expect((await shell(pkg(fence("npm install wandr"), { packageMode: true, manifest: "{}" }))).length).toBeGreaterThan(0);
    expect((await shell(pkg(fence("npm install wandr"), { packageMode: true, manifest: "not json" }))).length).toBeGreaterThan(0);
    expect((await shell(pkg(fence("npm install wandr"), { packageMode: true, manifest: JSON.stringify({ name: "a b" }) }))).length).toBeGreaterThan(0);
    expect((await shell(pkg(fence("npm install wandr"), { packageMode: true, manifest: null }))).length).toBeGreaterThan(0);
  });
  it("takes a string bin as the unscoped package name", async () => {
    expect(await shell(pkg(fence("npm install @acme/wandr", "npx wandr src"), { packageMode: true, manifest: JSON.stringify({ name: "@acme/wandr", bin: "cli.js" }) }))).toEqual([]);
    expect((await shell(pkg(fence("npx wandr-other src"), { packageMode: true, manifest: JSON.stringify({ name: "wandr" }) }))).length).toBeGreaterThan(0);
  });
});

describe("package mode, root folders", () => {
  const folders = { ".changeset/config.json": "{}", "workflows/build.yml": "on: push", "tools/x.sh": "echo" };
  it("flags the changeset and workflow folders without the mode", async () => {
    const msg = (await root(pkg(fence("wandr"), { files: folders }))).map((f) => f.message).join(" ");
    expect(msg).toMatch(/\.changeset/);
    expect(msg).toMatch(/workflows/);
  });
  it("does not flag the changeset, workflow and tools folders with it", async () => {
    expect(await root(pkg(fence("wandr"), { packageMode: true, files: folders }))).toEqual([]);
  });
  it("still flags a stray folder with it", async () => {
    expect((await root(pkg(fence("wandr"), { packageMode: true, files: { "junk/x.txt": "x" } }))).length).toBe(1);
  });
});
