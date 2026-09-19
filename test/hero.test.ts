import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// This repo carries no hero renderer of its own; figurehead (a peer skill,
// private for now) does the drawing. Point FIGUREHEAD_DIR at a checkout to
// run this test for real; it does not guess at a sibling checkout, since a
// figurehead checkout can sit anywhere, and guessing would make this test
// fail on a machine that has one at a different path.
const REPO_ROOT = resolve(__dirname, "..");
const HEROES = ["assets/readme/hero"];

function findFigurehead(): string | undefined {
  const fromEnv = process.env.FIGUREHEAD_DIR;
  if (fromEnv && existsSync(resolve(fromEnv, "scripts/figurehead.mjs"))) return resolve(fromEnv);
  return undefined;
}

const figureheadDir = findFigurehead();

describe("every committed hero", () => {
  if (!figureheadDir) {
    it.skip("set FIGUREHEAD_DIR to a figurehead checkout to run this test", () => {});
    return;
  }

  for (const h of HEROES) {
    it(`${h}.svg is what figurehead draws from its spec`, () => {
      const specPath = resolve(REPO_ROOT, `${h}.hero.json`);
      const svgPath = resolve(REPO_ROOT, `${h}.svg`);
      const want = readFileSync(svgPath, "utf8");
      let got: string;
      try {
        got = execFileSync("node", [resolve(figureheadDir, "scripts/figurehead.mjs"), "render", specPath], { encoding: "utf8" });
      } catch (err) {
        const stderr = (err as { stderr?: Buffer | string }).stderr;
        throw new Error(
          `figurehead could not render ${h}.hero.json: ${stderr ? stderr.toString() : String(err)}\n` +
            `Run: node ${resolve(figureheadDir, "scripts/figurehead.mjs")} render ${specPath}`,
        );
      }
      expect(got, `${h}.svg has drifted from figurehead's render, or figurehead's renderer no longer agrees with it`).toBe(want);
    });
  }
});
