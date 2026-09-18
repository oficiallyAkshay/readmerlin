import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
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
    expect(rules).toBe(readFileSync(resolve(__dirname, "../src/rules/RULES.md"), "utf8"));
  });
});

describe("update notice", () => {
  it("compares versions by number", () => {
    expect(newer("0.10.0", "0.9.3")).toBe(true);
    expect(newer("1.0.0", "1.0.0")).toBe(false);
    expect(newer("0.1.0", "0.2.0")).toBe(false);
  });
  it("stays quiet when the repo cannot be reached", async () => {
    const offline = (async () => { throw new Error("offline"); }) as typeof fetch;
    const n = await updateNotice("0.0.0-never-cached-" + Date.now(), offline);
    expect(n === undefined || /npx skills update readmerlin/.test(n)).toBe(true);
  });
});
