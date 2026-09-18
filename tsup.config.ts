import { defineConfig, type Options } from "tsup";
import { readFileSync } from "node:fs";

const define = {
  __VERSION__: JSON.stringify(JSON.parse(readFileSync("package.json", "utf8")).version),
  __RULES_MD__: JSON.stringify(readFileSync("src/rules/RULES.md", "utf8")),
  __WORKFLOW_YML__: JSON.stringify(readFileSync("templates/readme-check.yml", "utf8")),
  __CLONES_YML__: JSON.stringify(readFileSync("templates/clonometer.yml", "utf8")),
};

const shared: Options = {
  format: ["esm"],
  target: "node20",
  platform: "node",
  bundle: true,
  noExternal: [/.*/],
  banner: { js: "#!/usr/bin/env node\nimport { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  define,
};

// The script the skill carries: one file, everything inlined, so an installed skill runs with Node alone.
// It is committed, and test/skill-script.test.ts rebuilds it and fails when the two differ.
export const skillScript: Options = {
  ...shared,
  entry: { readmerlin: "src/cli.ts" },
  outDir: "skills/readmerlin/scripts",
  outExtension: () => ({ js: ".mjs" }),
  splitting: false,
  minify: true,
};

// The CLI and the library share chunks, so dist carries the code once.
// The hashbang banner lands on every output file; Node accepts it at the top of any module.
export default defineConfig([{ ...shared, entry: { cli: "src/cli.ts", index: "src/index.ts" }, splitting: true }, skillScript]);
