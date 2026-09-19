import { existsSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { check, type CheckOptions } from "../check/index.js";
import { gitRoot } from "../check/doc.js";
import { formatResults } from "../check/format.js";
import type { CheckResult } from "../check/types.js";
import { updateNotice } from "./update-notice.js";

export interface RunCheckOptions extends CheckOptions {
  /** Expand to README.md, AGENTS.md when present, CONTRIBUTING and every docs page, relative to the repo root. Overrides the given files. */
  pages?: boolean;
}

/** Every *.md file under dir, depth first, sorted so the order is stable. */
function collectMd(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectMd(p));
    else if (extname(entry.name).toLowerCase() === ".md") out.push(p);
  }
  return out;
}

/** README.md, AGENTS.md when present, .github/CONTRIBUTING.md (or CONTRIBUTING.md), and every docs page, each one that exists, relative to the nearest repo root. */
export function expandPages(cwd: string): { files: string[]; root: string } {
  const root = gitRoot(resolve(cwd)) ?? resolve(cwd);
  const files: string[] = [];
  const readme = join(root, "README.md");
  if (existsSync(readme)) files.push(readme);
  const agents = join(root, "AGENTS.md");
  if (existsSync(agents)) files.push(agents);
  const ghContributing = join(root, ".github", "CONTRIBUTING.md");
  const rootContributing = join(root, "CONTRIBUTING.md");
  if (existsSync(ghContributing)) files.push(ghContributing);
  else if (existsSync(rootContributing)) files.push(rootContributing);
  const docsDir = join(root, "docs");
  if (existsSync(docsDir)) files.push(...collectMd(docsDir));
  return { files, root };
}

export async function runCheck(files: string[], opts: RunCheckOptions): Promise<number> {
  let list = files;
  let repoRoot = opts.repoRoot;
  if (opts.pages) {
    const expanded = expandPages(process.cwd());
    list = expanded.files;
    repoRoot ??= expanded.root;
  }
  const results: CheckResult[] = [];
  // Reports name a file the way a person wrote it, relative to where the command runs.
  for (const file of list) results.push({ ...(await check(file, { ...opts, repoRoot })), file: relative(process.cwd(), resolve(file)) || file });
  process.stdout.write(formatResults(results, opts.format));
  // Only where a person or their agent reads the output, and only when the network is allowed.
  if (opts.format === "text" && opts.links) {
    const notice = await updateNotice(__VERSION__);
    if (notice) process.stdout.write(`\n${notice}\n`);
  }
  return results.some((r) => r.fails > 0) ? 1 : 0;
}
