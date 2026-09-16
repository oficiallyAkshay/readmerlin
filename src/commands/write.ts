import { write } from "../write/index.js";
import type { BackendName } from "../write/backends.js";

export interface WriteCliOptions {
  backend?: string;
  model?: string;
  out?: string;
  rounds?: number;
  instructions?: string;
  dryRun?: boolean;
}

export async function runWrite(dir: string, opts: WriteCliOptions): Promise<number> {
  const backend = (opts.backend ?? "auto") as BackendName | "auto";
  const result = await write(dir, { ...opts, backend, log: (l) => console.error(`readmerlin: ${l}`) });
  if (result.backend === "prompt") {
    if (process.env.GITHUB_ACTIONS) {
      console.error("readmerlin: no model reachable on this runner. Set ANTHROPIC_API_KEY, or pass GITHUB_TOKEN with permissions models: read.");
      return 2;
    }
    console.error("readmerlin: no model found. The prompt above is ready to paste into any agent.");
    return 0;
  }
  if (opts.dryRun) process.stdout.write(result.readme);
  else console.error(`readmerlin: wrote ${result.written} after ${result.rounds} round${result.rounds === 1 ? "" : "s"}`);
  if (result.findings.length) {
    console.error(`readmerlin: ${result.findings.length} fails remain. Run readmerlin check for the list.`);
    return 1;
  }
  return 0;
}
