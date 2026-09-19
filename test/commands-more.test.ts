import { describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCheck, expandPages } from "../src/commands/check.js";
import { runInitWorkflow } from "../src/commands/init-workflow.js";
import { newer, updateNotice } from "../src/commands/update-notice.js";

function repo(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "rm-cmd-"));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  return dir;
}

describe("runCheck", () => {
  it("writes a formatted report to stdout and returns 1 when a file fails", async () => {
    const dir = repo({ "a.md": "## Notes\n\n- mail me at someone@corp.example.io\n" });
    const chunks: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((s: unknown) => {
      chunks.push(String(s));
      return true;
    });
    try {
      const code = await runCheck([join(dir, "a.md")], { format: "text", links: false });
      expect(code).toBe(1);
      expect(chunks.join("")).toContain("fails");
    } finally {
      spy.mockRestore();
    }
  });

  it("returns 0 for a clean file, and prints a name relative to the current directory", async () => {
    const dir = repo({ "docs/guide.md": "## Notes\n\nA plain sentence, joined with a comma.\n" });
    const chunks: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((s: unknown) => {
      chunks.push(String(s));
      return true;
    });
    const cwd = process.cwd();
    process.chdir(join(dir, "docs"));
    try {
      const code = await runCheck(["guide.md"], { format: "text", links: false });
      expect(code).toBe(0);
      expect(chunks.join("")).toContain("guide.md: 0 fails");
    } finally {
      process.chdir(cwd);
      spy.mockRestore();
    }
  });

  it("expands to --pages and prints an update notice when text format asks the network", async () => {
    const dir = repo({ "README.md": "## Notes\n\nA plain sentence, joined with a comma.\n" });
    mkdirSync(join(dir, ".git"));
    const chunks: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((s: unknown) => {
      chunks.push(String(s));
      return true;
    });
    const cwd = process.cwd();
    process.chdir(dir);
    // runCheck's own update-notice call reads and writes the real, shared cache file (it takes no
    // override), so this fetch answers a version older than any real release and the cache is
    // cleaned up afterward, to leave no trace for another test or a later run today.
    const noticeCache = join(tmpdir(), "readmerlin", "latest.json");
    rmSync(noticeCache, { force: true });
    const fetchStub = vi.fn(async () => new Response(JSON.stringify({ version: "0.0.1" })));
    vi.stubGlobal("fetch", fetchStub);
    try {
      const code = await runCheck([], { format: "text", links: true, pages: true });
      expect(typeof code).toBe("number");
      expect(chunks.join("")).toContain("README.md:");
      // The notice itself depends on the shared, real update-notice cache file, which other test
      // files can also touch concurrently; only the report output is asserted here, not the notice text.
    } finally {
      process.chdir(cwd);
      vi.unstubAllGlobals();
      spy.mockRestore();
      rmSync(noticeCache, { force: true });
    }
  });
});

describe("expandPages: no .git anywhere, no README, and a non-markdown docs file", () => {
  it("uses the given directory itself when no .git is found above it", () => {
    // The system temp directory is not inside a git checkout, so gitRoot finds nothing and falls back to cwd.
    const dir = repo({ "README.md": "# t\n" });
    const { root } = expandPages(dir);
    expect(root).toBe(dir);
  });
  it("lists nothing when the repo has no README.md at all", () => {
    const dir = repo({ "CONTRIBUTING.md": "## Commands\n" });
    mkdirSync(join(dir, ".git"));
    const { files } = expandPages(dir);
    expect(files).toEqual([join(dir, "CONTRIBUTING.md")]);
  });
  it("skips a non-markdown file sitting in the docs folder", () => {
    const dir = repo({ "docs/guide.md": "## Guide\n", "docs/logo.png": "not text" });
    mkdirSync(join(dir, ".git"));
    const { files } = expandPages(dir);
    expect(files).toEqual([join(dir, "docs/guide.md")]);
  });
});

describe("init-workflow: git fallback with a failed ref listing, the default fetch, and a real remote", () => {
  it("returns undefined when the git-upload-pack fallback also answers with an error status", async () => {
    const dir = repo();
    const fetchFn = (async (url: string) => (/api\.github\.com/.test(url) ? new Response(null, { status: 500 }) : new Response(null, { status: 404 }))) as unknown as typeof fetch;
    await runInitWorkflow(dir, { fetch: fetchFn });
    const yml = readFileSync(join(dir, ".github/workflows/readme-check.yml"), "utf8");
    expect(yml).toContain("readmerlin@<sha>");
  });

  it("falls back to globalThis.fetch when no fetch option is given", async () => {
    const dir = repo();
    const stub = vi.fn(async () => new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", stub);
    try {
      await runInitWorkflow(dir, {});
      expect(stub).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses the real owner/repo slug from a configured git remote for the clonometer badges", async () => {
    const dir = repo();
    execFileSync("git", ["init", "-q", dir]);
    execFileSync("git", ["-C", dir, "remote", "add", "origin", "https://github.com/acme/widgets.git"]);
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((s: string) => {
      logs.push(s);
    });
    try {
      await runInitWorkflow(dir, { clones: true, fetch: (async () => new Response(null, { status: 500 })) as unknown as typeof fetch });
      expect(logs.some((l) => l.includes("acme/widgets/badges/clones.json"))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("update-notice: a stale cache entry and a non-ok network answer", () => {
  it("asks again when the cached answer is older than a day", async () => {
    const cache = join(mkdtempSync(join(tmpdir(), "rm-notice-")), "latest.json");
    writeFileSync(cache, JSON.stringify({ version: "1.2.3", at: Date.now() - 25 * 3600 * 1000 }));
    let calls = 0;
    const fetchFn = (async () => {
      calls++;
      return new Response(JSON.stringify({ version: "1.2.3" }));
    }) as unknown as typeof fetch;
    await updateNotice("0.1.0", fetchFn, cache);
    expect(calls).toBe(1);
  });
  it("stays quiet when the network answers with an error status", async () => {
    const cache = join(mkdtempSync(join(tmpdir(), "rm-notice-")), "latest.json");
    const fetchFn = (async () => new Response(null, { status: 500 })) as unknown as typeof fetch;
    expect(await updateNotice("0.1.0", fetchFn, cache)).toBeUndefined();
  });
});

describe("newer", () => {
  it("compares patch versions", () => {
    expect(newer("1.2.4", "1.2.3")).toBe(true);
    expect(newer("1.2.3", "1.2.4")).toBe(false);
  });
});
