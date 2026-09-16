import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function put(dir: string, name: string, content: string): void {
  const target = join(dir, ".github", "workflows", name);
  if (existsSync(target)) {
    console.log(`exists: ${target}`);
    return;
  }
  mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
  writeFileSync(target, content);
  console.log(`wrote: ${target}`);
}

export function runInitWorkflow(dir: string, opts: { clones?: boolean } = {}): number {
  put(dir, "readme-check.yml", __WORKFLOW_YML__);
  if (opts.clones) {
    put(dir, "clone-count.yml", __CLONES_YML__);
    console.log("clone-count.yml needs a CLONE_TOKEN secret: a fine-grained token with Administration read on the repo and Gists write. The first run prints the badge in its job summary.");
  }
  return 0;
}
