import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// A pinned action is a full commit hash plus a version comment. `<sha>` and `<comment>` are
// the slots init-workflow fills with a real release, so they count as the pin shape too.
const PINNED = /^\s*-?\s*uses:\s+\S+@([0-9a-f]{40}|<sha>)\s+#\s+(v\d\S*|<comment>)\s*$/;

const templates = readdirSync("templates").filter((f) => f.endsWith(".yml"));

describe("workflow templates", () => {
  it("finds the templates it holds to the rule", () => {
    expect(templates).toContain("readme-check.yml");
  });

  for (const name of templates) {
    const text = readFileSync(join("templates", name), "utf8");
    const lines = text.split("\n");

    it(`${name}: every uses: is pinned to a commit with a version comment`, () => {
      const uses = lines.filter((l) => /^\s*-?\s*uses:/.test(l));
      expect(uses.length).toBeGreaterThan(0);
      for (const line of uses) expect(line, line).toMatch(PINNED);
    });

    it(`${name}: a checkout step sets persist-credentials to false`, () => {
      lines.forEach((line, i) => {
        if (!/uses:\s+actions\/checkout@/.test(line)) return;
        const step = lines.slice(i + 1, i + 4);
        expect(step.some((l) => /^\s+persist-credentials:\s+false\s*$/.test(l)), line).toBe(true);
      });
    });
  }
});
