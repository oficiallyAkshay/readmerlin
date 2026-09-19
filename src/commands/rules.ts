import { RULES } from "../check/rules/index.js";

/** The writing rules, then the table of every check as shipped: id, level and what a good README has. */
export function rulesText(): string {
  const rows = RULES.map((r) => `| ${r.id} | ${r.level} | ${r.description} |`).join("\n");
  return `${__RULES_MD__}\n## Rule ids and levels as shipped\n\n| Rule | Level | What a good README has |\n|---|---|---|\n${rows}\n`;
}

export function runRules(): number {
  process.stdout.write(rulesText());
  return 0;
}
