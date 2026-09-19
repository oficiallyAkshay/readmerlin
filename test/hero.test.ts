import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// @ts-expect-error a plain script, no types
import { render } from "../skills/readmerlin/scripts/hero-svg.mjs";

const HEROES = ["assets/readme/hero"];

describe("every committed hero", () => {
  for (const h of HEROES) {
    it(`${h}.svg is what its spec draws`, () => {
      const spec = JSON.parse(readFileSync(resolve(__dirname, "..", `${h}.hero.json`), "utf8"));
      expect(render(spec) === readFileSync(resolve(__dirname, "..", `${h}.svg`), "utf8"), `${h}.svg has drifted. Run: node skills/readmerlin/scripts/hero-svg.mjs ${h}.hero.json > ${h}.svg`).toBe(true);
    });
  }
  it("names the field a spec is missing", () => {
    expect(() => render({ sources: [], handled: [], deliverable: { label: "x" } })).toThrow(/missing "title"/);
    expect(() => render({ title: "t", sources: [], handled: [] })).toThrow(/missing "deliverable"/);
    expect(() => render({ kind: "before-after", title: "t", before: { problems: [], label: "b" }, after: { parts: [], label: "a" } })).toThrow(/missing "by"/);
  });
  it("stays tall enough for the page and the fan whatever the row count", () => {
    const one = render({ title: "t", sources: [{ label: "a", icon: "mail" }], handled: [{ label: "x", icon: "target" }], deliverable: { label: "d" } });
    expect(one).toContain('viewBox="0 0 1200 380"');
    const four = render({ title: "t", sources: [1, 2, 3, 4].map((i) => ({ label: `s${i}`, icon: "mail" })), handled: [{ label: "x", icon: "target" }], deliverable: { label: "d" } });
    expect(four).toContain('viewBox="0 0 1200 618"');
  });
  it("refuses two labels at one place", () => {
    const spec = { kind: "before-after", title: "t", before: { problems: [{ at: "fold", label: "a" }, { at: "fold", label: "b" }], label: "b" }, by: { icon: "sparkles", label: "x" }, after: { parts: [], label: "a" } };
    expect(() => render(spec)).toThrow(/Two problems at "fold"/);
  });
  it("refuses an icon it does not know", () => {
    expect(() => render({ title: "t", sources: [{ label: "a", icon: "nope" }], handled: [], deliverable: { label: "x" } })).toThrow(/Unknown icon/);
  });
});
