import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "tsup";
import { skillScript } from "../tsup.config.js";
import { newer, updateNotice } from "../src/commands/update-notice.js";

const SCRIPT = resolve(__dirname, "../skills/readmerlin/scripts/readmerlin.mjs");

describe("the script the skill carries", () => {
  it("is the one the source builds", async () => {
    const out = mkdtempSync(join(tmpdir(), "rm-skill-"));
    await build({ ...skillScript, outDir: out, config: false, silent: true });
    expect(readFileSync(join(out, "readmerlin.mjs"), "utf8") === readFileSync(SCRIPT, "utf8"), "skills/readmerlin/scripts/readmerlin.mjs is stale. Run npm run build and commit it.").toBe(true);
  }, 30000);
  it("runs with Node alone, from a folder with no node_modules", () => {
    const rules = execFileSync("node", [SCRIPT, "rules"], { cwd: tmpdir(), encoding: "utf8" });
    expect(rules.startsWith(readFileSync(resolve(__dirname, "../src/rules/RULES.md"), "utf8"))).toBe(true);
    expect(rules).toContain("| shape/earned-headings | fail |");
    expect(rules.split("\n").filter((l) => /^\| [a-z]+\/[a-z-]+ \| (off|warn|fail) \|/.test(l)).length).toBe(57);
  });
});

describe("the version", () => {
  it("is the same in package.json, in SKILL.md and in the committed script", () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8")).version;
    const skill = /^\s*version:\s*"([^"]+)"/m.exec(readFileSync(resolve(__dirname, "../skills/readmerlin/SKILL.md"), "utf8"))?.[1];
    expect(skill).toBe(pkg);
    expect(execFileSync("node", [SCRIPT, "--version"], { encoding: "utf8" }).trim()).toBe(pkg);
  });
});

describe("update notice", () => {
  it("compares versions by number", () => {
    expect(newer("0.10.0", "0.9.3")).toBe(true);
    expect(newer("1.0.0", "1.0.0")).toBe(false);
    expect(newer("0.1.0", "0.2.0")).toBe(false);
  });
  const cacheFile = () => join(mkdtempSync(join(tmpdir(), "rm-cache-")), "latest.json");
  it("stays quiet when the repo cannot be reached, and asks once a day", async () => {
    let calls = 0;
    const offline = (async () => { calls++; throw new Error("offline"); }) as typeof fetch;
    const cache = cacheFile();
    expect(await updateNotice("0.0.0", offline, cache)).toBeUndefined();
    expect(await updateNotice("0.0.0", offline, cache)).toBeUndefined();
    expect(calls).toBe(1);
  });
  it("says when a newer version is out, and remembers the answer", async () => {
    let calls = 0;
    const online = (async () => { calls++; return new Response('{"version":"9.9.9"}'); }) as typeof fetch;
    const cache = cacheFile();
    expect(await updateNotice("0.3.0", online, cache)).toMatch(/9\.9\.9 is out.*npx skills update readmerlin/);
    expect(await updateNotice("0.3.0", online, cache)).toMatch(/9\.9\.9/);
    expect(calls).toBe(1);
  });
  it("prints only a version number, whatever the cache or the network holds", async () => {
    const cache = cacheFile();
    writeFileSync(cache, JSON.stringify({ version: 5, at: Date.now() }));
    const planted = (async () => new Response(JSON.stringify({ version: "9.9.9\n\u001b[31mPLANTED" }))) as typeof fetch;
    expect(await updateNotice("0.3.0", planted, cache)).toBeUndefined();
    writeFileSync(cache, JSON.stringify({ version: "1.0.0\nPLANTED", at: Date.now() }));
    expect(await updateNotice("0.3.0", planted, cache)).toBeUndefined();
  });
});

describe("count commands from the checked repo", () => {
  /** A repo whose readmerlin.json holds a count command that leaves a marker file when it runs. */
  const sample = () => {
    const d = mkdtempSync(join(tmpdir(), "rm-exec-"));
    mkdirSync(join(d, ".git"));
    writeFileSync(join(d, "README.md"), '# Tool\n\n<img alt="vendors" src="https://img.shields.io/badge/vendors-5-6f42c1?logo=x">\n');
    writeFileSync(join(d, "readmerlin.json"), JSON.stringify({ counts: { vendors: "touch ran && echo 5" } }));
    return d;
  };
  const ran = (flags: string[]) => {
    const d = sample();
    const r = spawnSync("node", [SCRIPT, "check", "README.md", "--no-links", "--format", "json", ...flags], { cwd: d, encoding: "utf8" });
    return { ran: existsSync(join(d, "ran")), stderr: r.stderr, out: r.stdout };
  };
  it("are not run by default", () => {
    const r = ran([]);
    expect(r.ran).toBe(false);
    expect(r.out).toContain("commands are off");
  });
  it("run with --exec", () => {
    expect(ran(["--exec"]).ran).toBe(true);
  });
  it("stay off with the old --no-exec, which is still accepted, and --no-exec wins over --exec", () => {
    const r = ran(["--no-exec"]);
    expect(r.ran).toBe(false);
    expect(r.stderr).toBe("");
    expect(ran(["--exec", "--no-exec"]).ran).toBe(false);
  });
});

describe("exit codes", () => {
  const run = (args: string[], cwd = tmpdir()) => {
    try {
      execFileSync("node", [SCRIPT, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      return 0;
    } catch (e) {
      return (e as { status: number }).status;
    }
  };
  it("are 0 for help, 2 for a wrong command, a wrong flag or a missing README, 1 for a README that fails", () => {
    expect(run(["--help"])).toBe(0);
    expect(run(["rules", "--help"])).toBe(0);
    expect(run([])).toBe(2);
    expect(run(["bogus"])).toBe(2);
    expect(run(["check", "--format", "xml"])).toBe(2);
    expect(run(["check", "no-such-README.md"])).toBe(2);
    const d = mkdtempSync(join(tmpdir(), "rm-exit-"));
    writeFileSync(join(d, "README.md"), "# Bad\n\nSome text.\n");
    expect(run(["check", "README.md", "--no-links", "--no-exec"], d)).toBe(1);
  });
  it("stop quietly when the reader closes the pipe early", () => {
    const out = execFileSync("bash", ["-c", `node "${SCRIPT}" rules | head -c 10; echo " status=\${PIPESTATUS[0]}"`], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    expect(out).toMatch(/status=0\s*$/);
  });
});
