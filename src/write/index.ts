import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gather } from "../context/index.js";
import { toMarkdown } from "../context/markdown.js";
import { check } from "../check/index.js";
import type { Finding } from "../check/types.js";
import { pickBackend, type Backend, type BackendName } from "./backends.js";
import { buildPrompt, buildRepairPrompt, extractReadme } from "./prompt.js";

export interface WriteOptions {
  backend?: BackendName | "auto" | Backend;
  model?: string;
  out?: string;
  rounds?: number;
  instructions?: string;
  dryRun?: boolean;
  log?: (line: string) => void;
}

export interface WriteResult {
  backend: BackendName;
  readme: string;
  rounds: number;
  findings: Finding[];
  written?: string;
}

/** Checks that need the rendered visuals or the network are not the writer's to fix. */
const DEFERRED = new Set(["visuals/images-exist", "visuals/spec-beside", "visuals/svg-escaped", "visuals/svg-font-stack", "visuals/svg-clipping", "visuals/svg-text-overflow", "visuals/distinct-icons", "visuals/height", "badges/logo-renders", "badges/count-source", "links/external", "links/relative", "honesty/root-files"]);

export async function write(dir: string, opts: WriteOptions = {}): Promise<WriteResult> {
  const root = resolve(dir);
  const log = opts.log ?? (() => {});
  const chosen = opts.backend ?? "auto";
  const backend: Backend = typeof chosen === "object" ? chosen : pickBackend(chosen, opts.model);
  const ctx = await gather(root);
  const existingPath = ["README.md", "readme.md", "Readme.md"].map((n) => join(root, n)).find((p) => existsSync(p));
  const existing = existingPath ? readFileSync(existingPath, "utf8") : undefined;
  const prompt = buildPrompt({ rules: __RULES_MD__, contextMd: toMarkdown(ctx), existing, instructions: opts.instructions });

  log(`backend: ${backend.name}`);
  let text = await backend.complete(prompt);
  if (backend.name === "prompt") return { backend: backend.name, readme: "", rounds: 0, findings: [] };
  let readme = extractReadme(text);

  const maxRounds = opts.rounds ?? 3;
  let rounds = 1;
  let findings: Finding[] = [];
  const scratchDir = mkdtempSync(join(tmpdir(), "readmerlin-"));
  const scratch = join(scratchDir, "README.md");
  try {
  for (;;) {
    writeFileSync(scratch, readme);
    const result = await check(scratch, { format: "json", links: false, repoRoot: root });
    findings = result.findings.filter((f) => f.level === "fail" && !DEFERRED.has(f.id));
    log(`round ${rounds}: ${findings.length} fails to fix`);
    if (findings.length === 0 || rounds >= maxRounds) break;
    text = await backend.complete(buildRepairPrompt(readme, findings));
    readme = extractReadme(text);
    rounds++;
  }
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }

  const out = resolve(root, opts.out ?? "README.md");
  if (!opts.dryRun) writeFileSync(out, readme);
  return { backend: backend.name, readme, rounds, findings, written: opts.dryRun ? undefined : out };
}
