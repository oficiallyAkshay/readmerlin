import { check, type CheckOptions } from "../check/index.js";
import { format as formatFindings } from "../check/format.js";

export async function runCheck(file: string, opts: CheckOptions): Promise<number> {
  const result = await check(file, opts);
  process.stdout.write(formatFindings(result, opts.format));
  return result.fails > 0 ? 1 : 0;
}
