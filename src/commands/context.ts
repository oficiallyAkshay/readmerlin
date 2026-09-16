import { gather } from "../context/index.js";
import { toMarkdown } from "../context/markdown.js";

export async function runContext(dir: string, format: "json" | "md"): Promise<number> {
  const ctx = await gather(dir);
  process.stdout.write(format === "md" ? toMarkdown(ctx) : JSON.stringify(ctx, null, 2) + "\n");
  return 0;
}
