import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

const define = {
  __VERSION__: JSON.stringify(JSON.parse(readFileSync("package.json", "utf8")).version),
  __RULES_MD__: JSON.stringify(readFileSync("src/rules/RULES.md", "utf8")),
  __WORKFLOW_YML__: JSON.stringify(readFileSync("templates/readme-check.yml", "utf8")),
  __CLONES_YML__: JSON.stringify(readFileSync("templates/clonometer.yml", "utf8")),
};

// One build, two entries, shared chunks: the CLI and the library carry the code once.
// The hashbang banner lands on every output file; Node accepts it at the top of any module.
// The Anthropic SDK stays external and optional; everything else is inlined so npx fetches one tarball.
export default defineConfig({
  entry: { cli: "src/cli.ts", index: "src/index.ts" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  bundle: true,
  splitting: true,
  noExternal: [/^(?!@anthropic-ai\/sdk$)/],
  external: ["@anthropic-ai/sdk"],
  banner: { js: "#!/usr/bin/env node\nimport { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  define,
});
