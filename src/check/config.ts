import { existsSync, readFileSync } from "node:fs";
import type { Config, Level } from "./types.js";

export const DEFAULT_CONFIG: Config = {
  rules: {},
  killList: ["Where it runs", "Example", "Examples", "What you need", "Prerequisites", "Requirements", "Contributing", "Contributing and license", "License", "Acknowledgments", "Acknowledgements", "Roadmap", "Built with", "Table of contents"],
  disclaimers: ["fully synthetic", "for illustration", "or the HTML master", "illustrative purposes"],
  headingAllowlist: ["README", "CI", "MCP", "API", "CLI", "PDF", "SVG", "JSON", "YAML", "URL", "HTML", "Claude", "Claude Code", "Cursor", "Codex", "Gemini", "Copilot", "GitHub", "OpenAI", "Anthropic", "Archify", "Wi-Fi", "Node", "Python"],
  sectionOrder: [],
  maxSections: 8,
  maxSectionLines: 40,
  maxParagraphSentences: 4,
  maxBadgesPerRow: 6,
  maxImageHeight: 700,
  productNames: [],
  counts: {},
  maxFindingsPerRule: 10,
};

export function loadConfig(path: string | undefined, cwd: string): Config {
  const file = path ?? `${cwd}/readmerlin.json`;
  if (!existsSync(file)) return { ...DEFAULT_CONFIG };
  const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<Config>;
  const rules: Record<string, Level> = {};
  for (const [k, v] of Object.entries(raw.rules ?? {})) {
    if (v === "off" || v === "warn" || v === "fail") rules[k] = v;
  }
  return { ...DEFAULT_CONFIG, ...raw, rules, counts: raw.counts ?? {} };
}
