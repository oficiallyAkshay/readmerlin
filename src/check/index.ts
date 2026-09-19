import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { parseDoc } from "./doc.js";
import { RULES } from "./rules/index.js";
import type { CheckResult, Finding } from "./types.js";

export interface CheckOptions {
  format: "text" | "github" | "json";
  configPath?: string;
  links: boolean;
  /** Run count-source commands from readmerlin.json. Default true. */
  exec?: boolean;
  /** Repo root for root-relative paths and config. Defaults to the nearest folder with .git above the README, else its folder. */
  repoRoot?: string;
}

export async function check(file: string, opts: CheckOptions): Promise<CheckResult> {
  const abs = resolve(file);
  const doc = parseDoc(abs, opts.repoRoot);
  const config = loadConfig(opts.configPath, doc.repoRoot);
  const findings: Finding[] = [];
  const ran: string[] = [];
  for (const rule of RULES) {
    // A page other than the README is judged on honesty only: links, badges, privacy, and the rules a page opts into.
    if (doc.kind !== "readme" && !rule.pages) continue;
    const level = config.rules[rule.id] ?? rule.level;
    if (level === "off") continue;
    ran.push(rule.id);
    const out = await rule.run({ doc, config, links: opts.links, exec: opts.exec ?? true, fetch: globalThis.fetch });
    const cap = Math.max(1, config.maxFindingsPerRule);
    for (const f of out.slice(0, cap)) findings.push({ id: rule.id, ...f, level: f.level ?? level });
    if (out.length > cap) findings.push({ id: rule.id, level, message: `${out.length - cap} more of the same. Fix these and run again.`, line: out[cap].line });
  }
  return {
    file,
    findings,
    fails: findings.filter((f) => f.level === "fail").length,
    warns: findings.filter((f) => f.level === "warn").length,
    ran,
  };
}
