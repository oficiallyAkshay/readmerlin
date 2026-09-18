import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// @ts-expect-error a plain script, no types
import { render } from "../scripts/hero-svg.mjs";

const HEROES = ["assets/readme/hero", "examples/tidy-inbox/assets/readme/hero"];

describe("every committed hero", () => {
  for (const h of HEROES) {
    it(`${h}.svg is what its spec draws`, () => {
      const spec = JSON.parse(readFileSync(resolve(__dirname, "..", `${h}.hero.json`), "utf8"));
      expect(render(spec) === readFileSync(resolve(__dirname, "..", `${h}.svg`), "utf8"), `${h}.svg has drifted. Run: node scripts/hero-svg.mjs ${h}.hero.json > ${h}.svg`).toBe(true);
    });
  }
  it("refuses an icon it does not know", () => {
    expect(() => render({ title: "t", sources: [{ label: "a", icon: "nope" }], handled: [], deliverable: { label: "x" } })).toThrow(/Unknown icon/);
  });
});
