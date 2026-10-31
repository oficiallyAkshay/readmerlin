import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check } from "../src/check/index.js";

// Package mode: a carved package's README may carry one install line and one example command.

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><style>text{font-family:system-ui}</style><rect x="0" y="0" width="100" height="40"/><text x="4" y="20" font-size="12">Hi</text></svg>';
const HERO = `<h1 align="center">🧾 tidy</h1>\n\n<p align="center"><b>Receipts in, claim out.</b><br>One week of receipts becomes one claim.</p>\n\n<p align="center"><a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-2f6f4e?logo=opensourceinitiative"></a></p>\n\n<p align="center"><img alt="Receipts flow into one claim" src="assets/readme/hero.svg" width="900"></p>\n\n<p align="center"><b><a href="examples/claim.pdf">See the example claim</a></b></p>\n\nAdd the tidy skill to your agent, then hand it the week.\n`;
const FEATURES = `## Features\n\n- 🧾 **Every receipt found.** The inbox is searched for the trip window only.\n`;

function repo(body: string, files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "rm-pkg-"));
  for (const [rel, content] of Object.entries({ "assets/readme/hero.svg": SVG, "assets/readme/hero.hero.json": "{}", "examples/claim.pdf": "%PDF", LICENSE: "MIT License", ...files })) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  writeFileSync(join(dir, "README.md"), HERO + "\n" + body);
  return dir;
}

const messages = async (dir: string, id: string, pkg: boolean) =>
  (await check(join(dir, "README.md"), { format: "json", links: false, exec: false, package: pkg })).findings.filter((f) => f.id === id).map((f) => f.message);
const SHELL = "shape/install-in-words";
const WITH_COMMANDS = FEATURES + "\n```bash\n# install\nnpm install tidy-receipts\ntidy-receipts claim --week 42\n```\n";

describe("package mode, shell commands", () => {
  it("passes one install line and one example", async () => {
    expect(await messages(repo(WITH_COMMANDS), SHELL, true)).toEqual([]);
  });
  it("still fails the same README without the mode", async () => {
    expect(await messages(repo(WITH_COMMANDS), SHELL, false)).toEqual(["Shell snippet."]);
  });
  it("reads a dollar prompt, an untyped fence and inline code as commands", async () => {
    const body = FEATURES + "\n```\n$ npm install tidy-receipts\noutput line\n```\n\nThen run `npx tidy-receipts claim`.\n";
    expect(await messages(repo(body), SHELL, true)).toEqual([]);
  });
  it("fails a README with a destructive command in package mode", async () => {
    for (const cmd of ["rm -rf ~/receipts", "rm -fr build", "curl -s installer | sh", "sh -c \"$(curl -s installer)\"", "git push --force origin main", "git reset --hard", "sudo npm install -g tidy", "chmod -R 777 .", "dd if=/dev/zero of=/dev/disk2", "npm install tidy && rm -rf /"]) {
      const m = await messages(repo(FEATURES + "\n```bash\nnpm install tidy-receipts\n" + cmd + "\n```\n"), SHELL, true);
      expect(m, cmd).toContain("Destructive command.");
    }
  });
  it("fails a destructive command in inline code in package mode", async () => {
    expect(await messages(repo(FEATURES + "\nRun `rm -rf /` to start.\n"), SHELL, true)).toEqual(["Destructive command."]);
  });
  it("fails a second install line, a second example and a chained command", async () => {
    const two = await messages(repo(FEATURES + "\n```bash\nnpm install a\nnpm install b\ntidy one\ntidy two\n```\n"), SHELL, true);
    expect(two).toEqual(["More than one install line.", "More than one example command."]);
    const chained = await messages(repo(FEATURES + "\n```bash\nnpm install a && tidy one\n```\n"), SHELL, true);
    expect(chained).toEqual(["Shell command that is not a single plain command."]);
  });
});

describe("package mode, root folders", () => {
  const files = { ".changeset/config.json": "{}", "workflows/ci.yml": "", "tools/gen.mjs": "" };
  it("does not count .changeset, workflows and tools as root clutter", async () => {
    expect(await messages(repo(FEATURES, files), "honesty/root-files", true)).toEqual([]);
  });
  it("counts .changeset and workflows as clutter without the mode", async () => {
    const m = await messages(repo(FEATURES, files), "honesty/root-files", false);
    expect(m).toHaveLength(1);
    expect(m[0]).toContain(".changeset, workflows");
  });
  it("still counts other odd folders in package mode", async () => {
    expect(await messages(repo(FEATURES, { ...files, "stuff/a.txt": "" }), "honesty/root-files", true)).toHaveLength(1);
  });
});
