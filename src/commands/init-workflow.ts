import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function runInitWorkflow(dir: string): number {
  const target = join(dir, ".github", "workflows", "readme-check.yml");
  if (existsSync(target)) {
    console.log(`exists: ${target}`);
    return 0;
  }
  mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
  writeFileSync(target, __WORKFLOW_YML__);
  console.log(`wrote: ${target}`);
  return 0;
}
