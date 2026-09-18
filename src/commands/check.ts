import { check, type CheckOptions } from "../check/index.js";
import { format as formatFindings } from "../check/format.js";
import { updateNotice } from "./update-notice.js";

export async function runCheck(file: string, opts: CheckOptions): Promise<number> {
  const result = await check(file, opts);
  process.stdout.write(formatFindings(result, opts.format));
  // Only where a person or their agent reads the output, and only when the network is allowed.
  if (opts.format === "text" && opts.links) {
    const notice = await updateNotice(__VERSION__);
    if (notice) process.stdout.write(`\n${notice}\n`);
  }
  return result.fails > 0 ? 1 : 0;
}
