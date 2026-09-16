import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";

export default defineConfig({
  define: {
    __VERSION__: JSON.stringify("test"),
    __RULES_MD__: JSON.stringify(readFileSync("src/rules/RULES.md", "utf8")),
    __WORKFLOW_YML__: JSON.stringify(readFileSync("templates/readme-check.yml", "utf8")),
  },
  test: { include: ["test/**/*.test.ts"] },
});
